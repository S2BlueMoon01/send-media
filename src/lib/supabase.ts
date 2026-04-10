/**
 * Supabase Client Configuration
 * 
 * Initializes the Supabase client for WebRTC signaling relay.
 * The client is used to store and retrieve WebRTC signal data (offers/answers)
 * in the webrtc_signals table, enabling QR codes to contain only short room IDs
 * instead of full signal data.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check .env file.');
}

// Singleton pattern to prevent multiple instances
let supabaseInstance: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false, // Disable auth session for signaling-only use
        autoRefreshToken: false,
      },
    });
  }
  return supabaseInstance;
}

export const supabase = getSupabaseClient();

/**
 * Type definition for WebRTC signal data
 * This matches the SignalData type from simple-peer
 */
export type SignalData = any;

/**
 * Encryption/Decryption utilities using Web Crypto API
 * Encrypts signal data before storing in database for security
 */

/**
 * Generate encryption key from room ID
 * Uses PBKDF2 to derive a key from the room ID
 */
async function deriveKey(roomId: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(roomId),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );
  
  // Use a fixed salt (in production, you might want to store this per-room)
  const salt = encoder.encode('webrtc-signal-encryption-salt-v1');
  
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt signal data
 * @param data - Signal data to encrypt
 * @param roomId - Room ID used as encryption key
 * @returns Encrypted data as base64 string with IV prepended
 */
async function encryptSignal(data: SignalData, roomId: string): Promise<string> {
  try {
    const key = await deriveKey(roomId);
    const encoder = new TextEncoder();
    const dataString = JSON.stringify(data);
    const dataBuffer = encoder.encode(dataString);
    
    // Generate random IV (Initialization Vector)
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Encrypt the data
    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      dataBuffer
    );
    
    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encryptedBuffer), iv.length);
    
    // Convert to base64
    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error('[Encryption] Failed to encrypt signal:', error);
    throw new Error('Failed to encrypt signal data');
  }
}

/**
 * Decrypt signal data
 * @param encryptedData - Encrypted data as base64 string
 * @param roomId - Room ID used as decryption key
 * @returns Decrypted signal data
 */
async function decryptSignal(encryptedData: string, roomId: string): Promise<SignalData> {
  try {
    const key = await deriveKey(roomId);
    
    // Decode base64
    const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
    
    // Extract IV and encrypted data
    const iv = combined.slice(0, 12);
    const encryptedBuffer = combined.slice(12);
    
    // Decrypt the data
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encryptedBuffer
    );
    
    // Convert back to string and parse JSON
    const decoder = new TextDecoder();
    const dataString = decoder.decode(decryptedBuffer);
    return JSON.parse(dataString);
  } catch (error) {
    console.error('[Decryption] Failed to decrypt signal:', error);
    throw new Error('Failed to decrypt signal data');
  }
}

/**
 * Rate limiting configuration
 */
const RATE_LIMIT_KEY = 'webrtc_room_creation_timestamps';
const MAX_ROOMS_PER_HOUR = parseInt(import.meta.env.VITE_MAX_ROOMS_PER_HOUR || '10', 10);
const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Room ID validation regex
 * Accepts 6-8 numeric characters only
 */
const ROOM_ID_REGEX = /^[0-9]{6,8}$/;

/**
 * Check rate limiting for room creation
 * Tracks room creation timestamps in localStorage
 * Limits to MAX_ROOMS_PER_HOUR rooms per hour per client
 */
function checkRateLimit(): void {
  try {
    const now = Date.now();
    const stored = localStorage.getItem(RATE_LIMIT_KEY);
    const timestamps: number[] = stored ? JSON.parse(stored) : [];
    
    // Filter out timestamps older than 1 hour
    const recentTimestamps = timestamps.filter(ts => now - ts < ONE_HOUR_MS);
    
    if (recentTimestamps.length >= MAX_ROOMS_PER_HOUR) {
      throw new Error(`Rate limit exceeded. Maximum ${MAX_ROOMS_PER_HOUR} rooms per hour.`);
    }
    
    // Add current timestamp and save
    recentTimestamps.push(now);
    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(recentTimestamps));
  } catch (error) {
    if (error instanceof Error && error.message.includes('Rate limit')) {
      throw error;
    }
    // If localStorage fails, continue (don't block functionality)
    console.warn('Rate limiting check failed:', error);
  }
}

