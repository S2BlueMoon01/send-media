# Implementation Plan

## Phase 1: Bug Condition Exploration Tests (BEFORE Fix)

- [x] 1. Write bug condition exploration test for camera overlay misalignment
  - **Property 1: Bug Condition** - Camera Overlay Misalignment
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate overlay misalignment exists
  - **Scoped PBT Approach**: Test on multiple devices (iPhone 13, Samsung Galaxy, iPad) with different viewport sizes
  - Test that overlay position matches video stream position (from Bug Condition in design)
  - Verify overlay center aligns with video center (pixel-perfect within 1px tolerance)
  - Verify overlay corners align with video corners
  - Test with different aspect ratios (1:1, 4:3, 16:9)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found (e.g., "overlay offset by 20px on iPhone 13", "corners misaligned by 15px on Samsung Galaxy")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 2.1, 2.2_

- [x] 2. Write bug condition exploration test for QR code size
  - **Property 1: Bug Condition** - QR Code Too Large
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate QR codes are too large
  - **Scoped PBT Approach**: Generate WebRTC offers and measure QR code character count
  - Test that QR code character count is < 100 (from Bug Condition in design)
  - Test that QR code contains only room ID (6-8 characters) not full signal data
  - Measure actual character count of current QR codes (will be >2000)
  - Test scanning speed on mobile devices (will take >30 seconds or fail)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found (e.g., "QR code contains 2847 characters", "scanning takes 45 seconds or fails")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.3, 1.4, 1.5, 1.6, 2.3, 2.4, 2.5_

- [x] 3. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - P2P File Transfer and Chat
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: Transfer files on unfixed code, record transfer protocol, chunking, progress tracking
  - Observe: Send chat messages on unfixed code, verify messages use WebRTC data channel
  - Observe: Test manual copy/paste signaling on unfixed code, verify connection works
  - Write property-based test: for all file transfers after WebRTC connection, files transfer P2P without touching Supabase
  - Write property-based test: for all chat messages, messages use WebRTC data channel
  - Write property-based test: for all manual signaling flows, connection completes successfully
  - Verify tests pass on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

## Phase 2: Supabase Setup

- [x] 4. Set up Supabase project and database schema
  
  - [x] 4.1 Create Supabase project
    - Create new Supabase project or use existing
    - Note project URL and anon key for environment variables
    - _Requirements: 2.6, 2.7, 2.8_
  
  - [x] 4.2 Create webrtc_signals table
    - Create table with schema from design document
    - Fields: id (TEXT PRIMARY KEY), offer (JSONB), answer (JSONB), created_at (TIMESTAMPTZ), expires_at (TIMESTAMPTZ), completed (BOOLEAN)
    - Add index on expires_at for cleanup queries
    - _Requirements: 2.6, 2.7, 2.8, 2.9_
  
  - [x] 4.3 Enable Row Level Security (RLS)
    - Enable RLS on webrtc_signals table
    - Create policy: "Allow insert offer" - anyone can create room with offer
    - Create policy: "Allow read by id" - anyone can read room by ID
    - Create policy: "Allow update answer once" - only allow updating answer once (prevent overwrite attacks)
    - _Requirements: 2.11_
  
  - [x] 4.4 Create edge function for auto-cleanup (optional)
    - Create edge function cleanup-signals/index.ts
    - Implement logic to delete expired signals (expires_at < NOW())
    - Schedule function to run every 5 minutes using Supabase cron
    - _Requirements: 2.9_
  
  - [x] 4.5 Add environment variables
    - Add VITE_SUPABASE_URL to .env
    - Add VITE_SUPABASE_ANON_KEY to .env
    - Update .env.example with placeholder values
    - _Requirements: 2.6, 2.7, 2.8_

## Phase 3: Camera Overlay Alignment Fix

