/**
 * useWebRTC — Core hook for P2P file sharing
 *
 * ## How Manual Signaling Works (no server needed):
 *
 * 1. SENDER calls createOffer() → simple-peer generates an SDP offer + ICE candidates
 *    (trickle: false bundles all ICE candidates into a single signal).
 *    The offer is base64-encoded and shown as a QR code / copyable text.
 *
 * 2. RECEIVER pastes/scans the offer, calls acceptOffer(offer).
 *    simple-peer generates an SDP answer, also base64-encoded.
 *
 * 3. SENDER pastes/scans the answer, calls acceptAnswer(answer).
 *    The WebRTC connection is established — data channel opens.
 *
 * ## Chunked File Transfer Protocol:
 *
 * - Control messages are sent as JSON strings.
 * - File chunks are sent as raw Uint8Array (binary).
 * - Files are transferred sequentially (one at a time from the queue).
 *
 * Message types:
 *   { type: 'file-meta', name, size, totalChunks } — announces a new file
 *   [binary data]                                   — 64KB chunk of file data
 *   { type: 'file-complete' }                       — file finished
 *   { type: 'file-cancel' }                         — sender cancelled current file
 *   { type: 'chat', text, timestamp }               — text message
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Peer from 'simple-peer';
import { encodeSignal, decodeSignal, uid, sleep } from '@/lib/utils';
import { toast } from 'sonner';
import { useSettings } from '@/hooks/useSettings';
import { createRoom, getOffer, submitAnswer, pollAnswer, markCompleted } from '@/lib/supabase';

// ─── Constants ───────────────────────────────────────────────
const CHUNK_SIZE = 64 * 1024;          // 64KB per chunk
const HIGH_WATER_MARK = 1024 * 1024;   // 1MB — pause sending when buffer exceeds this
const PROGRESS_THROTTLE = 80;          // ms between progress state updates

// ─── Types ───────────────────────────────────────────────────
export type ConnectionState =
  | 'idle'
  | 'waiting-for-peer'   // Offer/answer created, waiting for the other party
  | 'connecting'         // Both signals exchanged, ICE in progress
  | 'connected'          // Data channel open
  | 'disconnected'
  | 'error';

export type TransferStatus = 'queued' | 'transferring' | 'completed' | 'cancelled' | 'error';

export interface FileTransfer {
  id: string;
  name: string;
  size: number;
  progress: number;      // 0–100
  speed: number;         // bytes/sec
  status: TransferStatus;
  direction: 'send' | 'receive';
  eta?: number;          // seconds remaining
  startTime?: number;    // timestamp
  endTime?: number;      // timestamp
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'me' | 'peer';
  timestamp: number;
}

// ─── STUN servers (Expanded list for better mobile connectivity) ─────────
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:global.stun.twilio.com:3478' },
];

// ─── Hook ────────────────────────────────────────────────────
export function useWebRTC() {
  const { t } = useSettings();
  const peerRef = useRef<Peer.Instance | null>(null);
  const visibilityToastIdRef = useRef<string | number | null>(null);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentRoomIdRef = useRef<string | null>(null);

  // Connection
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [localSignal, setLocalSignal] = useState<string | null>(null);
  const [signalStatus, setSignalStatus] = useState<'gathering' | 'ready' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Connection Timeout Logic
  useEffect(() => {
    if (connectionState === 'connecting') {
      connectionTimeoutRef.current = setTimeout(() => {
        if (connectionState === 'connecting') {
          console.warn('[WebRTC] Connection timeout reached');
          setError('connectionTimeout');
          setConnectionState('error');
          if (peerRef.current) peerRef.current.destroy();
        }
      }, 180000); // 180 seconds timeout (3 minutes)
    } else {
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
    }

    return () => {
      if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
    };
  }, [connectionState]);

  // Transfers & chat
  const [transfers, setTransfers] = useState<FileTransfer[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Internal refs (not triggering re-renders)
  const sendQueueRef = useRef<{ id: string; file: File }[]>([]);
  const isSendingRef = useRef(false);
  const cancelledRef = useRef<Set<string>>(new Set());
  const incomingRef = useRef<{
    id: string;
    name: string;
    size: number;
    totalChunks: number;
    chunks: any[];
    receivedBytes: number;
    startTime: number;
  } | null>(null);

  // ─── Wake Lock & Visibility handling ──────────────────────
  const wakeLockRef = useRef<any>(null);

  const requestWakeLock = async () => {
    if ('wakeLock' in navigator && !wakeLockRef.current) {
      try {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      } catch (err) {
        console.error('Wake Lock error:', err);
      }
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
  };

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && (connectionState === 'connecting' || connectionState === 'waiting-for-peer')) {
        // Persistent toast for backgrounding during signaling
        const id = toast.warning(t.transfer.keepTabOpen, {
          description: t.transfer.backgroundWarning,
          duration: Infinity, // Keep until user returns or connection fails
          action: {
            label: t.common.back,
            onClick: () => {
              // Focus window if possible (browser security depends)
              window.focus();
            }
          }
        });
        visibilityToastIdRef.current = id;
      } else if (!document.hidden && visibilityToastIdRef.current) {
        toast.dismiss(visibilityToastIdRef.current);
        visibilityToastIdRef.current = null;
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (visibilityToastIdRef.current) toast.dismiss(visibilityToastIdRef.current);
    };
  }, [connectionState, t.transfer.keepTabOpen, t.transfer.backgroundWarning, t.common.back, t.common.error]);

  // ─── Incoming data handler ──────────────────────────────
  const handleData = useCallback((data: any) => {
    requestWakeLock(); // Request on activity
    let msg: any = null;
    let isJson = false;

    // ... (rest of handleData logic remains same)
    // 1. Try to parse as JSON
    try {
      if (typeof data === 'string') {
        msg = JSON.parse(data);
        isJson = true;
      } else {
        const decoded = new TextDecoder().decode(data);
        if (decoded.startsWith('{') && decoded.endsWith('}')) {
          msg = JSON.parse(decoded);
          isJson = true;
        }
      }
    } catch (e) {}

    if (isJson && msg) {
      if (msg.type === 'file-meta') {
        const id = msg.id || uid();
        incomingRef.current = {
          id,
          name: msg.name,
          size: msg.size,
          totalChunks: msg.totalChunks,
          chunks: [],
          receivedBytes: 0,
          startTime: Date.now(),
        };
        setTransfers((p) => [
          ...p,
          {
            id,
            name: msg.name,
            size: msg.size,
            progress: 0,
            speed: 0,
            status: 'transferring',
            direction: 'receive',
            startTime: Date.now(),
          },
        ]);
      }

      if (msg.type === 'file-complete' && incomingRef.current) {
        const { id, name, chunks } = incomingRef.current;
        const blob = new Blob(chunks);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 5000);

        setTransfers((p) =>
          p.map((t) => (t.id === id ? { ...t, progress: 100, status: 'completed', speed: 0, endTime: Date.now() } : t)),
        );
        incomingRef.current = null;
        releaseWakeLock(); // Release when idle
      }

      if (msg.type === 'file-cancel') {
        const cancelId = msg.id || (incomingRef.current?.id);
        if (cancelId) {
          cancelledRef.current.add(cancelId);
          setTransfers((p) =>
            p.map((t) => (t.id === cancelId ? { ...t, status: 'cancelled', speed: 0 } : t)),
          );
        }
        if (incomingRef.current?.id === cancelId) {
          incomingRef.current = null;
        }
        releaseWakeLock();
      }

      if (msg.type === 'chat') {
        setMessages((p) => [
          ...p,
          { id: uid(), text: msg.text, sender: 'peer', timestamp: msg.timestamp },
        ]);
      }
      return;
    }

    // 2. Binary data → file chunk
    if (incomingRef.current && (data instanceof Uint8Array || data instanceof ArrayBuffer || Buffer.isBuffer(data))) {
      const inc = incomingRef.current;
      const chunk = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
      inc.chunks.push(chunk);
      inc.receivedBytes += chunk.byteLength;

      const progress = Math.min(100, Math.round((inc.receivedBytes / inc.size) * 100));
      const elapsed = (Date.now() - inc.startTime) / 1000;
      const speed = elapsed > 0 ? inc.receivedBytes / elapsed : 0;
      const eta = speed > 0 ? (inc.size - inc.receivedBytes) / speed : undefined;

      setTransfers((p) =>
        p.map((t) => (t.id === inc.id ? { ...t, progress, speed, eta } : t)),
      );
    }
  }, [t.transfer.keepTabOpen, t.transfer.backgroundWarning]); // Added small meta deps

  // ─── Create peer instance ──────────────────────────────
  const createPeerInstance = useCallback(
    (initiator: boolean) => {
      // Destroy existing peer
      if (peerRef.current) {
        peerRef.current.destroy();
      }

      const peer = new Peer({
        initiator,
        trickle: false, // Bundle all ICE candidates into one signal
        config: { iceServers: ICE_SERVERS },
      });

      // Signal handler is now managed by createOffer/acceptOffer
      // to support Supabase signaling

      peer.on('connect', async () => {
        setConnectionState('connected');
        setSignalStatus(null);
        setError(null);
        requestWakeLock();
        
        // Mark room as completed in Supabase
        if (currentRoomIdRef.current) {
          await markCompleted(currentRoomIdRef.current);
        }
      });

      peer.on('data', handleData);

      peer.on('close', () => {
        setConnectionState('disconnected');
        setSignalStatus(null);
        isSendingRef.current = false;
        currentRoomIdRef.current = null;
        releaseWakeLock();
      });

      peer.on('error', (err: any) => {
        console.error('[WebRTC Error]', err);
        const code = err.code;
        const msg = err.message || 'Connection failed';
        
        if (msg.includes('Ice connection') || msg.includes('ICE')) {
          setError('iceFailed');
        } else if (code === 'ERR_WEBRTC_SUPPORT') {
          setError('WebRTC not supported or blocked by browser.');
        } else {
          // Show technical message for unhandled errors
          setError(msg);
        }
        
        setConnectionState('error');
        setSignalStatus(null);
        isSendingRef.current = false;
        currentRoomIdRef.current = null;
        releaseWakeLock();
      });

      peerRef.current = peer;
      return peer;
    },
    [handleData],
  );

  // ─── Public API ─────────────────────────────────────────

  /** Helper: Poll for answer from Supabase */
  const pollForAnswer = useCallback(async (roomId: string, peer: Peer.Instance) => {
    const maxAttempts = 60; // 60 attempts * 3 seconds = 3 minutes
    let attempts = 0;
    
    const poll = async () => {
      if (attempts >= maxAttempts) {
        setError('connectionTimeout');
        setConnectionState('error');
        return;
      }
      
      if (peer.destroyed) {
        return;
      }
      
      try {
        const answer = await pollAnswer(roomId);
        if (answer) {
          peer.signal(answer);
          await markCompleted(roomId);
        } else {
          attempts++;
          setTimeout(poll, 3000); // Poll every 3 seconds
        }
      } catch (err) {
        console.error('[Poll Answer Error]', err);
        attempts++;
        setTimeout(poll, 3000); // Retry on error
      }
    };
    
    poll();
  }, []);

  /** Step 1 (Sender): Create an offer */
  const createOffer = useCallback(async () => {
    setError(null);
    setLocalSignal(null);
    setSignalStatus('gathering');
    setConnectionState('connecting');
    
    const peer = createPeerInstance(true);
    
    // Wait for signal event
    peer.once('signal', async (data) => {
      try {
        // Store offer in Supabase and get room ID
        const roomId = await createRoom(data);
        currentRoomIdRef.current = roomId;
        setLocalSignal(roomId); // Set room ID instead of full signal
        setSignalStatus('ready');
        setConnectionState('waiting-for-peer');
        
        // Start polling for answer
        pollForAnswer(roomId, peer);
      } catch (err: any) {
        console.error('[Create Room Error]', err);
        setError(err.message || 'Failed to create room');
        setConnectionState('error');
      }
    });
  }, [createPeerInstance, pollForAnswer]);

  /** Step 2 (Receiver): Accept an offer and generate an answer */
  const acceptOffer = useCallback(
    async (roomIdOrSignal: string) => {
      if (!roomIdOrSignal.trim()) return;
      if (connectionState === 'connected') return;

      try {
        setError(null);
        setLocalSignal(null);
        setSignalStatus('gathering');
        setConnectionState('connecting');
        
        let offerSignal: any;
        
        // Check if input is room ID (short) or full signal (long, for backward compat)
        if (roomIdOrSignal.length <= 10) {
          // It's a room ID, fetch offer from Supabase
          offerSignal = await getOffer(roomIdOrSignal);
          currentRoomIdRef.current = roomIdOrSignal;
        } else {
          // It's a full signal (backward compatibility)
          offerSignal = decodeSignal(roomIdOrSignal.trim());
        }
        
        const peer = createPeerInstance(false);
        peer.signal(offerSignal as Peer.SignalData);
        
        // Wait for answer signal
        peer.once('signal', async (answerData) => {
          if (currentRoomIdRef.current) {
            // Submit answer to Supabase
            try {
              await submitAnswer(currentRoomIdRef.current, answerData);
              setSignalStatus('ready');
            } catch (err: any) {
              console.error('[Submit Answer Error]', err);
              setError(err.message || 'Failed to submit answer');
              setConnectionState('error');
            }
          } else {
            // Fallback to old behavior (encode answer for manual copy/paste)
            setLocalSignal(encodeSignal(answerData));
            setSignalStatus('ready');
          }
        });
      } catch (e: any) {
        console.error('[Offer Error]', e);
        const isDecodeError = e.message?.includes('JSON') || e.message?.includes('base64');
        const isRoomNotFound = e.message?.includes('roomNotFound');
        const isInvalidRoomId = e.message?.includes('Invalid room ID');
        
        if (isRoomNotFound) {
          setError('roomNotFound');
        } else if (isInvalidRoomId) {
          setError('invalidOffer');
        } else if (isDecodeError) {
          setError('invalidOfferFormat');
        } else {
          setError('invalidOffer');
        }
        setConnectionState('error');
        setSignalStatus(null);
      }
    },
    [createPeerInstance, connectionState],
  );

  /** Disconnect and reset */
  const disconnect = useCallback(() => {
    peerRef.current?.destroy();
    peerRef.current = null;
    setConnectionState('idle');
    setLocalSignal(null);
    setSignalStatus(null);
    setTransfers([]);
    setMessages([]);
    setError(null);
    sendQueueRef.current = [];
    isSendingRef.current = false;
    cancelledRef.current.clear();
    incomingRef.current = null;
    currentRoomIdRef.current = null;
    releaseWakeLock();
  }, []);

  // ─── File sending logic ─────────────────────────────────

  const processNextFile = useCallback(async () => {
    if (isSendingRef.current) return;
    isSendingRef.current = true;
    await requestWakeLock();

    try {
      while (sendQueueRef.current.length > 0) {
        const entry = sendQueueRef.current.shift();
        const peer = peerRef.current;
        
        if (!entry || !peer || peer.destroyed) break;

        const { id, file } = entry;
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

        const currentStartTime = Date.now();
        // Mark as transferring
        setTransfers((p) => p.map((t) => (t.id === id ? { ...t, status: 'transferring', startTime: currentStartTime } : t)));

        // Send file metadata
        peer.send(JSON.stringify({ type: 'file-meta', id, name: file.name, size: file.size, totalChunks }));

        let sentBytes = 0;
        let lastProgressUpdate = 0;
        let transferFailed = false;

        for (let i = 0; i < totalChunks; i++) {
          // Check cancel
          if (cancelledRef.current.has(id)) {
            peer.send(JSON.stringify({ type: 'file-cancel' }));
            cancelledRef.current.delete(id);
            setTransfers((p) => p.map((t) => (t.id === id ? { ...t, status: 'cancelled', speed: 0 } : t)));
            transferFailed = true;
            break;
          }

          // Check peer still alive
          if (peer.destroyed) {
            setTransfers((p) => p.map((t) => (t.id === id ? { ...t, status: 'error', speed: 0 } : t)));
            transferFailed = true;
            break;
          }

          // Read chunk from file
          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const chunk = new Uint8Array(await file.slice(start, end).arrayBuffer());

          // Back-pressure
          const channel = (peer as any)._channel as RTCDataChannel | undefined;
          if (channel) {
            while (channel.bufferedAmount > HIGH_WATER_MARK) {
              await sleep(20);
            }
          }

          try {
            peer.send(chunk);
          } catch (e) {
            console.error('[Send Chunk Error]', e);
            setTransfers((p) => p.map((t) => (t.id === id ? { ...t, status: 'error', speed: 0 } : t)));
            transferFailed = true;
            break;
          }
          
          sentBytes += chunk.byteLength;

          const now = Date.now();
          if (now - lastProgressUpdate > PROGRESS_THROTTLE || i === totalChunks - 1) {
            lastProgressUpdate = now;
            const elapsed = (now - currentStartTime) / 1000;
            const speed = elapsed > 0 ? sentBytes / elapsed : 0;
            const progress = Math.min(100, Math.round((sentBytes / file.size) * 100));
            const eta = speed > 0 ? (file.size - sentBytes) / speed : undefined;

            setTransfers((p) => p.map((t) => (t.id === id ? { ...t, progress, speed, eta } : t)));
          }
        }

        // Mark complete
        if (!transferFailed && !cancelledRef.current.has(id)) {
          peer.send(JSON.stringify({ type: 'file-complete' }));
          setTransfers((p) => p.map((x) => (x.id === id ? { ...x, progress: 100, status: 'completed', speed: 0, endTime: Date.now() } : x)));
        }

        // Small breathing room between files
        await sleep(200);
      }
    } catch (err) {
      console.error('[processNextFile error]', err);
    } finally {
      isSendingRef.current = false;
      releaseWakeLock();
    }
  }, []);

  /** Queue files for sending */
  const sendFiles = useCallback(
    (files: File[]) => {
      const newTransfers: FileTransfer[] = [];
      for (const file of files) {
        const id = uid();
        const now = Date.now();
        sendQueueRef.current.push({ id, file });
        newTransfers.push({
          id,
          name: file.name,
          size: file.size,
          progress: 0,
          speed: 0,
          status: 'queued',
          direction: 'send',
          startTime: now,
        });
      }
      setTransfers((p) => [...p, ...newTransfers]);

      if (!isSendingRef.current) {
        processNextFile();
      }
    },
    [processNextFile],
  );

  /** Cancel a transfer by ID */
  const cancelTransfer = useCallback((id: string) => {
    const transfer = transfers.find(t => t.id === id);
    if (!transfer) return;

    cancelledRef.current.add(id);
    
    // If we are receiving or sending an active file, notify peer
    if (transfer.status === 'transferring' && peerRef.current && !peerRef.current.destroyed) {
      peerRef.current.send(JSON.stringify({ type: 'file-cancel', id }));
    }

    // If it's still queued, remove from queue immediately
    sendQueueRef.current = sendQueueRef.current.filter((e) => e.id !== id);
    setTransfers((p) => p.map((t) => (t.id === id && (t.status === 'queued' || t.status === 'transferring') ? { ...t, status: 'cancelled', speed: 0 } : t)));
  }, [transfers]);

  /** Send a chat message */
  const sendMessage = useCallback((text: string) => {
    if (!text.trim() || !peerRef.current || peerRef.current.destroyed) return;
    const timestamp = Date.now();
    peerRef.current.send(JSON.stringify({ type: 'chat', text: text.trim(), timestamp }));
    setMessages((p) => [...p, { id: uid(), text: text.trim(), sender: 'me', timestamp }]);
  }, []);

  return {
    connectionState,
    localSignal,
    signalStatus,
    error,
    transfers,
    messages,
    createOffer,
    acceptOffer,
    disconnect,
    resetConnection: disconnect, // Alias for clarity
    sendFiles,
    sendMessage,
    cancelTransfer,
    clearError: () => setError(null),
  };
}
