"use client";

import { useState, useCallback } from "react";
import { MODEL_CONFIGS } from "@/../config/models";
import { sendChatRequest } from "@/lib/api-client";
import { Conversation, ResponseState } from "@/types";

interface UseChatReturn {
  conversations: Record<string, Conversation>;
  responseStates: Record<string, ResponseState>;
  selectedModels: string[];
  expandedModelId: string | null;
  sendPrompt: (prompt: string) => Promise<void>;
  toggleModel: (modelId: string) => void;
  toggleExpand: (modelId: string) => void;
  reset: () => void;
  isSending: boolean;
}

// enabledなモデルのIDを初期選択として取得
const defaultSelectedModels = MODEL_CONFIGS.filter((m) => m.enabled).map(
  (m) => m.id
);

// enabledなモデルの初期responseStatesを生成
function buildInitialResponseStates(): Record<string, ResponseState> {
  return MODEL_CONFIGS.filter((m) => m.enabled).reduce<
    Record<string, ResponseState>
  >((acc, model) => {
    acc[model.id] = { status: "idle" };
    return acc;
  }, {});
}

export function useChat(): UseChatReturn {
  const [conversations, setConversations] = useState<
    Record<string, Conversation>
  >({});
  const [responseStates, setResponseStates] = useState<
    Record<string, ResponseState>
  >(buildInitialResponseStates());
  const [selectedModels, setSelectedModels] =
    useState<string[]>(defaultSelectedModels);
  const [expandedModelId, setExpandedModelId] = useState<string | null>(null);

  const isSending = Object.values(responseStates).some(
    (s) => s.status === "loading"
  );

  const sendPrompt = useCallback(
    async (prompt: string) => {
      if (prompt.trim() === "" || selectedModels.length === 0) return;

      // 送信前に各モデルのローディング状態とユーザーメッセージをセット
      setResponseStates((prev) => {
        const next = { ...prev };
        for (const modelId of selectedModels) {
          next[modelId] = { status: "loading" };
        }
        return next;
      });

      setConversations((prev) => {
        const next = { ...prev };
        for (const modelId of selectedModels) {
          const existing = prev[modelId] ?? { messages: [] };
          next[modelId] = {
            messages: [
              ...existing.messages,
              { role: "user", content: prompt },
            ],
          };
        }
        return next;
      });

      // 各モデルへの並列リクエスト。到着順に個別のPromiseで状態更新する
      const promises = selectedModels.map((modelId) => {
        // このタイミングのconversationsのスナップショットはstate更新前なので、
        // ユーザーメッセージを含む会話履歴を直接組み立てる
        const currentMessages = [
          ...(conversations[modelId]?.messages ?? []),
          { role: "user" as const, content: prompt },
        ];

        return sendChatRequest(modelId, currentMessages)
          .then((result) => {
            setConversations((prev) => {
              const existing = prev[modelId] ?? { messages: [] };
              return {
                ...prev,
                [modelId]: {
                  messages: [
                    ...existing.messages,
                    { role: "assistant", content: result.content },
                  ],
                },
              };
            });
            setResponseStates((prev) => ({
              ...prev,
              [modelId]: {
                status: "success",
                tokenCount: result.tokenCount,
              },
            }));
          })
          .catch((error: unknown) => {
            const message =
              error instanceof Error ? error.message : "不明なエラーが発生しました";
            setResponseStates((prev) => ({
              ...prev,
              [modelId]: {
                status: "error",
                error: message,
              },
            }));
          });
      });

      await Promise.allSettled(promises);
    },
    [selectedModels, conversations]
  );

  const toggleModel = useCallback((modelId: string) => {
    setSelectedModels((prev) =>
      prev.includes(modelId)
        ? prev.filter((id) => id !== modelId)
        : [...prev, modelId]
    );
  }, []);

  const toggleExpand = useCallback((modelId: string) => {
    setExpandedModelId((prev) => (prev === modelId ? null : modelId));
  }, []);

  const reset = useCallback(() => {
    setConversations({});
    setResponseStates(buildInitialResponseStates());
    setExpandedModelId(null);
  }, []);

  return {
    conversations,
    responseStates,
    selectedModels,
    expandedModelId,
    sendPrompt,
    toggleModel,
    toggleExpand,
    reset,
    isSending,
  };
}