/**
 * Validate room ID format
 * Must be 6-8 numeric characters only
 */
function validateRoomId(roomId: string): void {
  if (!ROOM_ID_REGEX.test(roomId)) {
    throw new Error('Invalid room ID format. Must be 6-8 numeric characters.');
  }
}

/**
 * Validate signal data structure
 * Ensures signal data is a valid object with required properties
 */
function validateSignalData(signal: SignalData): void {
  if (!signal || typeof signal !== 'object') {
    throw new Error('Invalid signal data. Must be a valid object.');
  }
  
  // Check for required properties based on signal type
  if (signal.type === 'offer' || signal.type === 'answer') {
    if (!signal.sdp || typeof signal.sdp !== 'string') {
      throw new Error('Invalid signal data. Missing or invalid SDP.');
    }
  }
}

/**
 * Sanitize input to prevent injection attacks
 * Removes any characters that aren't numeric
 */
function sanitizeInput(input: string): string {
  // Remove any characters that aren't numeric
  return input.replace(/[^0-9]/g, '');
}

/**
 * Generate a random numeric room ID
 * @param length - Length of the room ID (default 8)
 * @returns Random numeric string
 */
function generateNumericRoomId(length: number = 8): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += Math.floor(Math.random() * 10).toString();
  }
  return result;
}

/**
 * Check if a room ID already exists
 * @param roomId - Room ID to check
 * @returns true if room exists, false otherwise
 */
async function roomExists(roomId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('webrtc_signals')
      .select('id')
      .eq('id', roomId)
      .maybeSingle();
    
    if (error) {
      console.error('[Supabase] Error checking room existence:', error);
      return false; // Assume doesn't exist on error
    }
    
    return data !== null;
  } catch (error) {
    console.error('[Supabase] Error checking room existence:', error);
    return false;
  }
}

/**
 * Generate a unique room ID that doesn't exist in database
 * @param maxRetries - Maximum number of retries (default 5)
 * @returns Unique room ID
 */
async function generateUniqueRoomId(maxRetries: number = 5): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    const roomId = generateNumericRoomId(8);
    const exists = await roomExists(roomId);
    
    if (!exists) {
      return roomId;
    }
    
    console.log(`[Supabase] Room ID ${roomId} already exists, retrying...`);
  }
  
  // If all retries fail, throw error
  throw new Error('Failed to generate unique room ID after multiple attempts');
}

/**
 * Create a new room and store the offer
 * 
 * @param offer - WebRTC offer signal data from simple-peer
 * @returns Room ID (6-8 characters)
 * @throws Error if rate limit exceeded or database operation fails
 */
export async function createRoom(offer: SignalData): Promise<string> {
  // Check rate limiting
  checkRateLimit();
  
  // Validate signal data
  validateSignalData(offer);
  
  // Generate unique room ID (8 numeric characters only)
  const roomId = await generateUniqueRoomId();
  
  try {
    // Encrypt the offer before storing
    const encryptedOffer = await encryptSignal(offer, roomId);
    
    const { error } = await supabase
      .from('webrtc_signals')
      .insert({
        id: roomId,
        offer: encryptedOffer,
        answer: null,
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes from now
        completed: false,
      });
    
    if (error) {
      console.error('[Supabase] Failed to create room:', error);
      
      // If duplicate key error (race condition), retry once
      if (error.code === '23505' || error.message.includes('duplicate')) {
        console.log('[Supabase] Duplicate room ID detected, retrying...');
        const newRoomId = await generateUniqueRoomId();
        const newEncryptedOffer = await encryptSignal(offer, newRoomId);
        
        const { error: retryError } = await supabase
          .from('webrtc_signals')
          .insert({
            id: newRoomId,
            offer: newEncryptedOffer,
            answer: null,
            expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
            completed: false,
          });
        
        if (retryError) {
          throw new Error(`Failed to create room after retry: ${retryError.message}`);
        }
        
        return newRoomId;
      }
      
      throw new Error(`Failed to create room: ${error.message}`);
    }
    
    return roomId;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to create room due to unknown error');
  }
}

/**
 * Retrieve offer from a room by room ID
 * 
 * @param roomId - Room ID (6-8 characters)
 * @returns WebRTC offer signal data (decrypted)
 * @throws Error if room not found or invalid room ID format
 */
