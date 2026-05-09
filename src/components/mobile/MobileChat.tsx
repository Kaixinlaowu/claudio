import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, Send, Sparkles, Bot, Trash2 } from 'lucide-react';
import Markdown from 'react-markdown';
import { useChatStore } from '../../lib/state/chatStore';
import type { ChatMessage } from '../../lib/ai/types';
import styles from './MobileChat.module.css';

interface Props {
  onBack: () => void;
}

export function MobileChat({ onBack }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [input, setInput] = useState('');
  const messages = useChatStore((s) => s.messages);

  useEffect(() => {
    requestAnimationFrame(() => setIsOpen(true));
  }, []);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => onBack(), 300);
  }, [onBack]);
  const isLoading = useChatStore((s) => s.isLoading);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const clearMessages = useChatStore((s) => s.clearMessages);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    sendMessage(text);
  };

  return (
    <div className={`${styles.chat} ${isOpen ? styles.open : ''} ${isClosing ? styles.closing : ''}`}>
      <div className={styles.header}>
        <button className={styles.iconBtn} onClick={handleClose}>
          <ChevronLeft size={24} />
        </button>
        <div className={styles.headerCenter}>
          <Sparkles size={14} color="var(--accent-primary)" />
          <span className={styles.headerTitle}>Claudio AI</span>
        </div>
        <button className={styles.iconBtn} onClick={() => clearMessages()}>
          <Trash2 size={20} />
        </button>
      </div>

      <div className={styles.messageList} ref={listRef}>
        {messages.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.botAvatarLarge}>
              <Bot size={32} color="var(--accent-primary)" />
            </div>
            <p className={styles.emptyText}>嗨，我是 Claudio</p>
            <p className={styles.emptySubtext}>告诉我你想听什么</p>
          </div>
        )}

        {messages.map((msg: ChatMessage) => (
          <div
            key={msg.id}
            className={`${styles.message} ${msg.role === 'user' ? styles.userMsg : styles.aiMsg}`}
          >
            {msg.role === 'assistant' && (
              <div className={styles.botAvatar}>
                <Bot size={16} color="var(--accent-primary)" />
              </div>
            )}
            <div className={`${styles.bubble} ${msg.role === 'user' ? styles.userBubble : styles.aiBubble}`}>
              <Markdown>{msg.content}</Markdown>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className={`${styles.message} ${styles.aiMsg}`}>
            <div className={styles.botAvatar}>
              <Bot size={16} color="var(--accent-primary)" />
            </div>
            <div className={`${styles.bubble} ${styles.aiBubble} ${styles.typing}`}>
              <span className={styles.dot} />
              <span className={styles.dot} />
              <span className={styles.dot} />
            </div>
          </div>
        )}
      </div>

      <div className={styles.inputArea}>
        <input
          className={styles.input}
          type="text"
          placeholder="说点什么..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        />
        <button
          className={`${styles.sendBtn} ${input.trim() ? styles.sendActive : ''}`}
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  );
}
