-- Enable Row Level Security on webrtc_signals table
ALTER TABLE webrtc_signals ENABLE ROW LEVEL SECURITY;

-- Policy 1: Allow insert offer
-- Anyone can create a room with an offer (answer must be NULL)
CREATE POLICY "Allow insert offer" ON webrtc_signals
  FOR INSERT 
  WITH CHECK (offer IS NOT NULL AND answer IS NULL);

-- Policy 2: Allow read by id
-- Anyone can read a room by ID
CREATE POLICY "Allow read by id" ON webrtc_signals
  FOR SELECT 
  USING (true);

-- Policy 3: Allow update answer once
-- Only allow updating answer once (prevent overwrite attacks)
-- Can only update if answer is currently NULL, and must set answer to non-NULL
CREATE POLICY "Allow update answer once" ON webrtc_signals
  FOR UPDATE 
  USING (answer IS NULL) 
  WITH CHECK (answer IS NOT NULL);

-- Add comments to policies
COMMENT ON POLICY "Allow insert offer" ON webrtc_signals IS 'Allows anyone to create a new room with an offer';
COMMENT ON POLICY "Allow read by id" ON webrtc_signals IS 'Allows anyone to read room data by ID';
COMMENT ON POLICY "Allow update answer once" ON webrtc_signals IS 'Allows updating answer only once to prevent overwrite attacks';
