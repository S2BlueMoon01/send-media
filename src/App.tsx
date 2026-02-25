import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster, toast } from 'sonner';
import { useWebRTC } from '@/hooks/useWebRTC';
import Landing from '@/components/Landing';
import SenderSetup from '@/components/SenderSetup';
import ReceiverSetup from '@/components/ReceiverSetup';
import TransferRoom from '@/components/TransferRoom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useSettings } from '@/hooks/useSettings';

type AppScreen = 'landing' | 'setup' | 'room';

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('landing');
  const [role, setRole] = useState<'sender' | 'receiver' | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const { t } = useSettings();

  const {
    connectionState,
    localSignal,
    signalStatus,
    error,
    transfers,
    messages,
    createOffer,
    acceptOffer,
    acceptAnswer,
    disconnect,
    resetConnection,
    clearError,
    sendFiles,
    cancelTransfer,
    sendMessage,
  } = useWebRTC();

  // Effect for transitioning to room on connect
  useEffect(() => {
    if (connectionState === 'connected') {
      setScreen('room');
      toast.success(t.transfer.readyToTransfer);
    }
  }, [connectionState, t.transfer.readyToTransfer]);

  // Toast for incoming files
  useEffect(() => {
    const lastTransfer = transfers[transfers.length - 1];
    if (lastTransfer?.direction === 'receive' && lastTransfer?.status === 'completed') {
      toast.success(`${t.transfer.fileReceived}: ${lastTransfer.name}`, {
        duration: 5000,
      });
    }
  }, [transfers, t.transfer.fileReceived]);

  const handleBack = () => {
    if (screen === 'room') {
      setShowLeaveConfirm(true);
    } else {
      resetConnection(); // Ensure error and localSignal are cleared when going back
      setScreen('landing');
      setRole(null);
    }
  };

  const confirmLeave = () => {
    resetConnection();
    setScreen('landing');
    setRole(null);
    setShowLeaveConfirm(false);
  };

  return (
    <main className="min-h-dvh bg-background text-foreground transition-colors duration-300">
      <Toaster position="top-center" richColors />

      <AnimatePresence mode="wait">
        {screen === 'landing' && (
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Landing onSelectRole={(r) => { setRole(r); setScreen('setup'); }} />
          </motion.div>
        )}

        {screen === 'setup' && role === 'sender' && (
          <motion.div
            key="sender-setup"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <SenderSetup
              connectionState={connectionState}
              localSignal={localSignal}
              signalStatus={signalStatus}
              error={error}
              onCreateOffer={createOffer}
              onAcceptAnswer={acceptAnswer}
              onReset={resetConnection}
              onClearError={clearError}
              onBack={handleBack}
            />
          </motion.div>
        )}

        {screen === 'setup' && role === 'receiver' && (
          <motion.div
            key="receiver-setup"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <ReceiverSetup
              connectionState={connectionState}
              localSignal={localSignal}
              signalStatus={signalStatus}
              error={error}
              onAcceptOffer={acceptOffer}
              onReset={resetConnection}
              onClearError={clearError}
              onBack={handleBack}
            />
          </motion.div>
        )}

        {screen === 'room' && (
          <motion.div
            key="room"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
          >
            <TransferRoom
              connectionState={connectionState}
              transfers={transfers}
              messages={messages}
              role={role!}
              onSendFiles={sendFiles}
              onCancelTransfer={cancelTransfer}
              onSendMessage={sendMessage}
              onDisconnect={handleBack}
            />
          </motion.div>
        )}
      </AnimatePresence>
      <Dialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.room.confirmLeaveTitle}</DialogTitle>
            <DialogDescription>
              {t.room.leaveConfirm}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-row gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowLeaveConfirm(false)} className="px-6 border-zinc-200 dark:border-zinc-800">
              {t.common.cancel}
            </Button>
            <Button variant="destructive" onClick={confirmLeave} className="px-6 bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20">
              {t.room.leave}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
