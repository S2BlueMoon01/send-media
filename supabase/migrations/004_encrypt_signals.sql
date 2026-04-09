-- Migration to change offer and answer columns from JSONB to TEXT for encrypted data
-- This migration drops RLS policies, alters columns, then recreates policies

DO $$ 
BEGIN
  -- Only proceed if table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'webrtc_signals'
  ) THEN
    
    -- Step 1: Drop existing RLS policies that depend on these columns
    DROP POLICY IF EXISTS "Allow insert offer" ON webrtc_signals;
    DROP POLICY IF EXISTS "Allow read by id" ON webrtc_signals;
    DROP POLICY IF EXISTS "Allow update answer once" ON webrtc_signals;
    
    -- Step 2: Alter columns from JSONB to TEXT
    ALTER TABLE webrtc_signals ALTER COLUMN offer TYPE TEXT USING offer::TEXT;
    ALTER TABLE webrtc_signals ALTER COLUMN answer TYPE TEXT USING answer::TEXT;
    
    -- Step 3: Update column comments
    COMMENT ON COLUMN webrtc_signals.offer IS 'Encrypted WebRTC SDP offer from sender (AES-GCM encrypted, base64 encoded)';
    COMMENT ON COLUMN webrtc_signals.answer IS 'Encrypted WebRTC SDP answer from receiver (AES-GCM encrypted, base64 encoded)';
    COMMENT ON TABLE webrtc_signals IS 'Stores encrypted WebRTC signaling data (SDP offers/answers) for P2P connection establishment';
    
    -- Step 4: Recreate RLS policies with updated column types
    -- Policy 1: Allow insert offer
    CREATE POLICY "Allow insert offer" ON webrtc_signals
      FOR INSERT 
      WITH CHECK (offer IS NOT NULL AND answer IS NULL);
    
    -- Policy 2: Allow read by id
    CREATE POLICY "Allow read by id" ON webrtc_signals
      FOR SELECT 
      USING (true);
    
    -- Policy 3: Allow update answer once
    CREATE POLICY "Allow update answer once" ON webrtc_signals
      FOR UPDATE 
      USING (answer IS NULL) 
      WITH CHECK (answer IS NOT NULL);
    
    -- Add comments to policies
    COMMENT ON POLICY "Allow insert offer" ON webrtc_signals IS 'Allows anyone to create a new room with an encrypted offer';
    COMMENT ON POLICY "Allow read by id" ON webrtc_signals IS 'Allows anyone to read room data by ID';
    COMMENT ON POLICY "Allow update answer once" ON webrtc_signals IS 'Allows updating encrypted answer only once to prevent overwrite attacks';
    
  END IF;
END $$;
