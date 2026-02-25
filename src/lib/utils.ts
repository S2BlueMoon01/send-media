import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import pako from 'pako';

/** Key mapping to reduce signaling payload size */
const KEY_MAP: Record<string, string> = {
  type: 't',
  sdp: 's',
};

const REV_KEY_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(KEY_MAP).map(([k, v]) => [v, k])
);

/** 
 * Minify SDP by stripping non-essential lines (codecs, etc) 
 * We only need ICE candidates, ufrag, pwd, and fingerprint for data channel
 */
function minifySDP(sdp: string): string {
  // Normalize and split by any newline variant, then filter out empty lines
  return sdp.split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => {
      if (!line) return false;

      // Essential structural lines to keep
      if (line.startsWith('a=mid:') || line.startsWith('a=msid-semantic:')) return true;

      // BLACKLIST: only strip high-volume media-specific junk
      // We keep everything else (structural, candidates, sctp, crypto)
      const isMediaJunk = 
        line.startsWith('a=rtpmap') || 
        line.startsWith('a=fmtp') || 
        line.startsWith('a=rtcp-fb') || 
        line.startsWith('a=ssrc') || 
        line.startsWith('a=extmap') ||
        line.startsWith('a=msid:'); // msid: (media) is junk, msid-semantic (session) is keep
        
      return !isMediaJunk;
    })
    .join('\r\n') + '\r\n'; // CRITICAL: Every SDP line MUST end with CRLF (\r\n)
}

/** Restore standard SDP headers and line endings */
function restoreSDP(minified: string): string {
  if (!minified) return '';
  // Ensure we have correct CRLF variant
  let s = minified.replace(/\r?\n/g, '\r\n');
  // Ensure the entire block ends with CRLF
  if (!s.endsWith('\r\n')) s += '\r\n';
  return s;
}

/** Encode signaling data to a highly compact base64 string for QR */
export function encodeSignal(data: any): string {
  try {
    const payload = { ...data };
    
    // Minify SDP if present
    if (payload.sdp && typeof payload.sdp === 'string') {
      payload.sdp = minifySDP(payload.sdp);
    }

    // 1. Map keys to shorter versions
    const mapped: any = {};
    for (const [k, v] of Object.entries(payload)) {
      const newKey = KEY_MAP[k] || k;
      mapped[newKey] = v;
    }

    // 2. Stringify and Compress
    const json = JSON.stringify(mapped);
    const compressed = pako.deflate(json);

    // 3. Convert to Base64 (No prefix for maximum simplicity)
    const binaryString = Array.from(compressed)
      .map((byte) => String.fromCharCode(byte))
      .join('');
    
    return btoa(binaryString);
  } catch (err) {
    console.warn('Encoding failed:', err);
    // Fallback just in case, but usually not needed with simple data
    return btoa(JSON.stringify(data));
  }
}

/** Decode signaling string (optimized compressed path only) */
export function decodeSignal(encoded: string): object {
  const input = encoded.trim();
  
  try {
    // 1. Convert Base64 back to binary bytes
    const binaryString = atob(input);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // 2. Inflate and Parse JSON
    const decompressed = pako.inflate(bytes, { to: 'string' });
    const mapped = JSON.parse(decompressed);
    
    // 3. Reverse map keys
    const data: any = {};
    for (const [k, v] of Object.entries(mapped)) {
      const originalKey = REV_KEY_MAP[k] || k;
      data[originalKey] = v;
    }

    // 4. Restore SDP if minified
    if (data.sdp && typeof data.sdp === 'string') {
      data.sdp = restoreSDP(data.sdp);
    }

    return data;
  } catch (err) {
    // If it fails, maybe it was legacy JSON? Try simple parse
    try {
      return JSON.parse(atob(input));
    } catch (e2) {
      console.error('Decoding failed:', err);
      throw new Error('Failed to decode signaling data');
    }
  }
}

/** Format bytes to human-readable string */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/** Format seconds to human-readable duration */
export function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return '--';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

/** Generate a short unique ID */
export function uid(): string {
  return crypto.randomUUID();
}

/** Sleep helper */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
/** Format timestamp to DD/MM/YYYY HH:mm:ss */
export function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}
