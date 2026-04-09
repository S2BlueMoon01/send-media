import { describe, it, expect } from 'vitest';
import { deriveFileEncryptionKey, encryptChunk, decryptChunk, encryptFile, decryptFile } from './encryption';

describe('File Encryption', () => {
  const testRoomId = '12345678';
  const testData = new TextEncoder().encode('Hello, this is a test file content!');

  it('should derive encryption key from room ID', async () => {
    const key = await deriveFileEncryptionKey(testRoomId);
    expect(key).toBeDefined();
    expect(key.type).toBe('secret');
  });

  it('should encrypt and decrypt a chunk correctly', async () => {
    const key = await deriveFileEncryptionKey(testRoomId);
    const encrypted = await encryptChunk(testData, key);
    
    // Encrypted data should be longer (IV + auth tag)
    expect(encrypted.byteLength).toBeGreaterThan(testData.byteLength);
    
    const decrypted = await decryptChunk(encrypted, key);
    expect(decrypted).toEqual(testData);
    
    // Verify content
    const decryptedText = new TextDecoder().decode(decrypted);
    expect(decryptedText).toBe('Hello, this is a test file content!');
  });

  it('should fail to decrypt with wrong room ID', async () => {
    const key1 = await deriveFileEncryptionKey(testRoomId);
    const key2 = await deriveFileEncryptionKey('87654321');
    
    const encrypted = await encryptChunk(testData, key1);
    
    // Should throw error when decrypting with wrong key
    await expect(decryptChunk(encrypted, key2)).rejects.toThrow();
  });

  it('should encrypt and decrypt a file', async () => {
    const key = await deriveFileEncryptionKey(testRoomId);
    const file = new File([testData], 'test.txt', { type: 'text/plain' });
    
    const encrypted = await encryptFile(file, key);
    expect(encrypted.byteLength).toBeGreaterThan(testData.byteLength);
    
    const decrypted = await decryptFile(encrypted, key);
    expect(decrypted).toEqual(testData);
  });

  it('should use unique IV for each encryption', async () => {
    const key = await deriveFileEncryptionKey(testRoomId);
    
    const encrypted1 = await encryptChunk(testData, key);
    const encrypted2 = await encryptChunk(testData, key);
    
    // IVs should be different (first 12 bytes)
    const iv1 = encrypted1.slice(0, 12);
    const iv2 = encrypted2.slice(0, 12);
    
    expect(iv1).not.toEqual(iv2);
  });
});
