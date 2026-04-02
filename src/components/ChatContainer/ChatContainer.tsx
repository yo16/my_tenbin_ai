"use client";

import { MODEL_CONFIGS } from "@/../config/models";
import { useChat } from "@/hooks/useChat";
import { Header } from "@/components/Header/Header";
import { ResponsePanel } from "@/components/ResponsePanel/ResponsePanel";
import { ModelSelector } from "@/components/ModelSelector/ModelSelector";
import { PromptInput } from "@/components/PromptInput/PromptInput";
import styles from "./ChatContainer.module.css";

export function ChatContainer() {
  const {
    conversations,
    responseStates,
    selectedModels,
    expandedModelId,
    sendPrompt,
    toggleModel,
    toggleExpand,
    reset,
    isSending,
  } = useChat();

  // selectedModels に含まれるモデルを enabled: true として ModelConfig[] を構築
  const models = MODEL_CONFIGS.map((model) => ({
    ...model,
    enabled: selectedModels.includes(model.id),
  }));

  // 1つでもメッセージがあれば true
  const hasConversation = Object.values(conversations).some(
    (conv) => conv.messages.length > 0
  );

  return (
    <div className={styles.container}>
      <Header onReset={reset} hasConversation={hasConversation} />
      <ResponsePanel
        models={models}
        conversations={conversations}
        responseStates={responseStates}
        expandedModelId={expandedModelId}
        onToggleExpand={toggleExpand}
      />
      <ModelSelector
        models={MODEL_CONFIGS}
        selectedModels={selectedModels}
        onToggleModel={toggleModel}
        disabled={isSending}
      />
      <PromptInput onSend={sendPrompt} disabled={isSending} />
    </div>
  );
}