- [x] 5. Fix camera overlay alignment in QRScanner component
  
  - [x] 5.1 Fix container positioning
    - Ensure parent container of video and overlay has position: relative
    - Set explicit width: 100% and height: 100% on container
    - Remove conflicting positioning on video element
    - _Bug_Condition: isBugCondition_Overlay(input) where input.cameraOpen = true_
    - _Expected_Behavior: overlay position matches video stream position_
    - _Preservation: Camera error handling and fallback logic unchanged_
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 3.7_
  
  - [x] 5.2 Align overlay with video dimensions
    - Use position: absolute with inset-0 on overlay container
    - Match aspect ratio of video stream (1:1 for 640x640)
    - Account for object-fit: contain on video by centering overlay frame
    - _Bug_Condition: isBugCondition_Overlay(input) where overlayPosition != videoStreamPosition_
    - _Expected_Behavior: overlay center = video center, overlay dimensions = video dimensions_
    - _Preservation: Scanning functionality unchanged_
    - _Requirements: 1.1, 1.2, 2.1, 2.2_
  
  - [x] 5.3 Constrain scanning frame
    - Center inner scanning frame (250x250px) using flexbox
    - Ensure dimensions match expected QR code scanning area
    - Apply backdrop-blur only on frame, not affecting positioning
    - _Bug_Condition: isBugCondition_Overlay(input) where userCannotAlignQRCode_
    - _Expected_Behavior: user can position QR code within overlay and scan successfully_
    - _Preservation: Scanning frame visual style unchanged_
    - _Requirements: 1.2, 2.2_
  
  - [x] 5.4 Test across aspect ratios
    - Test with 640x640 (1:1 square) video stream
    - Test with 640x480 (4:3) video stream
    - Test with container having different aspect ratio (letterboxing)
    - Verify overlay adapts correctly in all cases
    - _Bug_Condition: isBugCondition_Overlay(input) for all aspect ratios_
    - _Expected_Behavior: overlay aligns correctly regardless of aspect ratio_
    - _Preservation: Video stream quality and camera selection unchanged_
    - _Requirements: 1.1, 1.2, 2.1, 2.2_

## Phase 4: Signaling Relay Implementation

- [x] 6. Install dependencies
  - Add @supabase/supabase-js@^2.39.0 to package.json
  - Add nanoid@^5.0.4 to package.json
  - Run npm install
  - _Requirements: 2.6, 2.7, 2.8_

- [x] 7. Create Supabase client and signaling functions
  
  - [x] 7.1 Create src/lib/supabase.ts
    - Initialize Supabase client with project URL and anon key from env
    - Export supabase client instance
    - _Requirements: 2.6, 2.7, 2.8_
  
  - [x] 7.2 Implement createRoom function
    - Accept offer: SignalData as parameter
    - Generate room ID using nanoid (6-8 characters)
    - Store offer in webrtc_signals table
    - Return room ID
    - Add error handling for database failures
    - _Bug_Condition: isBugCondition_QRSize(input) where length(encodeSignal(input.signalData)) > 2000_
    - _Expected_Behavior: return short room ID (<100 characters)_
    - _Preservation: Signal data structure unchanged_
    - _Requirements: 1.6, 2.3, 2.6_
  
  - [x] 7.3 Implement getOffer function
    - Accept roomId: string as parameter
    - Validate room ID format (6-8 alphanumeric characters)
    - Fetch offer from webrtc_signals table by ID
    - Return SignalData or throw error if not found
    - _Bug_Condition: isBugCondition_QRSize(input) where QR code contains room ID_
    - _Expected_Behavior: retrieve full offer from Supabase_
    - _Preservation: Offer data structure unchanged_
    - _Requirements: 2.7, 2.12_
  
  - [x] 7.4 Implement submitAnswer function
    - Accept roomId: string and answer: SignalData as parameters
    - Validate room ID format
    - Update webrtc_signals table with answer
    - Handle "answer already exists" error (RLS policy prevents overwrite)
    - _Bug_Condition: isBugCondition_QRSize(input) where answer needs to be transmitted_
    - _Expected_Behavior: store answer in Supabase for sender to poll_
    - _Preservation: Answer data structure unchanged_
    - _Requirements: 2.7, 2.11, 2.12_
  
  - [x] 7.5 Implement pollAnswer function
    - Accept roomId: string as parameter
    - Query webrtc_signals table for answer
    - Return SignalData if answer exists, null otherwise
    - Add exponential backoff for polling (start at 1s, max 5s)
    - _Bug_Condition: isBugCondition_QRSize(input) where sender waits for answer_
    - _Expected_Behavior: return answer when available_
    - _Preservation: Connection timeout logic unchanged_
    - _Requirements: 2.8_
  
  - [x] 7.6 Implement markCompleted function
    - Accept roomId: string as parameter
    - Update webrtc_signals table to set completed = true
    - Used for cleanup optimization (completed rooms can be deleted immediately)
    - _Requirements: 2.9_
  
  - [x] 7.7 Add rate limiting
    - Implement client-side rate limiting using localStorage
    - Track number of room creations per session
    - Limit to 10 rooms per hour per client
    - Show error message if limit exceeded
    - _Requirements: 2.10_
  
  - [x] 7.8 Add input validation
    - Validate room ID format (regex: /^[a-zA-Z0-9]{6,8}$/)
    - Validate signal data structure before storing
    - Sanitize inputs to prevent injection attacks
    - _Requirements: 2.12_

## Phase 5: WebRTC Hook Modifications

