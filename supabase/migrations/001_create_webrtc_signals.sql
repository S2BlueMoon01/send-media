-- Create webrtc_signals table for storing WebRTC signaling data
CREATE TABLE webrtc_signals (
  id TEXT PRIMARY KEY,                    -- Room ID (6-8 char nanoid)
  offer TEXT,                             -- Encrypted SDP offer from sender (base64)
  answer TEXT,                            -- Encrypted SDP answer from receiver (base64)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '5 minutes',
  completed BOOLEAN DEFAULT FALSE
);

-- Add index on expires_at for cleanup queries
CREATE INDEX idx_expires_at ON webrtc_signals(expires_at);

-- Add comment to table
COMMENT ON TABLE webrtc_signals IS 'Stores encrypted WebRTC signaling data (SDP offers/answers) for P2P connection establishment';
COMMENT ON COLUMN webrtc_signals.id IS 'Short room ID (6-8 characters) used in QR codes';
COMMENT ON COLUMN webrtc_signals.offer IS 'Encrypted WebRTC SDP offer from sender (AES-GCM encrypted, base64 encoded)';
COMMENT ON COLUMN webrtc_signals.answer IS 'Encrypted WebRTC SDP answer from receiver (AES-GCM encrypted, base64 encoded)';
COMMENT ON COLUMN webrtc_signals.expires_at IS 'Automatic expiration time (5 minutes after creation)';
COMMENT ON COLUMN webrtc_signals.completed IS 'Flag indicating connection was successfully established';
