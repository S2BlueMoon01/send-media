import { motion } from 'framer-motion';
import { ArrowLeft, Loader2, QrCode, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ConnectionState } from '@/hooks/useWebRTC';
import QRScanner from './QRScanner';
import QRDisplay from './QRDisplay';
import { useSettings } from '@/hooks/useSettings';

interface ReceiverSetupProps {
  connectionState: ConnectionState;
  localSignal: string | null;
  signalStatus: 'gathering' | 'ready' | null;
  error: string | null;
  onAcceptOffer: (offer: string) => void;
  onReset: () => void;
  onClearError: () => void;
  onBack: () => void;
}

export default function ReceiverSetup({
  connectionState,
  localSignal,
  signalStatus,
  error,
  onAcceptOffer,
  onReset,
  onClearError,
  onBack,
}: ReceiverSetupProps) {
  const { t } = useSettings();
  const isConnecting = connectionState === 'connecting';
  const showQR = !!localSignal && connectionState !== 'connected';

  return (
    <div className="min-h-dvh flex flex-col items-center px-4 py-8 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid opacity-40 pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md flex flex-col items-center gap-6"
      >
        <div className="w-full flex items-center justify-between mb-2">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> {t.common.back}
          </Button>
          <div className="flex items-center gap-2 text-sm font-medium text-purple-400">
            <ShieldCheck className="w-4 h-4" /> P2P {t.landing.encrypted}
          </div>
        </div>

        <Card className="w-full glass-strong gradient-border shadow-2xl">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <QrCode className="w-6 h-6 text-purple-400" /> {t.setup.receiveTitle}
            </CardTitle>
            <CardDescription>
              {showQR ? t.setup.step2Answer : t.setup.step1Receive}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {!localSignal && (
              <div className="space-y-4">
                {signalStatus === 'gathering' ? (
                  <div className="flex flex-col items-center gap-4 py-8 animate-pulse text-purple-400">
                    <Loader2 className="w-10 h-10 animate-spin" />
                    <p className="text-sm font-medium">{t.setup.gatheringSignal}</p>
                    <p className="text-[10px] text-muted-foreground text-center px-4 uppercase tracking-tighter">
                      Đang mã hóa & dò tìm đường truyền (có thể mất 10-15s)...
                    </p>
                  </div>
                ) : (
                  <>
                    <QRScanner onScan={onAcceptOffer} />
                    <div className="space-y-3">
                      <Input
                        placeholder={t.setup.pasteOffer}
                        className="bg-background border-input focus:border-purple-500"
                        onFocus={onClearError}
                        onChange={(e) => {
                          if (e.target.value === '') onClearError();
                          if (e.target.value.length > 50) {
                            onAcceptOffer(e.target.value);
                          }
                        }}
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {showQR && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
                <QRDisplay value={localSignal} />
                <div className="space-y-3">
                  <p className="text-center text-sm text-muted-foreground animate-pulse">
                    {t.setup.waitingConn}
                  </p>
                  <Button variant="ghost" size="sm" onClick={onReset} className="w-full text-muted-foreground text-xs">
                    {t.common.cancel} & {t.common.connect} (Retry)
                  </Button>
                </div>
              </motion.div>
            )}

            {error && (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm text-center">
                  {t.common.error}: {t.setup[error as keyof typeof t.setup] || error}
                </div>
                <Button variant="outline" onClick={onReset} className="w-full border-zinc-200 dark:border-zinc-800">
                  {t.common.connect} (Retry)
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