- [x] 8. Modify useWebRTC hook to use Supabase signaling
  
  - [x] 8.1 Update createOffer function
    - After peer.on('signal') fires, call createRoom(data) instead of encodeSignal(data)
    - Store room ID in localSignal state (instead of encoded signal)
    - Update signalStatus to 'ready'
    - Start polling for answer automatically (call pollForAnswer helper)
    - Add error handling for Supabase failures
    - _Bug_Condition: isBugCondition_QRSize(input) where offer is generated_
    - _Expected_Behavior: localSignal contains short room ID_
    - _Preservation: Peer connection initialization unchanged_
    - _Requirements: 1.6, 2.3, 2.6, 2.8_
  
  - [x] 8.2 Update acceptOffer function
    - Check if input is room ID (length <= 10) or full signal (backward compatibility)
    - If room ID: call getOffer(roomId) to fetch offer from Supabase
    - If full signal: use decodeSignal (backward compatibility)
    - Store room ID in ref for later use
    - After peer.on('signal') fires with answer, call submitAnswer(roomId, answerData)
    - Add error handling for Supabase failures
    - _Bug_Condition: isBugCondition_QRSize(input) where receiver scans QR code_
    - _Expected_Behavior: fetch offer from Supabase, generate answer, submit to Supabase_
    - _Preservation: Peer connection establishment unchanged_
    - _Requirements: 2.7, 2.12, 3.6_
  
  - [x] 8.3 Remove acceptAnswer function
    - Delete acceptAnswer function (no longer needed)
    - Sender now polls for answer automatically
    - Update exports to remove acceptAnswer
    - _Bug_Condition: isBugCondition_QRSize(input) where sender waits for answer_
    - _Expected_Behavior: automatic polling replaces manual answer input_
    - _Preservation: Connection flow simplified_
    - _Requirements: 2.8_
  
  - [x] 8.4 Add pollForAnswer helper function
    - Accept roomId and peer instance as parameters
    - Poll Supabase every 3 seconds for answer (max 60 attempts = 3 minutes)
    - When answer received, call peer.signal(answer)
    - Call markCompleted(roomId) after successful connection
    - Handle timeout (show error after 3 minutes)
    - Handle peer destruction (stop polling if peer is destroyed)
    - _Bug_Condition: isBugCondition_QRSize(input) where sender waits for answer_
    - _Expected_Behavior: automatic polling retrieves answer and completes connection_
    - _Preservation: Connection timeout duration unchanged (180 seconds)_
    - _Requirements: 2.8, 2.9_
  
  - [x] 8.5 Update connection cleanup
    - In peer.on('connect'), call markCompleted(roomId) if room ID exists
    - Ensure cleanup happens on disconnect and error states
    - _Requirements: 2.9, 3.5_
  
  - [x] 8.6 Add currentRoomIdRef
    - Create useRef to store current room ID
    - Used for tracking room across async operations
    - Clear on disconnect
    - _Requirements: 2.8, 2.9_

## Phase 6: UI Component Updates

- [x] 9. Update SenderSetup component
  
  - [x] 9.1 Remove answer input UI
    - Remove QRScanner for accepting answer (no longer needed)
    - Remove Input field for pasting answer (no longer needed)
    - Remove acceptAnswer button (no longer needed)
    - _Bug_Condition: isBugCondition_QRSize(input) where sender waits for answer_
    - _Expected_Behavior: automatic polling eliminates need for manual answer input_
    - _Preservation: Offer display and QR code generation unchanged_
    - _Requirements: 2.8_
  
  - [x] 9.2 Update instructions text
    - Change text to "Share this QR code with receiver"
    - Remove mention of waiting for answer
    - Add "Waiting for receiver to scan..." loading state while polling
    - _Requirements: 2.8_
  
  - [x] 9.3 Add polling status indicator
    - Show loading spinner while polling for answer
    - Show "Waiting for receiver..." message
    - Update to "Connecting..." when answer received
    - _Requirements: 2.8_

- [x] 10. Update ReceiverSetup component
  
  - [x] 10.1 Update instructions text
    - Change text to "Scan sender's QR code or enter room ID"
    - Update placeholder text in input field to "Enter room ID"
    - _Requirements: 2.7_
  
  - [x] 10.2 Update input validation
    - Accept both room IDs (6-8 characters) and full signals (backward compatibility)
    - Show appropriate error messages for invalid formats
    - _Requirements: 2.7, 2.12, 3.6_

## Phase 7: Fix Verification Tests

- [x] 11. Verify bug condition exploration test for camera overlay now passes
  - **Property 1: Expected Behavior** - Camera Overlay Alignment
  - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
  - The test from task 1 encodes the expected behavior
  - When this test passes, it confirms the expected behavior is satisfied
  - Run bug condition exploration test from step 1
  - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
  - Verify overlay position matches video stream position on all devices
  - Verify overlay center aligns with video center (pixel-perfect)
  - Verify overlay corners align with video corners
  - Verify alignment works with different aspect ratios
  - _Requirements: 2.1, 2.2_

