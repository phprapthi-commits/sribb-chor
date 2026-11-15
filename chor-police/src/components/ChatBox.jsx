// src/components/ChatBox.jsx
import { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send } from 'lucide-react';
import useGameStore from '../store/gameStore';
import { sendChatMessage } from '../services/gameService';
import Avatar from './Avatar';

export default function ChatBox({ className = '' }) {
  const messages = useGameStore((s) => s.messages);
  const myId = useGameStore((s) => s.playerId);
  const [text, setText] = useState('');
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSend(e) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    sendChatMessage(trimmed);
    setText('');
    inputRef.current?.focus();
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      handleSend(e);
    }
  }

  return (
    <div className={`flex flex-col glass rounded-2xl overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10">
        <h3 className="text-sm font-semibold text-white/80">💬 Chat</h3>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              {msg.type === 'system' ? (
                <div className="text-center">
                  <span className="text-xs text-white/40 italic">{msg.text}</span>
                </div>
              ) : (
                <div className={`flex gap-2 items-start ${msg.senderId === myId ? 'flex-row-reverse' : ''}`}>
                  <Avatar name={msg.senderName} size="xs" className="shrink-0 mt-0.5" />
                  <div className={`max-w-[75%] ${msg.senderId === myId ? 'items-end' : 'items-start'} flex flex-col`}>
                    {msg.senderId !== myId && (
                      <span className="text-xs text-violet-300 font-medium mb-0.5">{msg.senderName}</span>
                    )}
                    <div
                      className={`px-3 py-2 rounded-2xl text-sm break-words
                        ${msg.senderId === myId
                          ? 'bg-violet-600 text-white rounded-tr-sm'
                          : 'bg-white/10 text-white rounded-tl-sm'
                        }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 border-t border-white/10 flex gap-2">
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Type a message..."
          aria-label="Chat message"
          maxLength={200}
          className="
            flex-1 bg-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/40
            border border-white/10 focus:outline-none focus:border-violet-400
            transition
          "
        />
        <button
          type="submit"
          disabled={!text.trim()}
          aria-label="Send message"
          className="
            bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed
            text-white p-2 rounded-xl transition shrink-0
          "
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}

