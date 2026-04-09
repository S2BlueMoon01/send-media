import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, Info } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useSettings } from '@/hooks/useSettings';

interface QRDisplayProps {
  value: string;
}

export default function QRDisplay({ value }: QRDisplayProps) {
  const { t } = useSettings();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success(t.common.copied);
    setTimeout(() => setCopied(false), 2000);
  };

  const isTooLarge = value.length > 2000;
  const isRoomId = value.length <= 10; // Room IDs are 6-8 characters

  // Generate unique gradient ID for this component instance
  const gradientId = `qr-gradient-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <div className="glass p-4 rounded-3xl bg-white border-none shadow-2xl relative group">
        {isTooLarge ? (
          <div className="w-40 h-40 sm:w-48 sm:h-48 flex flex-col items-center justify-center gap-4 text-center p-4">
            <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
              <Info className="w-6 h-6 text-yellow-600" />
            </div>
            <p className="text-xs text-zinc-500 font-medium leading-relaxed">
              {t.qr.tooLarge}
            </p>
          </div>
        ) : (
          <div className="relative p-1">
            <svg width="0" height="0">
              <defs>
                <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="50%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#a855f7" />
                </linearGradient>
              </defs>
            </svg>
             <QRCodeSVG
              value={value}
              size={typeof window !== 'undefined' && window.innerWidth < 640 ? 260 : 280}
              level="L"
              includeMargin={true}
              marginSize={2}
              className="rounded-lg"
              fgColor={`url(#${gradientId})`}
              bgColor="#ffffff"
            />
            <div className="absolute inset-0 border-2 border-indigo-500/20 rounded-lg pointer-events-none" />
          </div>
        )}
      </div>

      {/* Display Room ID as text for manual entry */}
      {isRoomId && (
        <div className="w-full flex flex-col items-center gap-2">
          <div className="text-center">
            <p className="text-xs text-zinc-400 uppercase tracking-wider font-bold mb-1">
              Room Code
            </p>
            <div className="glass px-5 py-3 rounded-2xl bg-white/5 border border-white/10">
              <p className="text-2xl font-mono font-bold tracking-[0.3em] text-indigo-400 select-all">
                {value}
              </p>
            </div>
          </div>
          <p className="text-xs text-zinc-500 text-center max-w-xs">
            Scan QR code or enter this code on another device
          </p>
        </div>
      )}

      <Button
        variant="secondary"
        onClick={handleCopy}
        className="w-full h-11 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-all font-bold uppercase tracking-wider text-xs gap-3 group"
      >
        {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 group-hover:text-indigo-400 transition-colors" />}
        {copied ? t.common.copied : t.common.copy}
      </Button>
    </div>
  );
}
