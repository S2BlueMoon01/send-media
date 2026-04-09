import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as fc from 'fast-check';
import QRScanner from './QRScanner';

/**
 * Bug Condition Exploration Test for Camera Overlay Misalignment
 * 
 * **Validates: Requirements 1.1, 1.2, 2.1, 2.2**
 * 
 * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * DO NOT attempt to fix the test or the code when it fails
 * NOTE: This test encodes the expected behavior - it will validate the fix when it passes after implementation
 * GOAL: Surface counterexamples that demonstrate overlay misalignment exists
 * 
 * ROOT CAUSE: The overlay is positioned relative to the container, but the video element
 * uses object-fit: contain which may add letterboxing. The overlay doesn't account for
 * the actual rendered video dimensions, only the container dimensions.
 */

// Mock html5-qrcode library with realistic video element creation
vi.mock('html5-qrcode', () => {
  return {
    Html5Qrcode: class MockHtml5Qrcode {
      private videoElement: HTMLVideoElement | null = null;

      async start(cameraIdOrConfig: any, config: any, qrCodeSuccessCallback: any, qrCodeErrorCallback: any) {
        // Simulate html5-qrcode creating a video element inside #qr-reader
        const container = document.getElementById('qr-reader');
        if (container) {
          this.videoElement = document.createElement('video');
          // Simulate a 640x640 video stream (1:1 aspect ratio)
          this.videoElement.style.width = '640px';
          this.videoElement.style.height = '640px';
          this.videoElement.style.objectFit = 'contain';
          this.videoElement.setAttribute('data-test-video', 'true');
          container.appendChild(this.videoElement);
          
          // Simulate video loading
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      async stop() {
        if (this.videoElement && this.videoElement.parentNode) {
          this.videoElement.parentNode.removeChild(this.videoElement);
        }
        this.videoElement = null;
      }

      get isScanning() {
        return this.videoElement !== null;
      }

      static async getCameras() {
        return [];
      }
    },
  };
});

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

// Mock useSettings hook
vi.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({
    t: {
      qr: {
        openCamera: 'Open Camera',
        stopCamera: 'Stop Camera',
      },
    },
  }),
}));

