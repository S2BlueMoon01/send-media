import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import * as fc from 'fast-check';

/**
 * Unit Tests for Supabase Signaling Functions
 * 
 * **Validates: Requirements 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12**
 * 
 * These tests verify the Supabase signaling relay functions work correctly:
 * - Room creation and ID generation
 * - Offer storage and retrieval
 * - Answer submission and polling
 * - Room completion marking
 * - Input validation (room ID format, signal data structure)
 * - Rate limiting (10 rooms per hour)
 * - Security (RLS policies, injection prevention)
 */

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    clear: () => {
      store = {};
    },
  };
})();

// Replace global localStorage with mock
Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

// Mock Supabase client
const mockFrom = vi.fn();
const mockSupabaseClient = {
  from: mockFrom,
};

// Mock the Supabase client module BEFORE importing the module under test
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => mockSupabaseClient,
}));

// Mock nanoid to return predictable IDs for testing
vi.mock('nanoid', () => ({
  nanoid: (length: number) => 'test1234'.substring(0, length),
}));

// Now import the module under test AFTER mocks are set up
import type { SignalData } from './supabase';
import { createRoom, getOffer, submitAnswer, pollAnswer, markCompleted } from './supabase';

describe('Supabase Signaling Functions - Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createRoom', () => {
    /**
     * Test: createRoom with valid offer returns room ID
     * 
     * Validates: Requirements 2.6
     * 
     * The createRoom function should:
     * - Accept a valid WebRTC offer signal
     * - Generate a room ID (6-8 characters)
     * - Store the offer in Supabase
     * - Return the room ID
     */
    it('should create room with valid offer and return room ID', async () => {
      const mockOffer: SignalData = {
        type: 'offer',
        sdp: 'v=0\r\no=- 123456 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n',
      };

      // Mock Supabase insert
      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      mockFrom.mockReturnValue({
        insert: mockInsert,
      });

      const roomId = await createRoom(mockOffer);

      // Assert room ID is returned
      expect(roomId).toBeDefined();
      expect(typeof roomId).toBe('string');
      expect(roomId.length).toBeGreaterThanOrEqual(6);
      expect(roomId.length).toBeLessThanOrEqual(8);
      expect(roomId).toMatch(/^[a-zA-Z0-9]+$/);

      // Assert Supabase insert was called with correct data
      expect(mockFrom).toHaveBeenCalledWith('webrtc_signals');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: roomId,
          offer: mockOffer,
          answer: null,
          completed: false,
        })
      );
    });

    /**
     * Test: createRoom validates signal data structure
     * 
     * Validates: Requirements 2.12
     * 
     * The createRoom function should reject invalid signal data:
     * - Null or undefined signals
     * - Non-object signals
     * - Signals missing required properties (type, sdp)
     */
    it('should reject invalid signal data', async () => {
      const invalidSignals = [
        { value: null, shouldFail: true },
        { value: undefined, shouldFail: true },
        { value: 'invalid-string', shouldFail: true },
        { value: 123, shouldFail: true },
        { value: { type: 'offer' }, shouldFail: true }, // Missing sdp
        { value: { type: 'offer', sdp: 123 }, shouldFail: true }, // Invalid sdp type
      ];

      for (const { value, shouldFail } of invalidSignals) {
        if (shouldFail) {
          await expect(createRoom(value as any)).rejects.toThrow(
            /Invalid signal data/
          );
        }
      }
    });

    /**
     * Test: createRoom enforces rate limiting
     * 
     * Validates: Requirements 2.10
     * 
     * The createRoom function should:
     * - Track room creation timestamps in localStorage
     * - Allow up to 10 rooms per hour
     * - Reject requests after limit is exceeded
     */
    it('should enforce rate limiting (10 rooms per hour)', async () => {
      const mockOffer: SignalData = {
        type: 'offer',
        sdp: 'v=0\r\no=- 123456 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n',
      };

      // Mock Supabase insert
      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      mockFrom.mockReturnValue({
        insert: mockInsert,
      });

      // Create 10 rooms (should succeed)
      for (let i = 0; i < 10; i++) {
        await createRoom(mockOffer);
      }

      // 11th room should fail with rate limit error
      await expect(createRoom(mockOffer)).rejects.toThrow(/Rate limit exceeded/);
    });

    /**
     * Test: createRoom handles database errors
     * 
     * Validates: Requirements 2.6
     * 
     * The createRoom function should handle Supabase errors gracefully
     */
    it('should handle database errors', async () => {
      const mockOffer: SignalData = {
        type: 'offer',
        sdp: 'v=0\r\no=- 123456 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n',
      };

      // Mock Supabase insert error
      const mockInsert = vi.fn().mockResolvedValue({
        error: { message: 'Database connection failed' },
      });
      mockFrom.mockReturnValue({
        insert: mockInsert,
      });

      await expect(createRoom(mockOffer)).rejects.toThrow(/Failed to create room/);
    });
  });

  describe('getOffer', () => {
    /**
     * Test: getOffer with valid room ID returns offer
     * 
     * Validates: Requirements 2.7
     * 
     * The getOffer function should:
     * - Accept a valid room ID (6-8 alphanumeric characters)
     * - Fetch the offer from Supabase
     * - Return the offer signal data
     */
    it('should retrieve offer with valid room ID', async () => {
      const roomId = 'abc12345';
      const mockOffer: SignalData = {
        type: 'offer',
        sdp: 'v=0\r\no=- 123456 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n',
      };

      // Mock Supabase select
      const mockSingle = vi.fn().mockResolvedValue({
        data: { offer: mockOffer },
        error: null,
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      const offer = await getOffer(roomId);

      // Assert offer is returned
      expect(offer).toEqual(mockOffer);

      // Assert Supabase query was called correctly
      expect(mockFrom).toHaveBeenCalledWith('webrtc_signals');
      expect(mockSelect).toHaveBeenCalledWith('offer');
      expect(mockEq).toHaveBeenCalledWith('id', roomId);
    });

    /**
     * Test: getOffer validates room ID format
     * 
     * Validates: Requirements 2.12
     * 
     * The getOffer function should reject invalid room ID formats:
     * - Too short (< 6 characters after sanitization)
     * - Too long (> 8 characters after sanitization)
     * - Empty string
     * 
     * Note: Special characters are sanitized (removed), so "abc-123" becomes "abc123"
     */
    it('should reject invalid room ID formats', async () => {
      const invalidRoomIds = [
        'abc', // Too short (3 chars)
        'ab', // Too short (2 chars)
        'abc123456789', // Too long (12 chars)
        '', // Empty
        '12345', // Too short (5 chars)
        '123456789', // Too long (9 chars)
      ];

      for (const invalidId of invalidRoomIds) {
        await expect(getOffer(invalidId)).rejects.toThrow(/Invalid room ID format/);
      }
    });

    /**
     * Test: getOffer handles room not found
     * 
     * Validates: Requirements 2.7
     * 
     * The getOffer function should handle cases where:
     * - Room ID doesn't exist
     * - Room has expired
     * - Offer is missing
     */
    it('should handle room not found', async () => {
      const roomId = 'notfound';

      // Mock Supabase select error
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'No rows returned' },
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      await expect(getOffer(roomId)).rejects.toThrow(/Room not found/);
    });

    /**
     * Test: getOffer sanitizes input to prevent injection
     * 
     * Validates: Requirements 2.12
     * 
     * The getOffer function should sanitize room ID input to prevent SQL injection.
     * Special characters are removed, leaving only alphanumeric characters.
     */
    it('should sanitize input to prevent injection attacks', async () => {
      const maliciousRoomId = "abc123'; DROP TABLE webrtc_signals; --";

      // The function sanitizes to "abc123DROPTABLEwebrtcsignals" which is too long (29 chars)
      await expect(getOffer(maliciousRoomId)).rejects.toThrow(/Invalid room ID format/);
    });
  });

  describe('submitAnswer', () => {
    /**
     * Test: submitAnswer with valid answer stores successfully
     * 
     * Validates: Requirements 2.7
     * 
     * The submitAnswer function should:
     * - Accept a valid room ID and answer signal
     * - Update the room with the answer
     * - Handle RLS policy (answer can only be set once)
     */
    it('should submit answer with valid room ID and answer', async () => {
      const roomId = 'abc12345';
      const mockAnswer: SignalData = {
        type: 'answer',
        sdp: 'v=0\r\no=- 789012 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n',
      };

      // Mock Supabase update
      const mockIs = vi.fn().mockResolvedValue({ error: null });
      const mockEq = vi.fn().mockReturnValue({ is: mockIs });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ update: mockUpdate });

      await submitAnswer(roomId, mockAnswer);

      // Assert Supabase update was called correctly
      expect(mockFrom).toHaveBeenCalledWith('webrtc_signals');
      expect(mockUpdate).toHaveBeenCalledWith({ answer: mockAnswer });
      expect(mockEq).toHaveBeenCalledWith('id', roomId);
      expect(mockIs).toHaveBeenCalledWith('answer', null);
    });

    /**
     * Test: submitAnswer validates room ID format
     * 
     * Validates: Requirements 2.12
     */
    it('should reject invalid room ID formats', async () => {
      const mockAnswer: SignalData = {
        type: 'answer',
        sdp: 'v=0\r\no=- 789012 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n',
      };

      const invalidRoomIds = ['abc', 'abc123456789', '', '12345'];

      for (const invalidId of invalidRoomIds) {
        await expect(submitAnswer(invalidId, mockAnswer)).rejects.toThrow(
          /Invalid room ID format/
        );
      }
    });

    /**
     * Test: submitAnswer validates signal data
     * 
     * Validates: Requirements 2.12
     */
    it('should reject invalid signal data', async () => {
      const roomId = 'abc12345';
      const invalidSignals = [
        null,
        undefined,
        'invalid-string',
        { type: 'answer' }, // Missing sdp
      ];

      for (const invalidSignal of invalidSignals) {
        await expect(submitAnswer(roomId, invalidSignal as any)).rejects.toThrow(
          /Invalid signal data/
        );
      }
    });

    /**
     * Test: submitAnswer handles answer already exists (RLS policy)
     * 
     * Validates: Requirements 2.11
     * 
     * The RLS policy should prevent overwriting an existing answer.
     * This prevents malicious users from hijacking connections.
     */
    it('should reject when answer already exists (RLS policy)', async () => {
      const roomId = 'abc12345';
      const mockAnswer: SignalData = {
        type: 'answer',
        sdp: 'v=0\r\no=- 789012 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n',
      };

      // Mock Supabase update error (RLS policy violation)
      const mockIs = vi.fn().mockResolvedValue({
        error: { message: 'policy violation' },
      });
      const mockEq = vi.fn().mockReturnValue({ is: mockIs });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ update: mockUpdate });

      await expect(submitAnswer(roomId, mockAnswer)).rejects.toThrow(
        /Answer already exists/
      );
    });
  });

  describe('pollAnswer', () => {
    /**
     * Test: pollAnswer returns null initially, then answer after submission
     * 
     * Validates: Requirements 2.8
     * 
     * The pollAnswer function should:
     * - Return null when no answer exists yet
     * - Return the answer signal data once it's submitted
     */
    it('should return null initially, then answer after submission', async () => {
      const roomId = 'abc12345';
      const mockAnswer: SignalData = {
        type: 'answer',
        sdp: 'v=0\r\no=- 789012 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n',
      };

      // First call: no answer yet
      const mockSingle1 = vi.fn().mockResolvedValue({
        data: { answer: null },
        error: null,
      });
      const mockEq1 = vi.fn().mockReturnValue({ single: mockSingle1 });
      const mockSelect1 = vi.fn().mockReturnValue({ eq: mockEq1 });
      mockFrom.mockReturnValueOnce({ select: mockSelect1 });

      const result1 = await pollAnswer(roomId);
      expect(result1).toBeNull();

      // Second call: answer exists
      const mockSingle2 = vi.fn().mockResolvedValue({
        data: { answer: mockAnswer },
        error: null,
      });
      const mockEq2 = vi.fn().mockReturnValue({ single: mockSingle2 });
      const mockSelect2 = vi.fn().mockReturnValue({ eq: mockEq2 });
      mockFrom.mockReturnValueOnce({ select: mockSelect2 });

      const result2 = await pollAnswer(roomId);
      expect(result2).toEqual(mockAnswer);
    });

    /**
     * Test: pollAnswer validates room ID format
     * 
     * Validates: Requirements 2.12
     */
    it('should reject invalid room ID formats', async () => {
      const invalidRoomIds = ['abc', 'abc123456789', '', '12345'];

      for (const invalidId of invalidRoomIds) {
        await expect(pollAnswer(invalidId)).rejects.toThrow(/Invalid room ID format/);
      }
    });

    /**
     * Test: pollAnswer handles room not found
     * 
     * Validates: Requirements 2.8
     */
    it('should handle room not found', async () => {
      const roomId = 'notfound';

      // Mock Supabase select error
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'No rows returned' },
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      await expect(pollAnswer(roomId)).rejects.toThrow(/Room not found/);
    });
  });

  describe('markCompleted', () => {
    /**
     * Test: markCompleted marks room as completed
     * 
     * Validates: Requirements 2.9
     * 
     * The markCompleted function should:
     * - Accept a valid room ID
     * - Update the room's completed flag to true
     * - Enable cleanup optimization (completed rooms can be deleted immediately)
     */
    it('should mark room as completed', async () => {
      const roomId = 'abc12345';

      // Mock Supabase update
      const mockEq = vi.fn().mockResolvedValue({ error: null });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ update: mockUpdate });

      await markCompleted(roomId);

      // Assert Supabase update was called correctly
      expect(mockFrom).toHaveBeenCalledWith('webrtc_signals');
      expect(mockUpdate).toHaveBeenCalledWith({ completed: true });
      expect(mockEq).toHaveBeenCalledWith('id', roomId);
    });

    /**
     * Test: markCompleted validates room ID format
     * 
     * Validates: Requirements 2.12
     * 
     * Note: markCompleted validates input but doesn't throw on database errors
     * since it's an optimization, not critical functionality
     */
    it('should validate room ID format', async () => {
      const invalidRoomIds = ['abc', 'abc123456789', '', '12345'];

      for (const invalidId of invalidRoomIds) {
        await expect(markCompleted(invalidId)).rejects.toThrow(/Invalid room ID format/);
      }
    });

    /**
     * Test: markCompleted handles database errors gracefully
     * 
     * Validates: Requirements 2.9
     * 
     * Since markCompleted is an optimization (not critical), it should:
     * - Log errors but not throw
     * - Allow the application to continue
     */
    it('should handle database errors gracefully (non-critical)', async () => {
      const roomId = 'abc12345';

      // Mock Supabase update error
      const mockEq = vi.fn().mockResolvedValue({
        error: { message: 'Database error' },
      });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ update: mockUpdate });

      // Should not throw (markCompleted is optimization, not critical)
      await expect(markCompleted(roomId)).resolves.not.toThrow();
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * Property: All generated room IDs are 6-8 alphanumeric characters
     * 
     * Validates: Requirements 2.6
     * 
     * Uses property-based testing to verify room ID generation across many inputs
     */
    it('Property: All generated room IDs match format /^[a-zA-Z0-9]{6,8}$/', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            type: fc.constant('offer'),
            sdp: fc.string({ minLength: 10, maxLength: 500 }),
          }),
          async (offer) => {
            // Mock Supabase insert
            const mockInsert = vi.fn().mockResolvedValue({ error: null });
            mockFrom.mockReturnValue({ insert: mockInsert });

            // Clear rate limit for property-based testing
            mockLocalStorage.clear();

            const roomId = await createRoom(offer);

            // Property: Room ID must match format
            const roomIdPattern = /^[a-zA-Z0-9]{6,8}$/;
            return roomIdPattern.test(roomId);
          }
        ),
        {
          numRuns: 10,
          verbose: true,
        }
      );
    });

    /**
     * Property: Room ID validation rejects all invalid formats
     * 
     * Validates: Requirements 2.12
     * 
     * Uses property-based testing to verify input validation.
     * Note: sanitizeInput removes special characters, so we test length-based validation.
     */
    it('Property: Invalid room IDs are always rejected', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.string({ minLength: 0, maxLength: 5 }), // Too short after sanitization
            fc.string({ minLength: 9, maxLength: 20 }), // Too long after sanitization
          ),
          async (invalidRoomId) => {
            // Mock Supabase (won't be called due to validation)
            const mockSingle = vi.fn().mockResolvedValue({
              data: { offer: {} },
              error: null,
            });
            const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
            const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
            mockFrom.mockReturnValue({ select: mockSelect });

            // Sanitize the input to match what the function does
            const sanitized = invalidRoomId.replace(/[^a-zA-Z0-9]/g, '');
            
            // Skip if sanitization results in valid length (6-8 chars)
            if (sanitized.length >= 6 && sanitized.length <= 8) {
              return true;
            }

            // Property: All invalid room IDs should be rejected
            try {
              await getOffer(invalidRoomId);
              return false; // Should have thrown
            } catch (error) {
              return error instanceof Error && error.message.includes('Invalid room ID format');
            }
          }
        ),
        {
          numRuns: 20,
          verbose: true,
        }
      );
    });
  });
});
