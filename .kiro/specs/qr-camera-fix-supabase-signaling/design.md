# QR Camera Fix & Supabase Signaling Bugfix Design

## Overview

This bugfix addresses two critical issues affecting mobile user experience in the P2P file transfer application:

1. **Camera Overlay Misalignment**: The scanning overlay (4-corner brackets) in QRScanner component is misaligned with the actual video stream, preventing users from properly positioning QR codes for scanning.

2. **QR Code Size Problem**: Current QR codes embed entire WebRTC signal data (SDP offer/answer + ICE candidates) via base64 encoding, resulting in >2000 character QR codes that are too dense to scan reliably on mobile devices.

The fix strategy involves:
- CSS/layout corrections to align the overlay with the video stream using proper positioning and aspect ratio constraints
- Implementing a Supabase-based signaling relay server that stores WebRTC signals in a database, allowing QR codes to contain only short room IDs (6-8 characters)
- Maintaining full P2P encryption and file transfer (Supabase only relays signaling, not file data)

## Glossary

- **Bug_Condition (C)**: The conditions that trigger the bugs - overlay misalignment when camera opens, and QR codes >2000 characters that are difficult to scan
- **Property (P)**: The desired behavior - overlay perfectly aligned with video stream, and QR codes containing only short room IDs (<100 characters)
- **Preservation**: Existing P2P WebRTC connection, file transfer protocol, chat functionality, and manual copy/paste signaling that must remain unchanged
- **html5-qrcode**: The library used in QRScanner that renders video stream and provides scanning functionality
- **simple-peer**: The WebRTC library that generates SDP offers/answers and ICE candidates for P2P connections
- **Signaling Data**: WebRTC connection metadata (SDP offer/answer + ICE candidates) that must be exchanged between peers before P2P connection
- **Room ID**: A short unique identifier (6-8 characters) that references signaling data stored in Supabase
- **RLS (Row Level Security)**: Supabase security feature that restricts database access at the row level
- **Trickle ICE**: WebRTC feature for sending ICE candidates incrementally (currently disabled with `trickle: false`)

## Bug Details

### Bug Condition

The bugs manifest in two distinct scenarios:

**Bug 1: Camera Overlay Misalignment**

The bug occurs when a user opens the camera to scan a QR code on any mobile device. The `QRScanner` component renders a video stream via html5-qrcode library and overlays a scanning frame with 4-corner brackets. The overlay positioning is either not properly constrained to the video dimensions, uses incorrect CSS positioning (absolute vs relative), or doesn't account for the video's `object-fit` behavior, causing the visual scanning frame to appear in a different location than where the camera is actually capturing.

**Bug 2: QR Code Size**

The bug occurs when the system generates a QR code for WebRTC signaling. The `useWebRTC` hook's `createOffer()` and `acceptOffer()` functions generate signal data containing full SDP descriptions and ICE candidates. This data is base64-encoded via `encodeSignal()` and passed to `QRDisplay` component, which uses `qrcode.react` library to render the QR code. The resulting QR code contains >2000 characters, creating an extremely dense matrix that is difficult or impossible to scan on mobile devices.

**Formal Specification:**
```
FUNCTION isBugCondition_Overlay(input)
  INPUT: input of type { cameraOpen: boolean, deviceType: string }
  OUTPUT: boolean
  
  RETURN input.cameraOpen = true
         AND overlayPosition != videoStreamPosition
         AND userCannotAlignQRCode
END FUNCTION

FUNCTION isBugCondition_QRSize(input)
  INPUT: input of type { signalData: WebRTCSignal }
  OUTPUT: boolean
  
  RETURN length(encodeSignal(input.signalData)) > 2000
         AND qrCodeDensity = "very high"
         AND scanningDifficulty = "hard" OR "impossible"
END FUNCTION
```

### Examples

**Bug 1 Examples:**
- User opens camera on iPhone 13, sees scanning brackets in center of screen, but QR code must be positioned 20px lower to actually scan
- User opens camera on Samsung Galaxy, scanning overlay appears offset to the left by 15px from actual video capture area
- User on iPad sees scanning frame that doesn't match the aspect ratio of the video stream, making it unclear where to position QR code
- Edge case: On devices with notches or unusual aspect ratios, overlay may be partially off-screen while video is visible

