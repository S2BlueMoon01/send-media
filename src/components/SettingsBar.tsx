import { motion } from 'framer-motion';
import { Moon, Sun, Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSettings } from '@/hooks/useSettings';

export default function SettingsBar() {
  const { theme, setTheme, language, setLanguage } = useSettings();

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed top-4 right-4 z-50 flex items-center p-1.5 glass rounded-full shadow-lg"
    >
      {/* Theme Switcher */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className="w-8 h-8 rounded-full hover:bg-transparent"
      >
        {theme === 'dark' ? (
          <Sun className="w-4 h-4 text-yellow-400" />
        ) : (
          <Moon className="w-4 h-4 text-indigo-500" />
        )}
      </Button>

      <span className="mx-1 text-muted-foreground/30 font-light">|</span>

      {/* Language Switcher */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setLanguage(language === 'vi' ? 'en' : 'vi')}
        className="h-8 px-2 text-[10px] font-black uppercase hover:bg-transparent gap-1.5"
      >
        <Languages className="w-3.5 h-3.5" />
        {language}
      </Button>
    </motion.div>
  );
}
