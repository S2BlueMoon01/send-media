import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion } from 'framer-motion';
import { Upload, FilePlus } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';

interface FileDropZoneProps {
  onFilesSelected: (files: File[]) => void;
}

export default function FileDropZone({ onFilesSelected }: FileDropZoneProps) {
  const { t } = useSettings();
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onFilesSelected(acceptedFiles);
      }
    },
    [onFilesSelected],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  return (
    <div {...getRootProps()}>
      <motion.div
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className={`glass rounded-2xl p-10 flex flex-col items-center gap-4 cursor-pointer border-2 border-dashed transition-all duration-300 ${
          isDragActive
            ? 'border-indigo-500 bg-indigo-500/10 shadow-[0_0_30px_rgba(99,102,241,0.2)]'
            : 'border-white/10 hover:border-white/20'
        }`}
      >
        <input {...getInputProps()} />
        <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors duration-300 ${
          isDragActive ? 'bg-indigo-500 text-white' : 'bg-indigo-500/10 text-indigo-400'
        }`}>
          {isDragActive ? <FilePlus className="w-7 h-7" /> : <Upload className="w-7 h-7" />}
        </div>
        <div className="text-center">
          <p className="font-bold text-lg">{isDragActive ? t.transfer.readyToTransfer : t.room.dropFiles}</p>
          <p className="text-sm text-muted-foreground mt-1">{t.room.clickBrowse}</p>
        </div>
      </motion.div>
    </div>
  );
}
