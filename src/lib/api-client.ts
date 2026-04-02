import { ChatMessage, ChatResponse } from "@/types";

export async function sendChatRequest(
  modelId: string,
  messages: ChatMessage[]
): Promise<ChatResponse> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ modelId, messages }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error ?? "APIリクエストに失敗しました");
  }

  return response.json();
}
