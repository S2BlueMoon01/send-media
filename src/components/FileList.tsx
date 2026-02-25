import { motion, AnimatePresence } from 'framer-motion';
import { File as FileIcon, X, CheckCircle2, Clock, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { formatBytes, formatDuration, formatDateTime } from '@/lib/utils';
import type { FileTransfer } from '@/hooks/useWebRTC';
import { useSettings } from '@/hooks/useSettings';

interface FileListProps {
  transfers: FileTransfer[];
  onCancel: (id: string) => void;
}

export default function FileList({ transfers, onCancel }: FileListProps) {
  const { t } = useSettings();

  const getStatusIcon = (status: FileTransfer['status']) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'transferring': return <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />;
      case 'cancelled': return <X className="w-4 h-4 text-muted-foreground" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusLabel = (status: FileTransfer['status']) => {
    switch (status) {
      case 'completed': return t.transfer.completed;
      case 'transferring': return t.transfer.transferring;
      case 'cancelled': return t.transfer.cancelled;
      case 'error': return t.transfer.error;
      default: return t.transfer.queued;
    }
  };

  return (
    <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
      <AnimatePresence initial={false}>
        {[...transfers].reverse().map((transfer) => (
          <motion.div
            key={transfer.id}
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, x: 20 }}
            layout
            className="glass rounded-xl p-4 border border-border flex flex-col gap-3 group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className={`p-2 rounded-lg bg-muted group-hover:bg-muted/80 transition-colors`}>
                  <FileIcon className="w-5 h-5 text-indigo-400" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-bold truncate tracking-tight">{transfer.name}</p>
                  <div className="flex flex-col gap-1">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest flex flex-wrap items-center gap-x-2">
                       <span>{formatBytes(transfer.size)}</span>
                       {transfer.startTime && transfer.endTime && (
                         <>
                           <span className="opacity-40 font-bold">•</span>
                           <span className="text-green-500 font-bold">
                             {formatDuration((transfer.endTime - transfer.startTime) / 1000)}
                           </span>
                         </>
                       )}
                    </p>
                    {transfer.startTime && (
                      <div className="flex items-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity">
                        <Clock className="w-2.5 h-2.5" />
                        <p className="text-[10px] font-mono tracking-tighter">
                          {formatDateTime(transfer.startTime)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-widest bg-white/5 border-white/5 gap-1.5 h-6">
                  {getStatusIcon(transfer.status)}
                  {getStatusLabel(transfer.status)}
                </Badge>
                
                {(transfer.status === 'queued' || transfer.status === 'transferring') && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onCancel(transfer.id)}
                    className="h-6 w-6 rounded-full hover:bg-destructive/20 hover:text-destructive"
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>

            {transfer.status === 'transferring' && (
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest px-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-indigo-400 font-black">{transfer.progress}%</span>
                    <span className="opacity-40">•</span>
                    <span className="text-emerald-500 dark:text-emerald-400 font-black">{formatBytes(transfer.speed)}/s</span>
                  </div>
                  <span className="text-muted-foreground">
                    {transfer.eta !== undefined && `ETA ${formatDuration(transfer.eta)}`}
                  </span>
                </div>
                <Progress value={transfer.progress} />
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
