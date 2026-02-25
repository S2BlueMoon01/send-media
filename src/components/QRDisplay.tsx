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

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <div className="glass p-5 rounded-3xl bg-white border-none shadow-2xl relative group">
        {isTooLarge ? (
          <div className="w-48 h-48 sm:w-64 sm:h-64 flex flex-col items-center justify-center gap-4 text-center p-4">
            <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
              <Info className="w-6 h-6 text-yellow-600" />
            </div>
            <p className="text-xs text-zinc-500 font-medium leading-relaxed">
              {t.qr.tooLarge}
            </p>
          </div>
        ) : (
          <div className="relative p-1">
             <QRCodeSVG
              value={value}
              size={typeof window !== 'undefined' && window.innerWidth < 640 ? 240 : 320}
              level="L"
              includeMargin={true}
              className="rounded-lg"
            />
            <div className="absolute inset-0 border-2 border-indigo-500/20 rounded-lg pointer-events-none" />
          </div>
        )}
      </div>

      <Button
        variant="secondary"
        onClick={handleCopy}
        className="w-full h-12 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-all font-bold uppercase tracking-wider text-xs gap-3 group"
      >
        {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 group-hover:text-indigo-400 transition-colors" />}
        {copied ? t.common.copied : t.common.copy}
      </Button>
    </div>
  );
}