**Bug 2 Examples:**
- Sender creates offer, QR code contains 2,847 characters of base64-encoded SDP + ICE data, appears as extremely dense black/white pattern
- Receiver attempts to scan large QR code, scanning takes 30+ seconds or fails entirely due to complexity
- User views QR code on phone screen, cannot distinguish individual modules due to high density
- Edge case: On low-resolution displays, QR code modules become smaller than 1 pixel, making scanning impossible

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- P2P WebRTC data channel file transfer must continue to work exactly as before (files never touch Supabase)
- Chunked file transfer protocol (64KB chunks, control messages, progress tracking) must remain unchanged
- Mini chat functionality over WebRTC data channel must continue to work
- Manual copy/paste signaling flow must continue to work (but will paste room IDs instead of full signals)
- Connection timeout logic (180 seconds) must remain unchanged
- Wake lock and visibility change handling must remain unchanged
- Error handling for WebRTC connection failures must remain unchanged
- ICE server configuration and connection establishment flow must remain unchanged

**Scope:**
All inputs that do NOT involve camera overlay rendering or QR code generation should be completely unaffected by this fix. This includes:
- File selection and queuing logic
- WebRTC peer connection establishment after signaling
- Data channel message handling
- Transfer progress calculation and UI updates
- Chat message sending and receiving
- Connection state management
- Cleanup and disconnect logic

## Hypothesized Root Cause

Based on the bug description and code analysis, the most likely issues are:

### Bug 1: Camera Overlay Misalignment

1. **Incorrect CSS Positioning**: The overlay container uses `absolute` positioning without proper parent `relative` positioning, or the positioning values (top/left/inset) don't account for the video element's actual rendered dimensions.

2. **Aspect Ratio Mismatch**: The video stream has a specific aspect ratio (e.g., 640x640 or 4:3), but the overlay container assumes a different aspect ratio. The video uses `object-fit: contain` which may add letterboxing, but the overlay doesn't account for this.

3. **Parent Container Issues**: The `#qr-reader` container that html5-qrcode renders into may not have proper dimensions or positioning, causing child elements (video and overlay) to be misaligned.

4. **Z-index and Pointer Events**: The overlay uses `pointer-events-none` correctly, but the stacking context or transform properties may cause visual misalignment even if logical positioning is correct.

### Bug 2: QR Code Size

1. **Direct Signal Embedding**: The current architecture directly embeds WebRTC signal data into QR codes via `encodeSignal(data)` which base64-encodes the entire SDP offer/answer plus all ICE candidates.

2. **No Signaling Server**: The application uses manual signaling (copy/paste or QR scan) without any relay server, requiring all connection metadata to be transmitted directly between peers.

3. **Trickle ICE Disabled**: The `trickle: false` configuration in simple-peer bundles all ICE candidates into a single signal, increasing the payload size significantly.

4. **No Compression**: The signal data is base64-encoded but not compressed before encoding, missing an opportunity to reduce size.

## Correctness Properties

Property 1: Bug Condition - Camera Overlay Alignment

_For any_ input where the camera is opened for QR scanning (isBugCondition_Overlay returns true), the fixed QRScanner component SHALL render the scanning overlay (4-corner brackets) in exact alignment with the video stream's visible area, such that when a user positions a QR code within the overlay frame, the QR code is correctly positioned within the camera's capture area and can be successfully scanned.

**Validates: Requirements 2.1, 2.2**

Property 2: Bug Condition - QR Code Size Reduction

_For any_ input where a WebRTC signal is generated for QR code display (isBugCondition_QRSize returns true), the fixed system SHALL store the signal data in Supabase and generate a QR code containing only a short room ID (<100 characters), such that the QR code has low density, is easily visible on mobile screens, and can be scanned quickly and reliably.

**Validates: Requirements 2.3, 2.4, 2.5, 2.6, 2.7, 2.8**

Property 3: Preservation - P2P File Transfer

_For any_ file transfer operation after WebRTC connection is established (isBugCondition returns false), the fixed system SHALL produce exactly the same behavior as the original system, preserving the P2P data channel transfer protocol, chunking logic, progress tracking, and ensuring no file data passes through Supabase.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

Property 4: Preservation - Manual Signaling Flow

_For any_ user interaction with copy/paste signaling inputs (isBugCondition returns false), the fixed system SHALL continue to support manual signaling, accepting room IDs instead of full signal data, fetching signals from Supabase, and completing the connection flow.

**Validates: Requirements 3.6, 3.7**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

#### Part 1: Camera Overlay Alignment Fix