export async function getOffer(roomId: string): Promise<SignalData> {
  // Sanitize and validate room ID
  const sanitizedRoomId = sanitizeInput(roomId);
  validateRoomId(sanitizedRoomId);
  
  try {
    const { data, error } = await supabase
      .from('webrtc_signals')
      .select('offer')
      .eq('id', sanitizedRoomId)
      .maybeSingle(); // Use maybeSingle() instead of single() to handle 0 rows gracefully
    
    if (error) {
      console.error('[Supabase] Failed to get offer:', error);
      throw new Error(`Database error: ${error.message}`);
    }
    
    if (!data || !data.offer) {
      throw new Error('roomNotFound');
    }
    
    // Decrypt the offer before returning
    const decryptedOffer = await decryptSignal(data.offer, sanitizedRoomId);
    return decryptedOffer;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to retrieve offer due to unknown error');
  }
}

/**
 * Submit answer to a room
 * 
 * @param roomId - Room ID (6-8 characters)
 * @param answer - WebRTC answer signal data from simple-peer
 * @throws Error if room not found, answer already exists, or invalid input
 */
export async function submitAnswer(roomId: string, answer: SignalData): Promise<void> {
  // Sanitize and validate room ID
  const sanitizedRoomId = sanitizeInput(roomId);
  validateRoomId(sanitizedRoomId);
  
  // Validate signal data
  validateSignalData(answer);
  
  try {
    // Encrypt the answer before storing
    const encryptedAnswer = await encryptSignal(answer, sanitizedRoomId);
    
    const { error } = await supabase
      .from('webrtc_signals')
      .update({ answer: encryptedAnswer })
      .eq('id', sanitizedRoomId)
      .is('answer', null); // RLS policy ensures answer can only be set once
    
    if (error) {
      console.error('[Supabase] Failed to submit answer:', error);
      
      // Check if error is due to answer already existing
      if (error.message.includes('policy') || error.message.includes('violates')) {
        throw new Error('Answer already exists for this room. Cannot overwrite.');
      }
      
      throw new Error(`Failed to submit answer: ${error.message}`);
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to submit answer due to unknown error');
  }
}

/**
 * Poll for answer from a room
 * 
 * This function queries the database once for an answer.
 * The caller should implement polling logic with exponential backoff.
 * 
 * @param roomId - Room ID (6-8 characters)
 * @returns WebRTC answer signal data (decrypted) if available, null otherwise
 * @throws Error if room not found or invalid room ID format
 */
export async function pollAnswer(roomId: string): Promise<SignalData | null> {
  // Sanitize and validate room ID
  const sanitizedRoomId = sanitizeInput(roomId);
  validateRoomId(sanitizedRoomId);
  
  try {
    const { data, error } = await supabase
      .from('webrtc_signals')
      .select('answer')
      .eq('id', sanitizedRoomId)
      .maybeSingle(); // Use maybeSingle() instead of single() to handle 0 rows gracefully
    
    if (error) {
      console.error('[Supabase] Failed to poll answer:', error);
      throw new Error(`Database error: ${error.message}`);
    }
    
    // Return null if room not found or no answer yet
    if (!data || !data.answer) {
      return null;
    }
    
    // Decrypt the answer before returning
    const decryptedAnswer = await decryptSignal(data.answer, sanitizedRoomId);
    return decryptedAnswer;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to poll answer due to unknown error');
  }
}

/**
 * Mark a room as completed and delete it immediately
 * 
 * This is called after successful WebRTC connection.
 * Deletes the room data immediately for security.
 * 
 * @param roomId - Room ID (6-8 characters)
 */
export async function markCompleted(roomId: string): Promise<void> {
  // Sanitize and validate room ID
  const sanitizedRoomId = sanitizeInput(roomId);
  validateRoomId(sanitizedRoomId);
  
  try {
    // Delete the room immediately after connection success
    const { error } = await supabase
      .from('webrtc_signals')
      .delete()
      .eq('id', sanitizedRoomId);
    
    if (error) {
      console.error('[Supabase] Failed to delete room:', error);
      // Don't throw error - this is cleanup, not critical
      // Just log and continue
    } else {
      console.log(`[Supabase] Room ${sanitizedRoomId} deleted successfully after connection`);
    }
  } catch (error) {
    // Don't throw error - this is cleanup, not critical
    console.warn('Failed to delete room:', error);
  }
}
