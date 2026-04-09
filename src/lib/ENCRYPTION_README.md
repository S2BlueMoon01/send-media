# End-to-End Encryption Implementation

## Overview

This application implements true end-to-end encryption for file transfers using AES-GCM 256-bit encryption.

## What is Encrypted?

1. **WebRTC Signaling Data** (offer/answer) - Encrypted before storing in database
2. **File Data** - Encrypted before transmission over WebRTC DataChannel

## How It Works

### Key Derivation
Both sender and receiver derive the same encryption key from the room ID using PBKDF2:
- **Algorithm**: PBKDF2
- **Iterations**: 100,000
- **Hash**: SHA-256
- **Output**: 256-bit AES key

### File Encryption Process

**Sender Side:**
1. User selects files to send
2. Files are read in 64KB chunks
3. Each chunk is encrypted with AES-GCM using the derived key
4. A unique random IV (12 bytes) is generated for each chunk
5. Encrypted chunks are sent over WebRTC DataChannel

**Receiver Side:**
1. Receives encrypted chunks over WebRTC DataChannel
2. Extracts IV from each chunk (first 12 bytes)
3. Decrypts chunk using the derived key
4. Assembles decrypted chunks into complete file
5. Triggers download

## Security Features

- **Zero-Knowledge**: Server never has access to encryption keys or decrypted data
- **Unique IVs**: Each chunk uses a random IV, preventing pattern analysis
- **Authentication**: AES-GCM provides both encryption and authentication
- **Key Derivation**: Strong PBKDF2 with 100,000 iterations
- **Automatic Cleanup**: Room data deleted after successful connection

## Files

- `src/lib/encryption.ts` - Core encryption/decryption functions
- `src/lib/encryption.test.ts` - Unit tests for encryption
- `src/hooks/useWebRTC.ts` - Integration with WebRTC file transfer
- `supabase/ENCRYPTION.md` - Detailed encryption documentation

## Testing

Run encryption tests:
```bash
npm test src/lib/encryption.test.ts
```

## Performance

- **Chunk Size**: 64KB (balances memory and performance)
- **Overhead**: ~28 bytes per chunk (12 bytes IV + 16 bytes auth tag)
- **Async Processing**: Non-blocking encryption/decryption
- **Memory Efficient**: Sequential chunk processing

## Browser Compatibility

Uses Web Crypto API, supported in all modern browsers:
- Chrome/Edge 37+
- Firefox 34+
- Safari 11+
- Opera 24+