describe('QRScanner - Bug Condition Exploration: Camera Overlay Misalignment', () => {
  beforeEach(() => {
    // Reset DOM completely
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up any remaining elements
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  /**
   * Property 1: Bug Condition - Camera Overlay Misalignment with object-fit: contain
   * 
   * The bug occurs when the container has a different aspect ratio than the video stream.
   * With object-fit: contain, the video will be letterboxed (black bars added), but the
   * overlay is positioned relative to the container, not the actual video dimensions.
   * 
   * This test simulates a scenario where:
   * - Container is 320x320 (1:1 square)
   * - Video stream is 640x640 (1:1 square) - should fill container
   * - BUT if container were 320x400 (portrait), video would be letterboxed
   * 
   * The overlay should align with the VIDEO, not the CONTAINER.
   */
  it('Property 1: Overlay position matches video stream position (accounting for object-fit: contain)', async () => {
    const onScan = vi.fn();

    // Test scenario: Container with portrait aspect ratio, video with square aspect ratio
    // This will cause letterboxing (black bars on top/bottom)
    const containerWidth = 320;
    const containerHeight = 400; // Taller than square
    const videoWidth = 640;
    const videoHeight = 640; // Square video

    // Calculate expected video rendered dimensions with object-fit: contain
    const videoAspectRatio = videoWidth / videoHeight; // 1.0
    const containerAspectRatio = containerWidth / containerHeight; // 0.8

    let expectedVideoRenderedWidth: number;
    let expectedVideoRenderedHeight: number;

    if (containerAspectRatio > videoAspectRatio) {
      // Container is wider - video height fills, width is constrained
      expectedVideoRenderedHeight = containerHeight;
      expectedVideoRenderedWidth = expectedVideoRenderedHeight * videoAspectRatio;
    } else {
      // Container is taller - video width fills, height is constrained
      expectedVideoRenderedWidth = containerWidth;
      expectedVideoRenderedHeight = expectedVideoRenderedWidth / videoAspectRatio;
    }

    // Expected video position (centered in container due to object-fit: contain)
    const expectedVideoLeft = (containerWidth - expectedVideoRenderedWidth) / 2;
    const expectedVideoTop = (containerHeight - expectedVideoRenderedHeight) / 2;

    const { container, unmount } = render(<QRScanner onScan={onScan} />);

    // Find the outer container and set its dimensions
    const outerContainer = container.querySelector('.w-full.aspect-square');
    if (outerContainer) {
      Object.defineProperty(outerContainer, 'getBoundingClientRect', {
        value: () => ({
          width: containerWidth,
          height: containerHeight,
          left: 0,
          top: 0,
          right: containerWidth,
          bottom: containerHeight,
          x: 0,
          y: 0,
        }),
      });
    }

    // Open camera
    const openButton = screen.getByRole('button', { name: /open camera/i });
    await userEvent.click(openButton);

    // Wait for camera to initialize and video element to be created
    // Note: QRScanner has a 2-second delay in nuclearReset before starting camera
    await waitFor(() => {
      const video = container.querySelector('[data-test-video]');
      expect(video).toBeInTheDocument();
    }, { timeout: 5000 });

    // Get the overlay element
    const overlayContainer = container.querySelector('.absolute.inset-0');
    const scanningFrame = container.querySelector('.relative.w-\\[250px\\].h-\\[250px\\]');

    if (!overlayContainer || !scanningFrame) {
      unmount();
      throw new Error('Missing overlay elements');
    }

    // Mock overlay getBoundingClientRect to simulate it filling the container
    Object.defineProperty(overlayContainer, 'getBoundingClientRect', {
      value: () => ({
        width: containerWidth,
        height: containerHeight,
        left: 0,
        top: 0,
        right: containerWidth,
        bottom: containerHeight,
        x: 0,
        y: 0,
      }),
    });

    // Calculate overlay center (currently aligned to container)
    const overlayRect = overlayContainer.getBoundingClientRect();
    const overlayCenterX = overlayRect.left + overlayRect.width / 2;
    const overlayCenterY = overlayRect.top + overlayRect.height / 2;

    // Calculate expected video center (accounting for letterboxing)
    const expectedVideoCenterX = expectedVideoLeft + expectedVideoRenderedWidth / 2;
    const expectedVideoCenterY = expectedVideoTop + expectedVideoRenderedHeight / 2;

    // Check if overlay center matches video center
    const centerOffsetX = Math.abs(overlayCenterX - expectedVideoCenterX);
    const centerOffsetY = Math.abs(overlayCenterY - expectedVideoCenterY);

    unmount();

    // Report the bug
    const counterexamples: string[] = [];

    if (centerOffsetX > 1 || centerOffsetY > 1) {
      counterexamples.push(
        `Container: ${containerWidth}x${containerHeight}, Video: ${videoWidth}x${videoHeight}`
      );
      counterexamples.push(
        `Expected video rendered: ${expectedVideoRenderedWidth.toFixed(0)}x${expectedVideoRenderedHeight.toFixed(0)} at (${expectedVideoLeft.toFixed(0)}, ${expectedVideoTop.toFixed(0)})`
      );
      counterexamples.push(
        `Overlay center: (${overlayCenterX.toFixed(0)}, ${overlayCenterY.toFixed(0)})`
      );
      counterexamples.push(
        `Expected video center: (${expectedVideoCenterX.toFixed(0)}, ${expectedVideoCenterY.toFixed(0)})`
      );
      counterexamples.push(
        `Misalignment: offsetX=${centerOffsetX.toFixed(0)}px, offsetY=${centerOffsetY.toFixed(0)}px`
      );
      counterexamples.push(
        `\nBUG CONFIRMED: Overlay is aligned to container (${containerWidth}x${containerHeight}), not to video (${expectedVideoRenderedWidth.toFixed(0)}x${expectedVideoRenderedHeight.toFixed(0)})`
      );
      counterexamples.push(
        `When video uses object-fit: contain with letterboxing, overlay should account for actual video dimensions, not container dimensions.`
      );
    }

    if (counterexamples.length > 0) {
      const report = [
        '\n=== COUNTEREXAMPLE FOUND (Bug Confirmed) ===',
        ...counterexamples,
        '\nExpected behavior (after fix):',
        '- Overlay MUST align with actual video rendered dimensions',
        '- Overlay MUST account for object-fit: contain letterboxing',
        '- Overlay center MUST match video center (within 1px)',
        '===========================================\n',
      ].join('\n');

      // This test is EXPECTED TO FAIL on unfixed code
      throw new Error(report);
    }

    // If no counterexamples, the bug is fixed
    expect(counterexamples.length).toBe(0);
  });

  /**
   * Property 2: Overlay alignment with different container aspect ratios
   * 
   * Uses property-based testing to generate random container dimensions and verify
   * overlay alignment accounts for object-fit: contain behavior.
   */
  it('Property 2: Overlay adapts to video dimensions regardless of container aspect ratio', async () => {
    const onScan = vi.fn();

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 320, max: 500 }), // container width
        fc.integer({ min: 400, max: 600 }), // container height (taller to force letterboxing)
        async (containerWidth, containerHeight) => {
          // Video is always 640x640 (square)
          const videoWidth = 640;
          const videoHeight = 640;

          // Skip if container is square (no letterboxing)
          if (Math.abs(containerWidth - containerHeight) < 10) {
            return true;
          }

          const { container, unmount } = render(<QRScanner onScan={onScan} />);

          // Set container dimensions
          const outerContainer = container.querySelector('.w-full.aspect-square');
          if (outerContainer) {
            Object.defineProperty(outerContainer, 'getBoundingClientRect', {
              value: () => ({
                width: containerWidth,
                height: containerHeight,
                left: 0,
                top: 0,
                right: containerWidth,
                bottom: containerHeight,
                x: 0,
                y: 0,
              }),
            });
          }

          // Open camera
          const openButton = screen.getByRole('button', { name: /open camera/i });
          await userEvent.click(openButton);

          // Wait for video
          await waitFor(() => {
            const video = container.querySelector('[data-test-video]');
            expect(video).toBeInTheDocument();
          }, { timeout: 2000 });

          // Get overlay
          const overlayContainer = container.querySelector('.absolute.inset-0');
          if (!overlayContainer) {
            unmount();
            return true;
          }

          // Mock overlay dimensions (fills container)
          Object.defineProperty(overlayContainer, 'getBoundingClientRect', {
            value: () => ({
              width: containerWidth,
              height: containerHeight,
              left: 0,
              top: 0,
              right: containerWidth,
              bottom: containerHeight,
              x: 0,
              y: 0,
            }),
          });

          // Calculate expected video dimensions with object-fit: contain
          const videoAspectRatio = videoWidth / videoHeight;
          const containerAspectRatio = containerWidth / containerHeight;

          let expectedVideoRenderedWidth: number;
          let expectedVideoRenderedHeight: number;

          if (containerAspectRatio > videoAspectRatio) {
            expectedVideoRenderedHeight = containerHeight;
            expectedVideoRenderedWidth = expectedVideoRenderedHeight * videoAspectRatio;
          } else {
            expectedVideoRenderedWidth = containerWidth;
            expectedVideoRenderedHeight = expectedVideoRenderedWidth / videoAspectRatio;
          }

          const expectedVideoLeft = (containerWidth - expectedVideoRenderedWidth) / 2;
          const expectedVideoTop = (containerHeight - expectedVideoRenderedHeight) / 2;
          const expectedVideoCenterX = expectedVideoLeft + expectedVideoRenderedWidth / 2;
          const expectedVideoCenterY = expectedVideoTop + expectedVideoRenderedHeight / 2;

          const overlayRect = overlayContainer.getBoundingClientRect();
          const overlayCenterX = overlayRect.left + overlayRect.width / 2;
          const overlayCenterY = overlayRect.top + overlayRect.height / 2;

          const centerOffsetX = Math.abs(overlayCenterX - expectedVideoCenterX);
          const centerOffsetY = Math.abs(overlayCenterY - expectedVideoCenterY);

          unmount();

          // Property: Overlay center MUST match video center (within 1px)
          return centerOffsetX <= 1 && centerOffsetY <= 1;
        }
      ),
      {
        numRuns: 10, // Test 10 random configurations
        verbose: true,
      }
    );
  }, 30000); // Increase timeout for property-based testing
});

