# WebRTC Signal Encryption

## Overview

All WebRTC signaling data (offers and answers) are encrypted before being stored in the Supabase database. This provides an additional layer of security beyond HTTPS and RLS policies.

## Encryption Method

- **Algorithm**: AES-GCM (256-bit)
- **Key Derivation**: PBKDF2 with 100,000 iterations
- **Key Source**: Room ID (6-8 character unique identifier)
- **IV**: Random 12-byte initialization vector (generated per encryption)
- **Storage Format**: Base64-encoded string (IV + encrypted data)

## How It Works

### 1. Creating a Room (Sender)

```
1. Generate room ID (8 characters)
2. Derive encryption key from room ID using PBKDF2
3. Encrypt offer signal data using AES-GCM
4. Store encrypted offer in database as TEXT
5. Return room ID to sender (displayed in QR code)
```

### 2. Retrieving Offer (Receiver)

```
1. Scan QR code to get room ID
2. Fetch encrypted offer from database
3. Derive decryption key from room ID using PBKDF2
4. Decrypt offer signal data
5. Generate answer and encrypt it
6. Store encrypted answer in database
```

### 3. Polling Answer (Sender)

```
1. Poll database for encrypted answer
2. Derive decryption key from room ID
3. Decrypt answer signal data
4. Complete WebRTC connection
5. Delete room data immediately
```

## Security Benefits

1. **End-to-End Protection**: Even if database is compromised, signal data is encrypted
2. **Key Derivation**: Room ID acts as password, never stored in database
3. **Unique IVs**: Each encryption uses a random IV, preventing pattern analysis
4. **Automatic Deletion**: Room data is deleted immediately after successful connection
5. **Time-Limited**: All rooms expire after 5 minutes

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

## Migration

If you have an existing database with JSONB columns, run migration `004_encrypt_signals.sql` to convert columns to TEXT.

## Notes

- The encryption key is derived from the room ID, which is only known to sender and receiver
- Room data is automatically deleted after successful connection
- Expired rooms (>5 minutes) are cleaned up by the cron job
- The salt used in PBKDF2 is fixed for simplicity; in production, consider per-room salts
