"use client";

import type { ModelConfig, Conversation, ResponseState } from "@/types";
import { ResponseColumn } from "@/components/ResponseColumn/ResponseColumn";
import styles from "./ResponsePanel.module.css";

interface ResponsePanelProps {
  /** モデル設定一覧 */
  models: ModelConfig[];
  /** 各モデルの会話履歴 */
  conversations: Record<string, Conversation>;
  /** 各モデルのレスポンス状態 */
  responseStates: Record<string, ResponseState>;
  /** 拡大表示中のモデルID */
  expandedModelId: string | null;
  /** カラムクリック時のコールバック */
  onToggleExpand: (modelId: string) => void;
}

export function ResponsePanel({
  models,
  conversations,
  responseStates,
  expandedModelId,
  onToggleExpand,
}: ResponsePanelProps) {
  const isExpanded = expandedModelId !== null;

  // 選択されたモデル（enabled）のみを対象とする
  const selectedModels = models.filter((model) => model.enabled);
  const columnCount = selectedModels.length;

  const panelClassName = [
    styles.panel,
    isExpanded ? styles.panelExpanded : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={panelClassName}
      data-columns={isExpanded ? undefined : String(columnCount)}
    >
      {selectedModels.map((model) => {
        // 拡大時は expandedModelId 以外を非表示
        if (isExpanded && model.id !== expandedModelId) {
          return null;
        }

        const defaultResponseState: ResponseState = { status: "idle" };

        return (
          <ResponseColumn
            key={model.id}
            model={model}
            conversation={conversations[model.id]}
            responseState={responseStates[model.id] ?? defaultResponseState}
            isExpanded={isExpanded && model.id === expandedModelId}
            onToggleExpand={() => onToggleExpand(model.id)}
          />
        );
      })}
    </div>
  );
}