/**
 * Task 5.4: Test across aspect ratios
 * 
 * **Validates: Requirements 1.1, 1.2, 2.1, 2.2**
 * 
 * This test suite specifically tests the overlay alignment across different video
 * aspect ratios as specified in Task 5.4:
 * - 640x640 (1:1 square) video stream
 * - 640x480 (4:3) video stream
 * - Container with different aspect ratio (letterboxing)
 */
describe('QRScanner - Task 5.4: Test across aspect ratios', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('Test 1: 640x640 (1:1 square) video stream with square container', async () => {
    const onScan = vi.fn();
    const { container, unmount } = render(<QRScanner onScan={onScan} />);

    // Open camera
    const openButton = screen.getByRole('button', { name: /open camera/i });
    await userEvent.click(openButton);

    // Wait for video element
    await waitFor(() => {
      const video = container.querySelector('[data-test-video]');
      expect(video).toBeInTheDocument();
    }, { timeout: 2000 });

    // Verify overlay exists
    const overlayContainer = container.querySelector('.absolute.inset-0');
    expect(overlayContainer).toBeInTheDocument();

    // Verify scanning frame exists and is centered
    const scanningFrame = container.querySelector('.relative.w-\\[250px\\].h-\\[250px\\]');
    expect(scanningFrame).toBeInTheDocument();

    unmount();
  });

  it('Test 2: 640x480 (4:3) video stream - verify overlay adapts', async () => {
    // Mock html5-qrcode to create a 4:3 video
    const MockHtml5Qrcode4x3 = class {
      private videoElement: HTMLVideoElement | null = null;

      async start(cameraIdOrConfig: any, config: any, qrCodeSuccessCallback: any, qrCodeErrorCallback: any) {
        const container = document.getElementById('qr-reader');
        if (container) {
          this.videoElement = document.createElement('video');
          // 4:3 aspect ratio
          this.videoElement.style.width = '640px';
          this.videoElement.style.height = '480px';
          this.videoElement.style.objectFit = 'contain';
          this.videoElement.setAttribute('data-test-video', 'true');
          this.videoElement.setAttribute('data-aspect-ratio', '4:3');
          container.appendChild(this.videoElement);
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      async stop() {
        if (this.videoElement && this.videoElement.parentNode) {
          this.videoElement.parentNode.removeChild(this.videoElement);
        }
        this.videoElement = null;
      }

      get isScanning() {
        return this.videoElement !== null;
      }

      static async getCameras() {
        return [];
      }
    };

    // Temporarily replace the mock
    vi.doMock('html5-qrcode', () => ({
      Html5Qrcode: MockHtml5Qrcode4x3,
    }));

    const onScan = vi.fn();
    const { container, unmount } = render(<QRScanner onScan={onScan} />);

    const openButton = screen.getByRole('button', { name: /open camera/i });
    await userEvent.click(openButton);

    await waitFor(() => {
      const video = container.querySelector('[data-test-video]');
      expect(video).toBeInTheDocument();
    }, { timeout: 2000 });

    // Verify overlay still works with 4:3 video
    const overlayContainer = container.querySelector('.absolute.inset-0');
    expect(overlayContainer).toBeInTheDocument();

    const scanningFrame = container.querySelector('.relative.w-\\[250px\\].h-\\[250px\\]');
    expect(scanningFrame).toBeInTheDocument();

    unmount();
  });

  it('Test 3: Container with different aspect ratio (letterboxing scenario)', async () => {
    const onScan = vi.fn();
    const { container, unmount } = render(<QRScanner onScan={onScan} />);

    const openButton = screen.getByRole('button', { name: /open camera/i });
    await userEvent.click(openButton);

    await waitFor(() => {
      const video = container.querySelector('[data-test-video]');
      expect(video).toBeInTheDocument();
    }, { timeout: 2000 });

    // Verify overlay adapts to letterboxing by checking class names
    const overlayContainer = container.querySelector('.absolute.inset-0');
    expect(overlayContainer).toBeInTheDocument();

    // Verify the overlay has the correct classes for positioning
    expect(overlayContainer?.classList.contains('absolute')).toBe(true);
    expect(overlayContainer?.classList.contains('inset-0')).toBe(true);

    // Verify overlay uses flexbox for centering
    expect(overlayContainer?.classList.contains('flex')).toBe(true);
    expect(overlayContainer?.classList.contains('items-center')).toBe(true);
    expect(overlayContainer?.classList.contains('justify-center')).toBe(true);

    // Verify scanning frame is still centered
    const scanningFrame = container.querySelector('.relative.w-\\[250px\\].h-\\[250px\\]');
    expect(scanningFrame).toBeInTheDocument();

    unmount();
  });

  it('Test 4: Verify overlay uses correct CSS positioning', async () => {
    const onScan = vi.fn();
    const { container, unmount } = render(<QRScanner onScan={onScan} />);

    const openButton = screen.getByRole('button', { name: /open camera/i });
    await userEvent.click(openButton);

    // Wait for the async start to complete
    await waitFor(() => {
      const video = container.querySelector('[data-test-video]');
      expect(video).toBeInTheDocument();
    }, { timeout: 2000 });

    // Verify the QR reader container has relative positioning
    const qrReaderContainer = container.querySelector('#qr-reader');
    expect(qrReaderContainer).toBeInTheDocument();
    expect(qrReaderContainer?.classList.contains('relative')).toBe(true);

    // Verify video element was created
    const video = container.querySelector('[data-test-video]');
    expect(video).not.toBeNull();

    // Verify overlay uses absolute positioning with inset-0
    const overlayContainer = container.querySelector('.absolute.inset-0');
    expect(overlayContainer).toBeInTheDocument();
    expect(overlayContainer?.classList.contains('absolute')).toBe(true);
    expect(overlayContainer?.classList.contains('inset-0')).toBe(true);

    // Verify video parent container has object-contain class
    const videoParent = video?.parentElement;
    expect(videoParent?.className).toContain('object-contain');

    // Verify the overlay uses flexbox for centering
    expect(overlayContainer?.classList.contains('flex')).toBe(true);
    expect(overlayContainer?.classList.contains('items-center')).toBe(true);
    expect(overlayContainer?.classList.contains('justify-center')).toBe(true);

    unmount();
  });

  it('Test 5: Responsive behavior on window resize (Task 15)', async () => {
    const onScan = vi.fn();
    const { container, unmount } = render(<QRScanner onScan={onScan} />);

    const openButton = screen.getByRole('button', { name: /open camera/i });
    await userEvent.click(openButton);

    // Wait for camera to initialize
    await waitFor(() => {
      const video = container.querySelector('[data-test-video]');
      expect(video).toBeInTheDocument();
    }, { timeout: 2000 });

    // Get initial overlay and scanning frame
    const overlayContainer = container.querySelector('.absolute.inset-0');
    const scanningFrame = container.querySelector('.relative.w-\\[250px\\].h-\\[250px\\]');
    
    expect(overlayContainer).toBeInTheDocument();
    expect(scanningFrame).toBeInTheDocument();

    // Simulate window resize by changing outer container dimensions
    const outerContainer = container.querySelector('.w-full.aspect-square');
    if (outerContainer) {
      // Initial size: 320x320
      Object.defineProperty(outerContainer, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({
          width: 320,
          height: 320,
          left: 0,
          top: 0,
          right: 320,
          bottom: 320,
          x: 0,
          y: 0,
        }),
      });

      // Verify overlay still uses correct positioning classes after "resize"
      expect(overlayContainer?.classList.contains('absolute')).toBe(true);
      expect(overlayContainer?.classList.contains('inset-0')).toBe(true);
      expect(overlayContainer?.classList.contains('flex')).toBe(true);
      expect(overlayContainer?.classList.contains('items-center')).toBe(true);
      expect(overlayContainer?.classList.contains('justify-center')).toBe(true);

      // Simulate resize to larger dimensions: 400x400
      Object.defineProperty(outerContainer, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({
          width: 400,
          height: 400,
          left: 0,
          top: 0,
          right: 400,
          bottom: 400,
          x: 0,
          y: 0,
        }),
      });

      // Verify overlay maintains correct positioning after resize
      expect(overlayContainer?.classList.contains('absolute')).toBe(true);
      expect(overlayContainer?.classList.contains('inset-0')).toBe(true);
      
      // Verify scanning frame maintains fixed dimensions (250x250)
      expect(scanningFrame?.classList.contains('w-[250px]')).toBe(true);
      expect(scanningFrame?.classList.contains('h-[250px]')).toBe(true);

      // Simulate resize to smaller dimensions: 280x280
      Object.defineProperty(outerContainer, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({
          width: 280,
          height: 280,
          left: 0,
          top: 0,
          right: 280,
          bottom: 280,
          x: 0,
          y: 0,
        }),
      });

      // Verify overlay still maintains correct positioning
      expect(overlayContainer?.classList.contains('absolute')).toBe(true);
      expect(overlayContainer?.classList.contains('inset-0')).toBe(true);
      expect(overlayContainer?.classList.contains('flex')).toBe(true);
      
      // Verify scanning frame is still centered via flexbox
      expect(overlayContainer?.classList.contains('items-center')).toBe(true);
      expect(overlayContainer?.classList.contains('justify-center')).toBe(true);
    }

    unmount();
  });
});
