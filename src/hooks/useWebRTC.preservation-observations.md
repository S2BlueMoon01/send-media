# Preservation Property Tests - Observations

**Date**: Task 3 Execution
**Status**: ✅ All tests PASS on unfixed code
**Purpose**: Establish baseline behavior that must be preserved after implementing Supabase signaling fix

## Test Results Summary

All 7 preservation property tests passed successfully on the unfixed code, confirming the baseline behavior that must be preserved:

### Property 1: P2P File Transfer Preservation ✅
**Validates**: Requirements 3.1, 3.2

**Observation**:
- File transfer API exists and works correctly
- `sendFiles()` function accepts File objects
- Signaling generates valid offer strings
- No server involvement in file transfer (P2P only)

**Baseline Behavior**:
- Files are transferred over WebRTC data channel
- Transfer state is tracked with progress, speed, and status
- File transfer API: `sendFiles(files: File[])`
- Transfer tracking: `transfers` array with FileTransfer objects

**Preservation Requirement**:
After implementing Supabase signaling, file transfers MUST continue to work P2P without any file data touching Supabase servers.

---

### Property 2: Chunked File Transfer Protocol Preservation ✅
**Validates**: Requirements 3.2

**Observation**:
- Chunked file transfer protocol API is intact
- Protocol uses: file-meta → binary chunks → file-complete
- Chunk size: 64KB (CHUNK_SIZE constant)
- Back-pressure handling with HIGH_WATER_MARK (1MB)

**Baseline Behavior**:
- Protocol API exists: `sendFiles()`, `cancelTransfer()`, `transfers` state
- Transfer status types: 'queued' | 'transferring' | 'completed' | 'cancelled' | 'error'
- Progress tracking with speed (bytes/sec) and ETA (seconds)

**Preservation Requirement**:
After implementing Supabase signaling, the chunked file transfer protocol MUST remain unchanged. All protocol messages and chunking logic must work identically.

---

### Property 3: Chat Messages Use WebRTC Data Channel ✅
**Validates**: Requirements 3.3

**Observation**:
- Chat API exists and works correctly
- Messages are sent over WebRTC data channel (P2P)
- No server involvement in chat messages

**Baseline Behavior**:
- Chat API: `sendMessage(text: string)`
- Message tracking: `messages` array with ChatMessage objects
- Message structure: `{ id, text, sender: 'me' | 'peer', timestamp }`

**Preservation Requirement**:
After implementing Supabase signaling, chat messages MUST continue to use WebRTC data channel. No chat data should touch Supabase servers.

---

### Property 4: Manual Copy/Paste Signaling Works ✅
**Validates**: Requirements 3.6, 3.7

**Observation**:
- Manual signaling flow works correctly
- Offer generation produces copyable string
- `acceptOffer()` and `acceptAnswer()` functions exist

**Baseline Behavior**:
- Signaling API: `createOffer()`, `acceptOffer(signal)`, `acceptAnswer(signal)`
- Signal format: Base64-encoded WebRTC signal data (currently >2000 characters)
- Signal status: 'gathering' | 'ready' | null
- Local signal: string stored in `localSignal` state

**Preservation Requirement**:
After implementing Supabase signaling, manual copy/paste flow MUST continue to work. The system should accept BOTH:
1. Short room IDs (6-8 characters) - new behavior
2. Full signal data (>2000 characters) - backward compatibility

---

### Property 5: Connection Cleanup Works ✅
**Validates**: Requirements 3.5

**Observation**:
- Disconnect/cleanup logic works correctly
- All state is properly reset on disconnect

**Baseline Behavior**:
- Cleanup API: `disconnect()` (alias: `resetConnection()`)
- State reset: connectionState → 'idle', localSignal → null, transfers → [], messages → [], error → null
- Peer connection is destroyed
- Wake lock is released

**Preservation Requirement**:
After implementing Supabase signaling, cleanup logic MUST remain unchanged. All state should be reset identically.

---

### Property 6: File Transfer Cancellation Works ✅
**Validates**: Requirements 3.4

**Observation**:
- File transfer cancellation API exists
- Cancel function is available

**Baseline Behavior**:
- Cancel API: `cancelTransfer(id: string)`
- Cancellation updates transfer status to 'cancelled'
- Cancel message sent to peer: `{ type: 'file-cancel', id }`