**File**: `src/components/QRScanner.tsx`

**Function**: Component render logic (JSX)

**Specific Changes**:

1. **Fix Container Positioning**: Ensure the parent container of the video and overlay has explicit dimensions and `position: relative`:
   - The outer `<div>` with `id="qr-reader"` parent should have `position: relative` and explicit `width: 100%` and `height: 100%`
   - Remove any conflicting positioning on the video element itself

2. **Align Overlay with Video Dimensions**: The overlay container (with the 4-corner brackets) should:
   - Use `position: absolute` with `inset-0` to fill the entire video container
   - Match the aspect ratio of the video stream (currently requesting 640x640, which is 1:1)
   - Account for `object-fit: contain` on the video by centering the overlay frame

3. **Constrain Scanning Frame**: The inner scanning frame (250x250px div with corner brackets) should:
   - Be centered within the video stream using flexbox on the parent
   - Have dimensions that match the expected QR code scanning area
   - Use `backdrop-blur` only on the frame itself, not affecting positioning

4. **Test Across Aspect Ratios**: Ensure the fix works when:
   - Video stream is 640x640 (1:1 square)
   - Video stream is 640x480 (4:3)
   - Container has different aspect ratio than video (letterboxing occurs)

5. **Add Visual Debug Aid** (optional, for development): Add a semi-transparent border to the video element itself to verify alignment during testing

#### Part 2: Supabase Signaling Relay Implementation

**Database Schema**:

Create a new Supabase table `webrtc_signals`:

```sql
CREATE TABLE webrtc_signals (
  id TEXT PRIMARY KEY,                    -- Room ID (6-8 char nanoid)
  offer JSONB,                            -- SDP offer from sender
  answer JSONB,                           -- SDP answer from receiver
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '5 minutes',
  completed BOOLEAN DEFAULT FALSE
);

-- Auto-cleanup expired signals
CREATE INDEX idx_expires_at ON webrtc_signals(expires_at);

-- RLS Policies
ALTER TABLE webrtc_signals ENABLE ROW LEVEL SECURITY;

-- Anyone can create a room (offer)
CREATE POLICY "Allow insert offer" ON webrtc_signals
  FOR INSERT WITH CHECK (offer IS NOT NULL AND answer IS NULL);

-- Anyone can read a room by ID
CREATE POLICY "Allow read by id" ON webrtc_signals
  FOR SELECT USING (true);

-- Only allow updating answer once (prevent overwrite attacks)
CREATE POLICY "Allow update answer once" ON webrtc_signals
  FOR UPDATE USING (answer IS NULL) WITH CHECK (answer IS NOT NULL);
```

**File**: `src/lib/supabase.ts` (new file)

**Specific Changes**:

1. **Create Supabase Client**: Initialize Supabase client with project URL and anon key
   ```typescript
   import { createClient } from '@supabase/supabase-js'
   
   const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
   const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
   
   export const supabase = createClient(supabaseUrl, supabaseAnonKey)
   ```

2. **Implement Signaling Functions**:
   - `createRoom(offer: SignalData): Promise<string>` - Creates room, stores offer, returns room ID
   - `getOffer(roomId: string): Promise<SignalData>` - Retrieves offer by room ID
   - `submitAnswer(roomId: string, answer: SignalData): Promise<void>` - Stores answer for room
   - `pollAnswer(roomId: string): Promise<SignalData | null>` - Polls for answer (with timeout)
   - `markCompleted(roomId: string): Promise<void>` - Marks room as completed for cleanup

3. **Add Rate Limiting**: Implement client-side rate limiting using localStorage:
   - Track number of room creations per IP/session
   - Limit to 10 rooms per hour per client
   - Show error message if limit exceeded

4. **Add Input Validation**:
   - Validate room ID format (6-8 alphanumeric characters)
   - Validate signal data structure before storing
   - Sanitize inputs to prevent injection attacks

**File**: `src/hooks/useWebRTC.ts`

**Function**: `createOffer`, `acceptOffer`, `acceptAnswer`

**Specific Changes**:

1. **Modify `createOffer`**: Instead of returning encoded signal directly:
   ```typescript
   const createOffer = useCallback(async () => {
     setError(null);
     setLocalSignal(null);
     setSignalStatus('gathering');
     setConnectionState('connecting');
     
     const peer = createPeerInstance(true);
     
     // Wait for signal event
     peer.once('signal', async (data) => {
       try {
         // Store offer in Supabase and get room ID
         const roomId = await createRoom(data);
         setLocalSignal(roomId); // Set room ID instead of full signal
         setSignalStatus('ready');
         setConnectionState('waiting-for-peer');
         
         // Start polling for answer
         pollForAnswer(roomId, peer);
       } catch (err) {
         setError('Failed to create room');
         setConnectionState('error');
       }
     });
   }, [createPeerInstance]);
   ```

2. **Modify `acceptOffer`**: Accept room ID, fetch offer from Supabase:
   ```typescript
   const acceptOffer = useCallback(async (roomIdOrSignal: string) => {
     if (!roomIdOrSignal.trim()) return;
     
     try {
       setError(null);
       setSignalStatus('gathering');
       setConnectionState('connecting');
       
       let offerSignal: SignalData;
       
       // Check if input is room ID (short) or full signal (long, for backward compat)
       if (roomIdOrSignal.length <= 10) {
         // It's a room ID, fetch offer from Supabase
         offerSignal = await getOffer(roomIdOrSignal);
         currentRoomIdRef.current = roomIdOrSignal;
       } else {
         // It's a full signal (backward compatibility)
         offerSignal = decodeSignal(roomIdOrSignal);
       }
       
       const peer = createPeerInstance(false);
       peer.signal(offerSignal);
       
       // Wait for answer signal
       peer.once('signal', async (answerData) => {
         if (currentRoomIdRef.current) {
           // Submit answer to Supabase
           await submitAnswer(currentRoomIdRef.current, answerData);
         } else {
           // Fallback to old behavior (encode answer for manual copy/paste)
           setLocalSignal(encodeSignal(answerData));
         }
         setSignalStatus('ready');
       });
     } catch (err) {
       setError('Failed to accept offer');
       setConnectionState('error');
     }
   }, [createPeerInstance]);
   ```

3. **Remove `acceptAnswer`**: No longer needed as sender polls for answer automatically

4. **Add `pollForAnswer` helper**:
   ```typescript
   const pollForAnswer = async (roomId: string, peer: Peer.Instance) => {
     const maxAttempts = 60; // 60 attempts * 3 seconds = 3 minutes
     let attempts = 0;
     
     const poll = async () => {
       if (attempts >= maxAttempts || peer.destroyed) {
         setError('Timeout waiting for answer');
         setConnectionState('error');
         return;
       }
       
       const answer = await pollAnswer(roomId);
       if (answer) {
         peer.signal(answer);
         await markCompleted(roomId);
       } else {
         attempts++;
         setTimeout(poll, 3000); // Poll every 3 seconds
       }
     };
     
     poll();
   };
   ```

5. **Update Connection Cleanup**: Mark room as completed when connection succeeds:
   ```typescript
   peer.on('connect', async () => {
     setConnectionState('connected');
     if (currentRoomIdRef.current) {
       await markCompleted(currentRoomIdRef.current);
     }
   });
   ```

**File**: `src/components/SenderSetup.tsx` and `src/components/ReceiverSetup.tsx`

**Specific Changes**:

1. **Remove Answer Input UI**: In `SenderSetup`, remove the QRScanner and Input for accepting answer (no longer needed as polling is automatic)

2. **Update Instructions**: Change text to reflect new flow:
   - Sender: "Share this QR code with receiver" (no mention of waiting for answer)
   - Receiver: "Scan sender's QR code or enter room ID"

3. **Add Loading State**: Show "Waiting for receiver to scan..." on sender side while polling

**File**: `package.json`

**Specific Changes**:

1. **Add Supabase Dependency**:
   ```json
   "dependencies": {
     "@supabase/supabase-js": "^2.39.0",
     // ... existing dependencies
   }
   ```

2. **Add nanoid for Room ID Generation**:
   ```json
   "dependencies": {
     "nanoid": "^5.0.4",
     // ... existing dependencies
   }
   ```

**Environment Variables** (`.env`):

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**Supabase Edge Function** (optional, for auto-cleanup):

Create an edge function that runs periodically to delete expired signals:

```typescript
// supabase/functions/cleanup-signals/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const { error } = await supabase
    .from('webrtc_signals')
    .delete()
    .lt('expires_at', new Date().toISOString())

  return new Response(JSON.stringify({ success: !error }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

Schedule this function to run every 5 minutes using Supabase cron jobs.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bugs on unfixed code, then verify the fixes work correctly and preserve existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bugs BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

#### Bug 1: Camera Overlay Alignment

**Test Plan**: Create a test page that renders the QRScanner component and overlays a semi-transparent grid on top of the video stream. Manually test on multiple devices and use browser DevTools to inspect element positions. Run these tests on the UNFIXED code to observe misalignment.

**Test Cases**:
1. **iPhone 13 Safari Test**: Open camera, measure pixel offset between overlay center and video center (will show misalignment on unfixed code)
2. **Samsung Galaxy Chrome Test**: Open camera, verify overlay corners align with video corners (will fail on unfixed code)
3. **iPad Landscape Test**: Open camera in landscape, check if overlay maintains aspect ratio (may fail on unfixed code)
4. **Desktop Chrome Test**: Open camera on desktop with webcam, verify overlay scales correctly (baseline test)
5. **Aspect Ratio Test**: Mock video stream with 4:3 aspect ratio, verify overlay adapts (may fail on unfixed code)

**Expected Counterexamples**:
- Overlay appears offset by 10-30px from video center on mobile devices
- Overlay corners don't align with video corners
- Possible causes: incorrect absolute positioning, missing relative parent, aspect ratio mismatch

#### Bug 2: QR Code Size

**Test Plan**: Generate WebRTC offers using the current system, measure QR code character count and visual density. Attempt to scan generated QR codes on real mobile devices. Run these tests on the UNFIXED code to observe scanning failures.

**Test Cases**:
1. **Character Count Test**: Create offer, log `localSignal.length` (will show >2000 on unfixed code)
2. **QR Density Test**: Render QR code, count modules per inch (will show very high density on unfixed code)
3. **Mobile Scan Test**: Display QR code on laptop, attempt to scan with phone (will take 30+ seconds or fail on unfixed code)
4. **Visual Clarity Test**: View QR code on phone screen, assess if individual modules are visible (will fail on unfixed code)
5. **Network Conditions Test**: Test with poor network (high latency), verify ICE gathering completes (baseline test)

**Expected Counterexamples**:
- QR codes contain 2000-3000 characters
- Scanning takes >30 seconds or fails entirely
- QR code appears as solid black square on small screens
- Possible causes: full signal embedding, no compression, trickle ICE disabled

### Fix Checking

**Goal**: Verify that for all inputs where the bug conditions hold, the fixed functions produce the expected behavior.

#### Bug 1: Camera Overlay Alignment

**Pseudocode:**
```
FOR ALL device IN [iPhone13, SamsungGalaxy, iPad, Desktop] DO
  FOR ALL orientation IN [portrait, landscape] DO
    openCamera(device, orientation)
    overlayPosition := getOverlayPosition()
    videoPosition := getVideoPosition()
    ASSERT overlayPosition.center = videoPosition.center
    ASSERT overlayPosition.width = videoPosition.width
    ASSERT overlayPosition.height = videoPosition.height
  END FOR
END FOR
```

**Test Cases**:
1. **Pixel-Perfect Alignment Test**: Measure overlay and video positions, assert difference < 1px
2. **Corner Alignment Test**: Verify all 4 corners of overlay align with video corners
3. **Aspect Ratio Test**: Test with different video aspect ratios (1:1, 4:3, 16:9), verify overlay adapts
4. **Responsive Test**: Resize browser window, verify overlay remains aligned
5. **Real QR Scan Test**: Position real QR code in overlay frame, verify successful scan

#### Bug 2: QR Code Size Reduction

**Pseudocode:**
```
FOR ALL signalType IN [offer, answer] DO
  signal := generateSignal(signalType)
  roomId := createRoom(signal)
  ASSERT length(roomId) < 100
  ASSERT roomId matches /^[a-zA-Z0-9]{6,8}$/
  
  qrCode := generateQRCode(roomId)
  ASSERT qrCode.characterCount < 100
  ASSERT qrCode.density = "low"
  
  scanTime := measureScanTime(qrCode)
  ASSERT scanTime < 5 seconds
