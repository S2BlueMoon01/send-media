import { motion } from 'framer-motion';
import { Upload, Download, Wifi, Shield, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSettings } from '@/hooks/useSettings';
import SettingsBar from '@/components/SettingsBar';

interface LandingProps {
  onSelectRole: (role: 'sender' | 'receiver') => void;
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

export default function Landing({ onSelectRole }: LandingProps) {
  const { t } = useSettings();

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
      <SettingsBar />
      
      {/* Background decorations */}
      <div className="absolute inset-0 bg-grid opacity-40 pointer-events-none" />
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative z-10 w-full max-w-2xl flex flex-col items-center gap-8 text-center"
      >
        {/* Logo & Title */}
        <motion.div variants={item} className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-2">
            <Wifi className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
            <span className="gradient-text">{t.landing.title}</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-md">
            {t.landing.subtitle}
          </p>
        </motion.div>

        {/* Feature badges */}
        <motion.div variants={item} className="flex flex-wrap justify-center gap-3 text-xs sm:text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5 glass rounded-full px-3 py-1.5">
            <Shield className="w-3.5 h-3.5 text-green-400" /> {t.landing.encrypted}
          </span>
          <span className="flex items-center gap-1.5 glass rounded-full px-3 py-1.5">
            <Zap className="w-3.5 h-3.5 text-yellow-400" /> {t.landing.noLimit}
          </span>
          <span className="flex items-center gap-1.5 glass rounded-full px-3 py-1.5">
            <Wifi className="w-3.5 h-3.5 text-indigo-400" /> {t.landing.p2p}
          </span>
        </motion.div>

        {/* Role selection */}
        <motion.div variants={item} className="w-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-2xl px-4">
            <motion.button
              whileHover={{ scale: 1.02, y: -5 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelectRole('sender')}
              className="flex flex-col items-center gap-6 p-8 glass-strong rounded-[2.5rem] border-border hover:border-indigo-500/50 transition-all group relative overflow-hidden ring-1 ring-border shadow-xl dark:shadow-none"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="w-20 h-20 rounded-3xl bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 ring-1 ring-indigo-500/20">
                <Upload className="w-10 h-10 text-indigo-500 dark:text-indigo-400" />
              </div>
              <div className="text-center relative z-10">
                <h3 className="text-2xl font-black tracking-tight">{t.landing.sendFiles}</h3>
                <p className="text-sm text-muted-foreground mt-2 font-medium">{t.landing.sendFilesDesc}</p>
              </div>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02, y: -5 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelectRole('receiver')}
              className="flex flex-col items-center gap-6 p-8 glass-strong rounded-[2.5rem] border-border hover:border-purple-500/50 transition-all group relative overflow-hidden ring-1 ring-border shadow-xl dark:shadow-none"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="w-20 h-20 rounded-3xl bg-purple-500/10 dark:bg-purple-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 ring-1 ring-purple-500/20">
                <Download className="w-10 h-10 text-purple-500 dark:text-purple-400" />
              </div>
              <div className="text-center relative z-10">
                <h3 className="text-2xl font-black tracking-tight">{t.landing.receiveFiles}</h3>
                <p className="text-sm text-muted-foreground mt-2 font-medium">{t.landing.receiveFilesDesc}</p>
              </div>
            </motion.button>
          </div>
        </motion.div>

        {/* How it works */}
        <motion.div variants={item} className="w-full max-w-lg">
          <p className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider">{t.landing.howItWorks}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            {[
              { step: '1', title: t.landing.step1Title, desc: t.landing.step1Desc },
              { step: '2', title: t.landing.step2Title, desc: t.landing.step2Desc },
              { step: '3', title: t.landing.step3Title, desc: t.landing.step3Desc },
            ].map((s) => (
              <div key={s.step} className="flex flex-col items-center gap-2 text-center">
                <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm">
                  {s.step}
                </div>
                <p className="font-medium">{s.title}</p>
                <p className="text-muted-foreground text-xs">{s.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
