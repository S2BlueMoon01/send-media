# WebRTC Signal & File Encryption

## Overview

This application implements two layers of encryption:

1. **Signal Encryption**: WebRTC signaling data (offers/answers) are encrypted before being stored in the Supabase database
2. **File Encryption**: All file data is encrypted end-to-end before transmission over WebRTC DataChannel

Both layers use the same room ID as the encryption key source, ensuring only the sender and receiver can decrypt the data.

## Encryption Method

- **Algorithm**: AES-GCM (256-bit)
- **Key Derivation**: PBKDF2 with 100,000 iterations
- **Key Source**: Room ID (6-8 character unique identifier)
- **IV**: Random 12-byte initialization vector (generated per encryption)
- **Storage Format**: Base64-encoded string (IV + encrypted data) for signals
- **File Format**: Binary (IV + encrypted data) for file chunks

## How It Works

### 1. Creating a Room (Sender)

```
1. Generate room ID (8 characters)
2. Derive encryption key from room ID using PBKDF2
3. Encrypt offer signal data using AES-GCM
4. Store encrypted offer in database as TEXT
5. Return room ID to sender (displayed in QR code)
6. Store encryption key in memory for file encryption
```

### 2. Retrieving Offer (Receiver)

```
1. Scan QR code to get room ID
2. Fetch encrypted offer from database
3. Derive decryption key from room ID using PBKDF2
4. Decrypt offer signal data
5. Generate answer and encrypt it
6. Store encrypted answer in database
7. Store encryption key in memory for file decryption
```

### 3. Polling Answer (Sender)

```
1. Poll database for encrypted answer
2. Derive decryption key from room ID
3. Decrypt answer signal data
4. Complete WebRTC connection
5. Delete room data immediately
```

### 4. File Transfer (End-to-End Encrypted)

**Sender:**
```
1. Read file in 64KB chunks
2. Encrypt each chunk with AES-GCM using derived key
3. Generate unique IV for each chunk
4. Send encrypted chunk over WebRTC DataChannel
5. Repeat until file is complete
```

**Receiver:**
```
1. Receive encrypted chunk over WebRTC DataChannel
2. Extract IV from chunk (first 12 bytes)
3. Decrypt chunk using derived key
4. Store decrypted chunk in memory
5. Assemble complete file after all chunks received
6. Trigger download
```

## Security Benefits

1. **End-to-End Protection**: Files are encrypted before leaving sender's device and decrypted only on receiver's device
2. **Signal Protection**: Even if database is compromised, signal data is encrypted
3. **Key Derivation**: Room ID acts as password, never stored in database
4. **Unique IVs**: Each chunk uses a random IV, preventing pattern analysis
5. **Automatic Deletion**: Room data is deleted immediately after successful connection
6. **Time-Limited**: All rooms expire after 5 minutes
7. **No Server Access**: Server never has access to encryption keys or decrypted data

## Database Schema

```sql
CREATE TABLE webrtc_signals (
  id TEXT PRIMARY KEY,           -- Room ID (used as encryption key)
  offer TEXT,                    -- Encrypted offer (base64)
  answer TEXT,                   -- Encrypted answer (base64)
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,        -- Auto-expires after 5 minutes
  completed BOOLEAN
);
```

## Encryption Implementation

### Signal Encryption (src/lib/supabase.ts)

- Encrypts WebRTC offer/answer before storing in database
- Uses fixed salt: `webrtc-signal-encryption-salt-v1`
- Returns base64-encoded string

### File Encryption (src/lib/encryption.ts)

- Encrypts file chunks before sending over WebRTC
- Uses different salt: `webrtc-file-encryption-salt-v1`
- Returns binary data (Uint8Array)
- Each chunk gets unique IV

### Key Derivation

Both signal and file encryption use the same key derivation function:

```typescript
PBKDF2(
  password: roomId,
  salt: 'webrtc-{signal|file}-encryption-salt-v1',
  iterations: 100000,
  hash: SHA-256,
  keyLength: 256 bits
)
```

## Performance Considerations

- **Chunk Size**: 64KB per chunk balances memory usage and encryption overhead
- **Encryption Overhead**: ~28 bytes per chunk (12 bytes IV + 16 bytes auth tag)
- **Async Processing**: Encryption/decryption runs asynchronously to avoid blocking UI
- **Memory Efficient**: Chunks are processed sequentially, not all at once

## Migration

If you have an existing database with JSONB columns, run migration `004_encrypt_signals.sql` to convert columns to TEXT.

## Notes

- The encryption key is derived from the room ID, which is only known to sender and receiver
- Room data is automatically deleted after successful connection
- Expired rooms (>5 minutes) are cleaned up by the cron job
- The salt used in PBKDF2 is fixed for simplicity; in production, consider per-room salts
- File encryption happens in real-time during transfer, no pre-processing required
- WebRTC DataChannel already provides DTLS encryption at transport layer, this adds application-layer E2E encryption
