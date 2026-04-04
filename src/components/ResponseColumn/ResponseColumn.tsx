"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { ModelConfig, Conversation, ResponseState } from "@/types";
import { MarkdownRenderer } from "@/components/MarkdownRenderer/MarkdownRenderer";
import { LoadingIndicator } from "@/components/LoadingIndicator/LoadingIndicator";
import styles from "./ResponseColumn.module.css";

interface ResponseColumnProps {
  /** モデル設定 */
  model: ModelConfig;
  /** 会話履歴 */
  conversation: Conversation | undefined;
  /** レスポンス状態 */
  responseState: ResponseState;
  /** 拡大表示中かどうか */
  isExpanded: boolean;
  /** カラムクリック時のコールバック */
  onToggleExpand: () => void;
}

export function ResponseColumn({
  model,
  conversation,
  responseState,
  isExpanded,
  onToggleExpand,
}: ResponseColumnProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const handleScroll = () => {
      const { scrollHeight, scrollTop, clientHeight } = el;
      setIsAtBottom(scrollHeight - scrollTop - clientHeight < 100);
    };

    el.addEventListener("scroll", handleScroll);
    return () => {
      el.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const handleScrollToBottom = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const el = contentRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);

  // 最新のアシスタントメッセージを取得
  const latestAssistantMessage = conversation?.messages
    .filter((m) => m.role === "assistant")
    .at(-1);

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      // カラム拡大と競合しないようにイベント伝播を止める
      e.stopPropagation();

      if (!latestAssistantMessage) return;

      try {
        await navigator.clipboard.writeText(latestAssistantMessage.content);
        setIsCopied(true);
        setTimeout(() => {
          setIsCopied(false);
        }, 2000);
      } catch {
        // クリップボードへの書き込みに失敗した場合は何もしない
      }
    },
    [latestAssistantMessage]
  );

  const columnClassName = [
    styles.column,
    isExpanded ? styles.columnExpanded : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={columnClassName}>
      {/* ヘッダー部（クリックで拡大/縮小） */}
      <div className={styles.columnHeader} data-provider={model.provider} onClick={onToggleExpand}>
        <div className={styles.headerLeft}>
          <span className={styles.modelName}>{model.name}</span>
          <span className={styles.modelId}>{model.modelId}</span>
        </div>
        {responseState.tokenCount !== undefined && (
          <span className={styles.tokenCount}>
            {responseState.tokenCount.total.toLocaleString()} tokens
          </span>
        )}
      </div>

      {/* 回答本文エリア */}
      <div className={styles.content} ref={contentRef}>
        {/* 会話履歴 */}
        {conversation?.messages.map((message, index) => {
          if (message.role === "user") {
            return (
              <div key={index} className={styles.userMessage}>
                {message.content}
              </div>
            );
          }
          return (
            <div key={index} className={styles.assistantMessage}>
              <MarkdownRenderer content={message.content} />
            </div>
          );
        })}

        {/* ローディング表示 */}
        {responseState.status === "loading" && (
          <LoadingIndicator modelName={model.name} />
        )}

        {/* エラー表示 */}
        {responseState.status === "error" && responseState.error && (
          <div className={styles.error}>{responseState.error}</div>
        )}

        {/* 一番下へスクロールボタン */}
        {!isAtBottom && (
          <button
            className={styles.scrollToBottom}
            onClick={handleScrollToBottom}
            aria-label="一番下へスクロール"
          >
            ↓
          </button>
        )}
      </div>

      {/* フッター（コピーボタン） */}
      <div className={styles.columnFooter}>
        <button
          className={[
            styles.copyButton,
            isCopied ? styles.copyButtonSuccess : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={handleCopy}
          disabled={!latestAssistantMessage}
          aria-label="最新の回答をコピー"
        >
          {isCopied ? "コピー済み" : "コピー"}
        </button>
      </div>
    </div>
  );
}
