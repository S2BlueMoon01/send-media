import { motion } from 'framer-motion';
import { ArrowLeft, Loader2, QrCode, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import QRScanner from './QRScanner';
import QRDisplay from './QRDisplay';
import { useSettings } from '@/hooks/useSettings';
import { ConnectionState } from '@/hooks/useWebRTC';

interface SenderSetupProps {
  connectionState: ConnectionState;
  localSignal: string | null;
  signalStatus: 'gathering' | 'ready' | null;
  error: string | null;
  onCreateOffer: () => void;
  onAcceptAnswer: (answer: string) => void;
  onReset: () => void;
  onClearError: () => void;
  onBack: () => void;
}

export default function SenderSetup({
  connectionState,
  localSignal,
  signalStatus,
  error,
  onCreateOffer,
  onAcceptAnswer,
  onReset,
  onClearError,
  onBack,
}: SenderSetupProps) {
  const { t } = useSettings();
  const isConnecting = connectionState === 'connecting';
  const showQR = !!localSignal && connectionState !== 'connected';

  return (
    <div className="min-h-dvh flex flex-col items-center px-4 py-8 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid opacity-40 pointer-events-none" />
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md flex flex-col items-center gap-6"
      >
        <div className="w-full flex items-center justify-between mb-2">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> {t.common.back}
          </Button>
          <div className="flex items-center gap-2 text-sm font-medium text-indigo-400">
            <ShieldCheck className="w-4 h-4" /> P2P {t.landing.encrypted}
          </div>
        </div>

        <Card className="w-full glass-strong gradient-border shadow-2xl">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <QrCode className="w-6 h-6 text-indigo-400" /> {t.setup.sendTitle}
            </CardTitle>
            <CardDescription>
              {showQR ? t.setup.step2Offer : t.setup.step1Offer}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {!localSignal && (
              <div className="space-y-4">
                {signalStatus === 'gathering' ? (
                   <div className="flex flex-col items-center gap-4 py-8 animate-pulse text-indigo-400">
                     <Loader2 className="w-10 h-10 animate-spin" />
                     <p className="text-sm font-medium">{t.setup.gatheringSignal}</p>
                     <p className="text-[10px] text-muted-foreground text-center px-4 uppercase tracking-tighter">
                       Đang chuẩn bị khóa mã hóa & đường truyền P2P...
                     </p>
                   </div>
                ) : (
                  <Button
                    size="lg"
                    onClick={onCreateOffer}
                    disabled={isConnecting}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20"
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t.setup.generating}
                      </>
                    ) : (
                      t.setup.createConn
                    )}
                  </Button>
                )}
              </div>
            )}

            {showQR && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                <QRDisplay value={localSignal} />
              </motion.div>
            )}

            {localSignal && connectionState !== 'connected' && (
              <div className="flex flex-col gap-3">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">
                   {t.setup.step3Answer}
                </p>
                <div className="space-y-3">
                  <QRScanner onScan={onAcceptAnswer} />
                  <div className="relative">
                    <Input
                      placeholder={t.setup.pasteAnswer}
                      className="bg-background border-input focus:border-indigo-500"
                      onFocus={onClearError}
                      onChange={(e) => {
                        if (e.target.value === '') onClearError();
                        if (e.target.value.length > 50) {
                          onAcceptAnswer(e.target.value);
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
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
