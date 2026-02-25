import { Html5Qrcode } from 'html5-qrcode';
import { useEffect, useState, useRef } from 'react';
import { Camera, CameraOff, Loader2, Sparkles, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSettings } from '@/hooks/useSettings';
import { toast } from 'sonner';

interface QRScannerProps {
  onScan: (data: string) => void;
}

export default function QRScanner({ onScan }: QRScannerProps) {
  const { t } = useSettings();
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            scannerRef.current.stop().catch(() => {});
          }
        } catch (e) {
          console.warn('Cleanup stop failed:', e);
        }
      }
    };
  }, []);

  const startScanning = async () => {
    setLoading(true);
    setScanning(true);
    setError(null);
    
    // NUCLEAR CLEANUP & HW COOLDOWN
    const nuclearReset = async () => {
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
        } catch (e) {
          console.warn('Silent stop fail during nuclear reset:', e);
        }
        scannerRef.current = null;
      }
      
      // Force clear the DOM to kill lingering video/canvas elements
      const container = document.getElementById('qr-reader');
      if (container) {
        container.innerHTML = ''; 
      }
      
      // Max delay for hardware/OS to release front lens
      await new Promise(r => setTimeout(r, 2000));
    };

    await nuclearReset();

    try {
      const html5QrCode = new Html5Qrcode('qr-reader');
      scannerRef.current = html5QrCode;

      const config = {
        fps: 30,
      };

      const highQualConfig = {
        ...config,
        videoConstraints: {
          facingMode: { exact: "environment" }, // Double enforcement
          width: { ideal: 640 },
          height: { ideal: 640 }
        }
      };

      const startWithFallback = async () => {
        const allDevices = await Html5Qrcode.getCameras().catch(() => []);
        
        // REVERSE PROBE STRATEGY
        // Usually index 0 is front, and main rear lens is near the end
        let probeQueue = [...allDevices].reverse();
        
        // If we have multiple cameras, EXPLICITLY skip the one at the ORIGINAL index 0
        if (allDevices.length > 1) {
          const frontId = allDevices[0].id;
          probeQueue = probeQueue.filter(d => d.id !== frontId);
        }

        console.log('Probing queue (High-to-Low chance for back cam):', probeQueue.map(d => d.label || d.id));

        // TIER 1: Sequential ID-based probing from the end of lists
        for (const cam of probeQueue) {
          try {
            console.log(`Probing camera: ${cam.label || cam.id}`);
            await html5QrCode.start(cam.id, highQualConfig, (t) => { onScan(t); stopScanning(); }, () => {});
            return;
          } catch (e) {
            console.warn(`Failed ${cam.label || cam.id}, waiting for hardware release...`);
            await new Promise(r => setTimeout(r, 1500)); // Release cooldown
          }
        }

        // TIER 2: facingMode environment (EXACT)
        try {
          console.log('Probing via facingMode exact: environment');
          await html5QrCode.start({ facingMode: { exact: "environment" } }, highQualConfig, (text) => { onScan(text); stopScanning(); }, () => {});
          return;
        } catch (e1: any) {
          console.warn('Exact environment mode failed, falling back to simple environment...', e1);
          await new Promise(r => setTimeout(r, 1000));
        }

        // TIER 3: facingMode environment (NON-EXACT)
        try {
          await html5QrCode.start({ facingMode: "environment" }, config, (text) => { onScan(text); stopScanning(); }, () => {});
        } catch (e2: any) {
          console.error('All back camera probes failed', e2);
          throw e2;
        }
      };

      await startWithFallback();
    } catch (err: any) {
      console.error('QR Final Error:', err);
      toast.error('Could not access back camera. Ensure the rear camera is not in use by another app.');
      setScanning(false);
      scannerRef.current = null;
    } finally {
      setLoading(false);
    }
  };

  const stopScanning = async () => {
    // SYNC EXIT: Transition UI immediately
    setScanning(false);
    
    const scanner = scannerRef.current;
    if (scanner) {
      scannerRef.current = null;
      // Background teardown - don't await to avoid UI blocking
      (async () => {
        try {
          await scanner.stop();
          // Clean DOM after stop
          const container = document.getElementById('qr-reader');
          if (container) container.innerHTML = '';
        } catch (err) {
          if (!err?.toString().includes('not running')) {
            console.warn('QR Background Stop Error:', err);
          }
        }
      })();
    }
  };

  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4 items-center w-full">
      <Button
        variant={scanning ? 'destructive' : 'secondary'}
        className="w-full h-12 gap-2 rounded-2xl font-bold transition-all shadow-lg active:scale-95"
        onClick={scanning ? stopScanning : () => startScanning()}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : scanning ? (
          <>
            <CameraOff className="w-5 h-5" /> {t.qr.stopCamera}
          </>
        ) : (
          <>
            <Camera className="w-5 h-5" /> {t.qr.openCamera}
          </>
        )}
      </Button>

      <div className={`w-full aspect-square max-w-[320px] mx-auto overflow-hidden rounded-[2.5rem] border-4 border-white/20 bg-black relative shadow-2xl transition-all duration-300 ${scanning ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none h-0 overflow-hidden'}`}>
        <div id="qr-reader" className="w-full h-full [&_video]:object-contain" />
        
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
          <div className="absolute inset-0 bg-black/40" />
          
          <div className="relative w-[250px] h-[250px] bg-transparent backdrop-blur-[1px]">
             <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-indigo-500 rounded-tl-xl shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
             <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-indigo-500 rounded-tr-xl shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
             <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-indigo-500 rounded-bl-xl shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
             <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-indigo-500 rounded-br-xl shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
             
             <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-indigo-400 to-transparent top-0 animate-scanning-line shadow-[0_0_10px_rgba(99,102,241,0.8)]" />
          </div>

          <p className="mt-6 text-white text-[10px] font-bold uppercase tracking-[0.2em] bg-black/60 px-4 py-1.5 rounded-full z-10 flex items-center gap-2">
            <Sparkles className="w-3 h-3 text-yellow-400" />
            Scanning for Peer Signal
          </p>
        </div>
      </div>

      {error && <p className="text-xs text-destructive text-center font-bold">{error}</p>}
    </div>
  );
}
