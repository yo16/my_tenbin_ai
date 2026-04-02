"use client";

import { useState, KeyboardEvent } from "react";
import styles from "./PromptInput.module.css";

interface PromptInputProps {
  onSend: (prompt: string) => void;
  disabled: boolean;
}

export function PromptInput({ onSend, disabled }: PromptInputProps) {
  const [text, setText] = useState("");

  const handleSend = () => {
    const trimmed = text.trim();
    if (trimmed && !disabled) {
      onSend(trimmed);
      setText("");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.ctrlKey && e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.inputRow}>
        <textarea
          className={styles.textarea}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="プロンプトを入力..."
          disabled={disabled}
          rows={3}
        />
        <button
          className={styles.sendButton}
          onClick={handleSend}
          disabled={disabled || !text.trim()}
        >
          送信
        </button>
      </div>
      <p className={styles.hint}>Ctrl + Enter で送信</p>
    </div>
  );
}