END FOR
```

**Test Cases**:
1. **Room ID Length Test**: Create room, assert room ID is 6-8 characters
2. **QR Character Count Test**: Generate QR code with room ID, assert <100 characters
3. **Supabase Storage Test**: Create room, verify offer is stored in database
4. **Supabase Retrieval Test**: Fetch offer by room ID, verify it matches original
5. **Answer Submission Test**: Submit answer, verify it's stored and retrievable
6. **Polling Test**: Sender polls for answer, verify answer is received within 10 seconds
7. **Mobile Scan Speed Test**: Scan QR code on mobile, assert scan completes in <5 seconds
8. **Connection Success Test**: Complete full flow (create room → scan → connect), verify WebRTC connection established

### Preservation Checking

**Goal**: Verify that for all inputs where the bug conditions do NOT hold, the fixed functions produce the same result as the original functions.

**Pseudocode:**
```
FOR ALL operation IN [fileTransfer, chat, disconnect, errorHandling] DO
  ASSERT fixedSystem(operation) = originalSystem(operation)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for file transfers and chat, then write property-based tests capturing that behavior.

**Test Cases**:

1. **File Transfer Preservation**: 
   - Observe: Send 10 files of varying sizes on unfixed code, record transfer times and success rate
   - Test: After fix, send same 10 files, assert transfer times and success rate are within 5% of original
   - Verify: No file data passes through Supabase (check network tab)

2. **Chunking Protocol Preservation**:
   - Observe: Monitor data channel messages on unfixed code, record message types and order
   - Test: After fix, monitor data channel messages, assert same message types and order
   - Verify: file-meta, binary chunks, file-complete messages are identical

3. **Chat Preservation**:
   - Observe: Send 20 chat messages on unfixed code, verify all received
   - Test: After fix, send 20 chat messages, assert all received in same order
   - Verify: Chat messages use WebRTC data channel, not Supabase

4. **Manual Signaling Preservation**:
   - Observe: Copy/paste full signal on unfixed code, verify connection works
   - Test: After fix, copy/paste room ID, verify connection works
   - Verify: System detects room ID vs full signal and handles both

5. **Error Handling Preservation**:
   - Observe: Trigger various errors on unfixed code (invalid signal, connection timeout, ICE failure)
   - Test: After fix, trigger same errors, assert same error messages and recovery behavior
   - Verify: Error states and user feedback are identical

6. **Connection Timeout Preservation**:
   - Observe: Let connection attempt timeout on unfixed code (180 seconds), record behavior
   - Test: After fix, let connection timeout, assert same behavior
   - Verify: Timeout duration and error message unchanged

7. **Wake Lock Preservation**:
   - Observe: Start file transfer on unfixed code, verify screen stays awake
   - Test: After fix, start file transfer, verify screen stays awake
   - Verify: Wake lock behavior identical

8. **Visibility Change Preservation**:
   - Observe: Background tab during signaling on unfixed code, verify warning toast
   - Test: After fix, background tab during signaling, verify same warning toast
   - Verify: Toast message and behavior identical

### Unit Tests

- Test `createRoom()` function with valid offer, assert room ID returned
- Test `getOffer()` function with valid room ID, assert offer retrieved
- Test `submitAnswer()` function with valid answer, assert stored successfully
- Test `pollAnswer()` function, assert returns null initially, then answer after submission
- Test `markCompleted()` function, assert room marked as completed
- Test room ID validation (reject invalid formats)
- Test signal data validation (reject malformed signals)
- Test rate limiting (reject after 10 rooms per hour)
- Test CSS overlay positioning with different video dimensions
- Test QR code generation with short room IDs (<100 chars)
- Test backward compatibility with full signal copy/paste

### Property-Based Tests

- Generate random signal data, create rooms, verify all room IDs are 6-8 characters
- Generate random room IDs, verify only valid IDs (matching regex) are accepted
- Generate random file sets, transfer via fixed system, verify all files received correctly
- Generate random chat messages, send via fixed system, verify all messages received in order
- Generate random connection sequences (offer → answer → connect), verify all succeed
- Test camera overlay alignment across random viewport sizes and aspect ratios

### Integration Tests

- **Full Sender Flow**: Create offer → store in Supabase → display QR code → poll for answer → connect
- **Full Receiver Flow**: Scan QR code → fetch offer from Supabase → generate answer → submit answer → connect
- **Full File Transfer Flow**: Connect → send file → verify received → disconnect
- **Full Chat Flow**: Connect → send messages → verify received → disconnect
- **Cleanup Flow**: Create room → wait 5 minutes → verify room auto-deleted
- **Error Recovery Flow**: Trigger error → reset connection → retry → verify success
- **Mobile E2E Flow**: Test complete flow on real mobile devices (iOS Safari, Android Chrome)
- **Camera Overlay E2E**: Open camera → scan real QR code → verify successful scan on multiple devices