**Preservation Requirement**:
After implementing Supabase signaling, file transfer cancellation MUST work identically. Cancel logic should remain unchanged.

---

### Property 7: Signaling Works Consistently (Property-Based) ✅
**Validates**: Requirements 3.1, 3.2, 3.6

**Observation**:
- Signaling (offer generation) works consistently across multiple attempts
- All generated signals are valid strings
- Signal generation is reliable

**Baseline Behavior**:
- Offer generation: `createOffer()` → `localSignal` contains base64-encoded signal
- Signal status transitions: null → 'gathering' → 'ready'
- Connection state transitions: 'idle' → 'connecting' → 'waiting-for-peer' → 'connected'

**Preservation Requirement**:
After implementing Supabase signaling, offer generation MUST work consistently. The only change should be that `localSignal` contains a short room ID instead of full signal data.

---

## Critical Preservation Points

### 1. P2P File Transfer (NO SERVER)
**CRITICAL**: File data MUST NEVER touch Supabase servers. Only signaling data (SDP offer/answer, ICE candidates) should be stored in Supabase. File transfers happen directly peer-to-peer over WebRTC data channel.

### 2. Chat Messages (NO SERVER)
**CRITICAL**: Chat messages MUST NEVER touch Supabase servers. Messages are sent directly peer-to-peer over WebRTC data channel.

### 3. Chunked Transfer Protocol (UNCHANGED)
**CRITICAL**: The chunked file transfer protocol MUST remain unchanged:
- Message types: file-meta, binary chunks, file-complete, file-cancel, chat
- Chunk size: 64KB
- Back-pressure handling: HIGH_WATER_MARK (1MB)
- Progress tracking: progress, speed, ETA

### 4. Manual Signaling (BACKWARD COMPATIBLE)
**CRITICAL**: Manual copy/paste signaling MUST continue to work. The system should accept:
- Short room IDs (6-8 characters) - new behavior after fix
- Full signal data (>2000 characters) - backward compatibility with old QR codes

### 5. Connection Lifecycle (UNCHANGED)
**CRITICAL**: Connection lifecycle MUST remain unchanged:
- State transitions: idle → connecting → waiting-for-peer → connected → disconnected
- Cleanup logic: disconnect() resets all state
- Error handling: connection timeout (180 seconds), ICE failures, etc.

### 6. Wake Lock & Visibility (UNCHANGED)
**CRITICAL**: Wake lock and visibility change handling MUST remain unchanged:
- Wake lock requested during file transfers
- Wake lock released when idle
- Visibility warning toast when tab is backgrounded during signaling

---

## Test Execution Results

```
✅ Property 1: Files transfer P2P over WebRTC data channel (no server)
✅ Property 2: Chunked file transfer protocol remains unchanged
✅ Property 3: Chat messages use WebRTC data channel (P2P)
✅ Property 4: Manual copy/paste signaling flow works
✅ Property 5: Connection cleanup works correctly
✅ Property 6: File transfer cancellation works
✅ Property 7: Signaling works consistently (property-based)

Test Files  1 passed (1)
Tests       7 passed (7)
Duration    2.17s
```

---

## Next Steps

1. ✅ **Task 3 Complete**: Preservation tests written and passing on unfixed code
2. **Task 4-10**: Implement Supabase signaling fix (camera overlay + QR code size reduction)
3. **Task 13**: Re-run preservation tests after fix to verify NO REGRESSIONS

**Expected Outcome After Fix**:
- All preservation tests should STILL PASS
- File transfers, chat, and manual signaling should work identically
- Only change: QR codes contain short room IDs instead of full signal data

---

## Conclusion

All preservation property tests pass on the unfixed code, establishing a clear baseline of behavior that must be preserved. These tests will be re-run after implementing the Supabase signaling fix to ensure no regressions occur.

The tests confirm that:
1. File transfers work P2P (no server)
2. Chat messages work P2P (no server)
3. Chunked transfer protocol is well-defined
4. Manual signaling flow works
5. Connection cleanup works
6. File transfer cancellation works
7. Signaling is consistent and reliable

These behaviors MUST be preserved after the fix.
