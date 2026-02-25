import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Send, X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ChatMessage } from '@/hooks/useWebRTC';
import { useSettings } from '@/hooks/useSettings';

interface MiniChatProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
}

export default function MiniChat({ messages, onSendMessage }: MiniChatProps) {
  const { t } = useSettings();
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  // Auto-open on new message
  useEffect(() => {
    if (messages.length > 0 && messages[messages.length - 1].sender === 'peer') {
      setIsOpen(true);
    }
  }, [messages]);

  const handleSend = () => {
    if (text.trim()) {
      onSendMessage(text);
      setText('');
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 pointer-events-none">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="w-[320px] h-[400px] glass border border-white/10 rounded-2xl shadow-2xl flex flex-col pointer-events-auto"
          >
            {/* Header */}
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-400" />
                <span className="font-bold text-sm uppercase tracking-tight">{t.room.chat}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="h-8 w-8 rounded-full">
                <ChevronDown className="w-4 h-4" />
              </Button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {messages.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground mt-4">{t.room.noMessages}</p>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className={`flex ${m.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs ${
                        m.sender === 'me'
                          ? 'bg-indigo-600 text-white rounded-br-none'
                          : 'bg-muted text-foreground rounded-bl-none border border-border'
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-border flex items-center gap-2">
              <Input
                placeholder={t.room.typeMessage}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                className="h-9 text-xs bg-background border-input focus:border-indigo-500"
              />
              <Button size="icon" onClick={handleSend} disabled={!text.trim()} className="h-9 w-9 bg-indigo-600 shrink-0">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full shadow-2xl pointer-events-auto flex items-center justify-center relative flex-shrink-0 overflow-hidden transition-colors ${
          isOpen ? 'bg-indigo-600' : 'bg-indigo-600'
        }`}
      >
        {isOpen ? (
          <X className="w-6 h-6 text-white relative z-10" />
        ) : (
          <MessageSquare className="w-6 h-6 text-white relative z-10" />
        )}
        {!isOpen && messages.length > 0 && (
          <span className="absolute top-2 right-2 w-5 h-5 bg-purple-500 rounded-full text-[10px] font-bold flex items-center justify-center border-2 border-background animate-bounce text-white z-20">
            {messages.length}
          </span>
        )}
      </motion.button>
    </div>
  );
}
