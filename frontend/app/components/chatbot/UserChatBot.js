"use client";

import { useState, useRef, useEffect } from "react";
import styles from "@/styles/ChatBot.module.css";

// Format markdown-like text to HTML
const formatMessage = (text) => {
  if (!text) return null;

  // Split into lines
  const lines = text.split('\n');
  const elements = [];
  let currentList = [];
  let currentListType = null; // 'ul' or 'ol'
  
  const flushList = () => {
    if (currentList.length > 0) {
      if (currentListType === 'ul') {
        elements.push(
          <ul key={`ul-${elements.length}`} style={{ margin: '8px 0', paddingLeft: '20px' }}>
            {currentList.map((item, idx) => (
              <li key={idx} dangerouslySetInnerHTML={{ __html: item }} />
            ))}
          </ul>
        );
      } else if (currentListType === 'ol') {
        elements.push(
          <ol key={`ol-${elements.length}`} style={{ margin: '8px 0', paddingLeft: '20px' }}>
            {currentList.map((item, idx) => (
              <li key={idx} dangerouslySetInnerHTML={{ __html: item }} />
            ))}
          </ol>
        );
      }
      currentList = [];
      currentListType = null;
    }
  };

  lines.forEach((line, lineIdx) => {
    // Check for bullet points (*, -, •)
    const bulletMatch = line.match(/^[\s]*[*\-•]\s+(.+)$/);
    if (bulletMatch) {
      if (currentListType !== 'ul') {
        flushList();
        currentListType = 'ul';
      }
      currentList.push(formatInlineMarkdown(bulletMatch[1]));
      return;
    }

    // Check for numbered lists (1., 2., etc.)
    const numberedMatch = line.match(/^[\s]*(\d+)\.\s+(.+)$/);
    if (numberedMatch) {
      if (currentListType !== 'ol') {
        flushList();
        currentListType = 'ol';
      }
      currentList.push(formatInlineMarkdown(numberedMatch[2]));
      return;
    }

    // If we're here, it's not a list item, so flush any pending list
    flushList();

    // Handle regular text
    if (line.trim()) {
      const formatted = formatInlineMarkdown(line);
      elements.push(
        <p key={`p-${lineIdx}`} style={{ margin: '4px 0' }} dangerouslySetInnerHTML={{ __html: formatted }} />
      );
    } else {
      elements.push(<br key={`br-${lineIdx}`} />);
    }
  });

  // Flush any remaining list
  flushList();

  return elements.length > 0 ? <div>{elements}</div> : text;
};

// Format inline markdown (bold, italic, code)
const formatInlineMarkdown = (text) => {
  // Bold (**text** or __text__)
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');
  
  // Italic (*text* or _text_) - but not if it's a bullet point
  text = text.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>');
  text = text.replace(/(?<!_)_([^_]+?)_(?!_)/g, '<em>$1</em>');
  
  // Inline code (`code`)
  text = text.replace(/`(.+?)`/g, '<code style="background: rgba(0,0,0,0.1); padding: 2px 4px; border-radius: 3px; font-family: monospace;">$1</code>');
  
  // Currency symbols
  text = text.replace(/₹(\d+)/g, '<strong>₹$1</strong>');
  
  return text;
};

export default function UserChatBot({ darkMode, username }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Load messages from localStorage on mount
  useEffect(() => {
    const savedMessages = localStorage.getItem("chatbot_messages");
    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages);
        setMessages(parsedMessages);
      } catch (error) {
        console.error("Failed to load chat history:", error);
        // If parsing fails, use default welcome message
        setMessages([
          {
            type: "bot",
            text: "Hi! I'm your VyापारAI business assistant. Ask me about your sales, inventory, or any business insights!",
          },
        ]);
      }
    } else {
      // No saved messages, show welcome message
      setMessages([
        {
          type: "bot",
          text: "Hi! I'm your VyापारAI business assistant. Ask me about your sales, inventory, or any business insights!",
        },
      ]);
    }
  }, []);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem("chatbot_messages", JSON.stringify(messages));
    }
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const userMessage = inputValue.trim();
    setInputValue("");

    // Add user message
    setMessages((prev) => [...prev, { type: "user", text: userMessage }]);

    // Show loading
    setIsLoading(true);

    try {
      // Get JWT token from localStorage
      const token = localStorage.getItem("access_token");
      
      const response = await fetch("/api/user-chatbot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { "Authorization": `Bearer ${token}` }),
        },
        body: JSON.stringify({ 
          question: userMessage
        }),
      });

      const data = await response.json();
      
      // Add bot response
      setMessages((prev) => [
        ...prev,
        { type: "bot", text: data.answer || "Sorry, I couldn't process that." },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          type: "bot",
          text: "Oops! Something went wrong. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearChat = () => {
    const welcomeMessage = {
      type: "bot",
      text: "Hi! I'm your VyापारAI business assistant. Ask me about your sales, inventory, or any business insights!",
    };
    setMessages([welcomeMessage]);
    localStorage.setItem("chatbot_messages", JSON.stringify([welcomeMessage]));
  };

  return (
    <>
      {/* Floating Bot Button */}
      {!isOpen && (
        <div className={`${styles.floatingButton} ${darkMode ? styles.dark : styles.light}`} onClick={() => setIsOpen(true)}>
          <button className={styles.botButton}>
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </button>
        </div>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className={`${styles.chatWindow} ${darkMode ? styles.dark : styles.light}`}>
          {/* Header */}
          <div className={styles.chatHeader}>
            <div className={styles.headerContent}>
              <div className={styles.botAvatar}>
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="11" width="18" height="10" rx="2" />
                  <circle cx="12" cy="5" r="2" />
                  <path d="M12 7v4" />
                  <line x1="8" y1="16" x2="8" y2="16" />
                  <line x1="16" y1="16" x2="16" y2="16" />
                </svg>
              </div>
              <div className={styles.headerText}>
                <h3>VyापारAI Business Assistant</h3>
                <span className={styles.statusDot}>●</span>
                <span className={styles.statusText}>Online</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className={styles.clearButton}
                onClick={handleClearChat}
                aria-label="Clear chat"
                title="Clear chat history"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
              <button
                className={styles.closeButton}
                onClick={() => setIsOpen(false)}
                aria-label="Close chat"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className={styles.chatMessages}>
            {messages.map((message, index) => (
              <div
                key={index}
                className={`${styles.message} ${
                  message.type === "user" ? styles.userMessage : styles.botMessage
                }`}
              >
                {message.type === "bot" && (
                  <div className={styles.messageAvatar}>
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="3" y="11" width="18" height="10" rx="2" />
                      <circle cx="12" cy="5" r="2" />
                      <path d="M12 7v4" />
                    </svg>
                  </div>
                )}
                <div className={styles.messageContent}>
                  {formatMessage(message.text)}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className={`${styles.message} ${styles.botMessage}`}>
                <div className={styles.messageAvatar}>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="3" y="11" width="18" height="10" rx="2" />
                    <circle cx="12" cy="5" r="2" />
                    <path d="M12 7v4" />
                  </svg>
                </div>
                <div className={styles.messageContent}>
                  <div className={styles.typingIndicator}>
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className={styles.chatInput}>
            <input
              type="text"
              placeholder="Ask about sales, inventory, products..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || isLoading}
              aria-label="Send message"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