- [x] 12. Verify bug condition exploration test for QR code size now passes
  - **Property 1: Expected Behavior** - QR Code Size Reduction
  - **IMPORTANT**: Re-run the SAME test from task 2 - do NOT write a new test
  - The test from task 2 encodes the expected behavior
  - When this test passes, it confirms the expected behavior is satisfied
  - Run bug condition exploration test from step 2
  - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
  - Verify QR code character count is < 100
  - Verify QR code contains only room ID (6-8 characters)
  - Verify scanning speed is < 5 seconds on mobile devices
  - _Requirements: 2.3, 2.4, 2.5_

- [x] 13. Verify preservation tests still pass
  - **Property 2: Preservation** - P2P File Transfer and Chat
  - **IMPORTANT**: Re-run the SAME tests from task 3 - do NOT write new tests
  - Run preservation property tests from step 3
  - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
  - Verify file transfers still work P2P (no data through Supabase)
  - Verify chat messages still use WebRTC data channel
  - Verify manual signaling flow still works (with room IDs)
  - Confirm all tests still pass after fix (no regressions)
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

## Phase 8: Additional Testing

- [x] 14. Unit tests for Supabase signaling functions
  - Test createRoom with valid offer, assert room ID returned
  - Test getOffer with valid room ID, assert offer retrieved
  - Test submitAnswer with valid answer, assert stored successfully
  - Test pollAnswer, assert returns null initially, then answer after submission
  - Test markCompleted, assert room marked as completed
  - Test room ID validation (reject invalid formats)
  - Test signal data validation (reject malformed signals)
  - Test rate limiting (reject after 10 rooms per hour)
  - _Requirements: 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12_

- [x] 15. Unit tests for camera overlay CSS
  - Test overlay positioning with different video dimensions
  - Test overlay alignment with different aspect ratios
  - Test scanning frame centering
  - Test responsive behavior on window resize
  - _Requirements: 2.1, 2.2_

- [x] 16. Unit tests for QR code generation
  - Test QR code generation with short room IDs (<100 chars)
  - Test QR code character count
  - Test QR code density (visual inspection)
  - _Requirements: 2.3, 2.4, 2.5_

- [x] 17. Integration tests
  
  - [x] 17.1 Full sender flow
    - Create offer → store in Supabase → display QR code → poll for answer → connect
    - Verify each step completes successfully
    - Verify connection established
    - _Requirements: 2.6, 2.8_
  
  - [x] 17.2 Full receiver flow
    - Scan QR code → fetch offer from Supabase → generate answer → submit answer → connect
    - Verify each step completes successfully
    - Verify connection established
    - _Requirements: 2.7_
  
  - [x] 17.3 Full file transfer flow
    - Connect → send file → verify received → disconnect
    - Verify file transfers P2P (no data through Supabase)
    - Verify file integrity
    - _Requirements: 3.1, 3.2_
  
  - [x] 17.4 Full chat flow
    - Connect → send messages → verify received → disconnect
    - Verify messages use WebRTC data channel
    - Verify message order preserved
    - _Requirements: 3.3_
  
  - [x] 17.5 Cleanup flow
    - Create room → wait 5 minutes → verify room auto-deleted
    - Test edge function cleanup (if implemented)
    - _Requirements: 2.9_
  
  - [x] 17.6 Error recovery flow
    - Trigger error → reset connection → retry → verify success
    - Test various error scenarios (invalid room ID, network failure, timeout)
    - _Requirements: 3.7_
  
  - [x] 17.7 Backward compatibility
    - Test manual copy/paste with full signal (old behavior)
    - Test manual copy/paste with room ID (new behavior)
    - Verify both work correctly
    - _Requirements: 3.6_

- [x] 18. Mobile E2E tests
  
  - [x] 18.1 iOS Safari test
    - Test camera overlay alignment on iPhone 13
    - Test QR code scanning speed
    - Test full connection flow
    - _Requirements: 2.1, 2.2, 2.4_
  
  - [x] 18.2 Android Chrome test
    - Test camera overlay alignment on Samsung Galaxy
    - Test QR code scanning speed
    - Test full connection flow
    - _Requirements: 2.1, 2.2, 2.4_
  
  - [x] 18.3 iPad test
    - Test camera overlay alignment in portrait and landscape
    - Test QR code scanning speed
    - Test full connection flow
    - _Requirements: 2.1, 2.2, 2.4_
  
  - [x] 18.4 Real QR scan test
    - Display QR code on laptop screen
    - Scan with mobile device
    - Verify successful scan in < 5 seconds
    - Verify connection established
    - _Requirements: 2.4, 2.5_

- [x] 19. Checkpoint - Ensure all tests pass
  - Verify all unit tests pass
  - Verify all integration tests pass
  - Verify all E2E tests pass
  - Verify no regressions in existing functionality
  - Ask user if any questions or issues arise
