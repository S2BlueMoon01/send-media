/**
 * End-to-End Encryption for File Transfer
 * 
 * Uses AES-GCM 256-bit encryption to encrypt files before sending over WebRTC.
 * The encryption key is derived from the room ID, ensuring only sender and receiver
 * who know the room ID can encrypt/decrypt the files.
 */

const CHUNK_SIZE = 64 * 1024; // 64KB chunks for encryption

/**
 * Derive encryption key from room ID using PBKDF2
 * Same key derivation as signal encryption for consistency
 */
export async function deriveFileEncryptionKey(roomId: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(roomId),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );
  
  // Use a different salt for file encryption vs signal encryption
  const salt = encoder.encode('webrtc-file-encryption-salt-v1');
  
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
 * Encrypt a file chunk
 * @param chunk - File chunk as Uint8Array
 * @param key - Encryption key
 * @returns Encrypted chunk with IV prepended (IV + encrypted data)
 */
export async function encryptChunk(chunk: Uint8Array, key: CryptoKey): Promise<Uint8Array> {
  // Generate random IV for this chunk
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Encrypt the chunk
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    chunk as BufferSource
  );
  
  // Combine IV + encrypted data
  const result = new Uint8Array(iv.length + encrypted.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(encrypted), iv.length);
  
  return result;
}

/**
 * Decrypt a file chunk
 * @param encryptedChunk - Encrypted chunk with IV prepended
 * @param key - Decryption key
 * @returns Decrypted chunk as Uint8Array
 */
export async function decryptChunk(encryptedChunk: Uint8Array, key: CryptoKey): Promise<Uint8Array> {
  // Extract IV and encrypted data
  const iv = encryptedChunk.slice(0, 12);
  const encrypted = encryptedChunk.slice(12);
  
  // Decrypt the chunk
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encrypted as BufferSource
  );
  
  return new Uint8Array(decrypted);
}

/**
 * Encrypt an entire file
 * Useful for small files that can be encrypted in one go
 * @param file - File to encrypt
 * @param key - Encryption key
 * @returns Encrypted file data with IV prepended
 */
export async function encryptFile(file: File, key: CryptoKey): Promise<Uint8Array> {
  const fileData = new Uint8Array(await file.arrayBuffer());
  return encryptChunk(fileData as Uint8Array, key);
}

/**
 * Decrypt an entire file
 * @param encryptedData - Encrypted file data with IV prepended
 * @param key - Decryption key
 * @returns Decrypted file data as Uint8Array
 */
export async function decryptFile(encryptedData: Uint8Array, key: CryptoKey): Promise<Uint8Array> {
  return decryptChunk(encryptedData, key);
}

/**
 * Calculate overhead size for encryption
 * Each chunk gets 12 bytes IV + 16 bytes GCM auth tag
 */
export function getEncryptionOverhead(originalSize: number, chunkSize: number = CHUNK_SIZE): number {
  const numChunks = Math.ceil(originalSize / chunkSize);
  return numChunks * (12 + 16); // 12 bytes IV + 16 bytes auth tag per chunk
}
