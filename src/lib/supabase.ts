/**
 * Supabase Client Configuration
 * 
 * Initializes the Supabase client for WebRTC signaling relay.
 * The client is used to store and retrieve WebRTC signal data (offers/answers)
 * in the webrtc_signals table, enabling QR codes to contain only short room IDs
 * instead of full signal data.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

import { nanoid } from 'nanoid';

/**
 * Type definition for WebRTC signal data
 * This matches the SignalData type from simple-peer
 */
export type SignalData = any;

/**
 * Rate limiting configuration
 */
const RATE_LIMIT_KEY = 'webrtc_room_creation_timestamps';
const MAX_ROOMS_PER_HOUR = 10;
const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Room ID validation regex
 * Accepts 6-8 alphanumeric characters
 */
const ROOM_ID_REGEX = /^[a-zA-Z0-9]{6,8}$/;

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
 * Must be 6-8 alphanumeric characters
 */
function validateRoomId(roomId: string): void {
  if (!ROOM_ID_REGEX.test(roomId)) {
    throw new Error('Invalid room ID format. Must be 6-8 alphanumeric characters.');
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
 * Removes potentially dangerous characters
 */
function sanitizeInput(input: string): string {
  // Remove any characters that aren't alphanumeric
  return input.replace(/[^a-zA-Z0-9]/g, '');
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
  
  // Generate room ID (6-8 characters)
  const roomId = nanoid(8);
  
  try {
    const { error } = await supabase
      .from('webrtc_signals')
      .insert({
        id: roomId,
        offer: offer,
        answer: null,
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes from now
        completed: false,
      });
    
    if (error) {
      console.error('[Supabase] Failed to create room:', error);
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
 * @returns WebRTC offer signal data
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
      .single();
    
    if (error) {
      console.error('[Supabase] Failed to get offer:', error);
      throw new Error(`Room not found or expired: ${error.message}`);
    }
    
    if (!data || !data.offer) {
      throw new Error('Room not found or offer is missing');
    }
    
    return data.offer;
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
    const { error } = await supabase
      .from('webrtc_signals')
      .update({ answer })
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
 * @returns WebRTC answer signal data if available, null otherwise
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
      .single();
    
    if (error) {
      console.error('[Supabase] Failed to poll answer:', error);
      throw new Error(`Room not found or expired: ${error.message}`);
    }
    
    // Return answer if it exists, null otherwise
    return data?.answer || null;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to poll answer due to unknown error');
  }
}

/**
 * Mark a room as completed
 * 
 * This is used for cleanup optimization. Completed rooms can be deleted
 * immediately by the cleanup function instead of waiting for expiration.
 * 
 * @param roomId - Room ID (6-8 characters)
 * @throws Error if room not found or invalid room ID format
 */
export async function markCompleted(roomId: string): Promise<void> {
  // Sanitize and validate room ID
  const sanitizedRoomId = sanitizeInput(roomId);
  validateRoomId(sanitizedRoomId);
  
  try {
    const { error } = await supabase
      .from('webrtc_signals')
      .update({ completed: true })
      .eq('id', sanitizedRoomId);
    
    if (error) {
      console.error('[Supabase] Failed to mark room as completed:', error);
      // Don't throw error - this is optimization, not critical
      // Just log and continue
    }
  } catch (error) {
    // Don't throw error - this is optimization, not critical
    console.warn('Failed to mark room as completed:', error);
  }
}
