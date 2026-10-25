import {
  GoogleGenAI,
  type GenerateContentResponse,
  type GroundingChunk,
} from "@google/genai";
import { ChatMessage, ModelConfig } from "@/types";
import { ProviderResponse } from "./index";

function extractCitations(
  response: GenerateContentResponse
): string[] | undefined {
  const urls = new Set<string>();
  const chunks: GroundingChunk[] | undefined =
    response.candidates?.[0]?.groundingMetadata?.groundingChunks;

  if (!Array.isArray(chunks)) return undefined;

  for (const chunk of chunks) {
    const uri = chunk.web?.uri;
    if (typeof uri === "string" && uri.length > 0) {
      urls.add(uri);
    }
  }

  return urls.size > 0 ? Array.from(urls) : undefined;
}

export class GeminiProvider {
  async chat(
    messages: ChatMessage[],
    config: ModelConfig
  ): Promise<ProviderResponse> {
    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

    const contents = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const response = await ai.models.generateContent({
      model: config.modelId,
      contents,
      config: {
        temperature: config.parameters.temperature,
        maxOutputTokens: config.parameters.maxTokens,
        tools: [{ googleSearch: {} }],
      },
    });

    const citations = extractCitations(response);

    return {
      content: response.text ?? "",
      tokenCount: {
        prompt: response.usageMetadata?.promptTokenCount ?? 0,
        completion: response.usageMetadata?.candidatesTokenCount ?? 0,
        total: response.usageMetadata?.totalTokenCount ?? 0,
      },
      ...(citations !== undefined ? { citations } : {}),
    };
  }
}
