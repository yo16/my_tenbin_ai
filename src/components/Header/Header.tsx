"use client";

import styles from "./Header.module.css";

interface HeaderProps {
  /** リセットボタン押下時のコールバック */
  onReset: () => void;
  /** 会話が存在するか（リセットボタンの有効/無効制御） */
  hasConversation: boolean;
}

export function Header({ onReset, hasConversation }: HeaderProps) {
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>my天秤AI</h1>
      <button
        className={styles.resetButton}
        onClick={onReset}
        disabled={!hasConversation}
        aria-label="会話をリセットする"
      >
        リセット
      </button>
    </header>
  );
}
