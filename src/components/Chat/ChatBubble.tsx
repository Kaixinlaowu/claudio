import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Send, X, MessageCircle } from 'lucide-react';
import Markdown from 'react-markdown';
import { useChatStore } from '../../lib/state/chatStore';
import usePlayerStore from '../../lib/state/playerStore';
import styles from './ChatBubble.module.css';

export function ChatBubble() {
  const [input, setInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const { messages, isLoading, sendMessage } = useChatStore();
  const { isPlaying } = usePlayerStore();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Click outside to close
  useEffect(() => {
    if (!isExpanded) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        setIsExpanded(false);
      }
    };
    // Delay adding listener to avoid immediate close from toggle click
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleMouseDown);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [isExpanded]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const text = input.trim();
    setInput('');
    await sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const chatOverlay = isExpanded ? createPortal(
    <div className={styles.chatOverlay}>
      <div className={styles.chatBox} ref={overlayRef}>
        <div className={styles.header}>
          <div className={styles.headerInfo}>
            <span className={styles.headerTitle}>Claudio</span>
            <span className={styles.headerStatus}>
              <span className={styles.statusDot}></span>
              {isPlaying ? '正在播放' : '等待中'}
            </span>
          </div>
          <button
            className={styles.clearBtn}
            onClick={() => useChatStore.getState().clearMessages()}
          >
            清空
          </button>
          <button
            className={styles.closeBtn}
            onClick={() => setIsExpanded(false)}
            aria-label="关闭聊天"
          >
            <X size={14} />
          </button>
        </div>

        <div className={styles.messages}>
          {messages.length === 0 && (
            <div className={styles.welcome}>
              <div className={styles.welcomeIcon}>🎧</div>
              <p className={styles.welcomeText}>
                你好，我是 Claudio<br />
                今天想听什么类型的音乐？
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`${styles.message} ${msg.role === 'user' ? styles.user : styles.assistant}`}
            >
              <div className={styles.bubble}>
                <Markdown>{msg.content}</Markdown>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className={`${styles.message} ${styles.assistant}`}>
              <div className={styles.bubble}>
                <div className={styles.typing}>
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className={styles.inputArea}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="说点什么..."
            className={styles.input}
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            className={styles.sendBtn}
            disabled={!input.trim() || isLoading}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button
        className={`${styles.toggleBtn} ${isPlaying ? styles.playing : ''} ${isExpanded ? styles.active : ''}`}
        onClick={() => setIsExpanded(!isExpanded)}
        aria-label="聊天"
      >
        <MessageCircle size={18} />
      </button>
      {chatOverlay}
    </>
  );
}
