import { motion } from 'framer-motion';
import { LogOut, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import FileDropZone from './FileDropZone';
import FileList from './FileList';
import MiniChat from './MiniChat';
import type { ConnectionState, FileTransfer, ChatMessage } from '@/hooks/useWebRTC';
import { useSettings } from '@/hooks/useSettings';

interface TransferRoomProps {
  connectionState: ConnectionState;
  transfers: FileTransfer[];
  messages: ChatMessage[];
  role: 'sender' | 'receiver';
  onSendFiles: (files: File[]) => void;
  onCancelTransfer: (id: string) => void;
  onSendMessage: (text: string) => void;
  onDisconnect: () => void;
}

export default function TransferRoom({
  connectionState,
  transfers,
  messages,
  role,
  onSendFiles,
  onCancelTransfer,
  onSendMessage,
  onDisconnect,
}: TransferRoomProps) {
  const { t } = useSettings();
  const isConnected = connectionState === 'connected';

  return (
    <div className="min-h-dvh flex flex-col items-center px-4 py-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid opacity-40 pointer-events-none" />
      <div className="absolute top-1/3 -left-32 w-96 h-96 bg-indigo-600/8 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/3 -right-32 w-96 h-96 bg-purple-600/8 rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-lg flex flex-col gap-5"
      >
        {/* Header / Status */}
        <div className="glass rounded-2xl p-4 flex items-center justify-between border-border ring-1 ring-border shadow-lg">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full animate-pulse ${isConnected ? 'bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.5)]' : 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.5)]'}`} />
            <div>
              <p className="text-sm font-bold tracking-tight uppercase opacity-80">
                {isConnected ? t.room.connected : t.room.disconnected}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest leading-none mt-0.5">
                {t.room.role}: {role === 'sender' ? t.landing.sendFiles : t.landing.receiveFiles}
              </p>
            </div>
          </div>

          <Button variant="ghost" size="sm" onClick={onDisconnect} className="gap-2 text-muted-foreground hover:text-destructive">
            <LogOut className="w-4 h-4" /> {t.room.leave}
          </Button>
        </div>

        {/* Action Zone */}
        {role === 'sender' && isConnected ? (
          <FileDropZone onFilesSelected={onSendFiles} />
        ) : !isConnected ? (
          <div className="glass rounded-2xl p-12 flex flex-col items-center gap-4 text-center border-dashed border-white/10">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
              <WifiOff className="w-8 h-8 text-red-400" />
            </div>
            <div>
              <h3 className="font-bold text-lg">{t.room.connectionLost}</h3>
              <p className="text-sm text-muted-foreground">{t.room.peerDisconnected}</p>
            </div>
            <Button variant="outline" onClick={onDisconnect}>
              {t.room.returnHome}
            </Button>
          </div>
        ) : (
          <div className="glass rounded-2xl p-12 flex flex-col items-center gap-4 text-center border-dashed border-white/10">
            <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center animate-bounce">
              <Wifi className="w-8 h-8 text-indigo-400" />
            </div>
            <p className="text-sm text-muted-foreground">
              {t.room.waitingFiles}
            </p>
          </div>
        )}

        {/* Transfer List */}
        {transfers.length > 0 && (
          <FileList transfers={transfers} onCancel={onCancelTransfer} />
        )}

        {/* Chat */}
        {isConnected && (
          <MiniChat messages={messages} onSendMessage={onSendMessage} />
        )}
      </motion.div>
    </div>
  );
}
