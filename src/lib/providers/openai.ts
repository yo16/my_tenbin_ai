import OpenAI from "openai";
import type {
  Response as OpenAIResponse,
  ResponseOutputMessage,
  ResponseOutputText,
  ResponseCreateParamsNonStreaming,
} from "openai/resources/responses/responses";
import { ChatMessage, ModelConfig } from "@/types";
import { ProviderResponse } from "./index";

// GPT-5系やo系の推論モデルはtemperatureが使えない
function isReasoningModel(modelId: string): boolean {
  return /^(gpt-5|o[1-4])/.test(modelId);
}

function extractCitations(response: OpenAIResponse): string[] | undefined {
  const urls: string[] = [];
  for (const item of response.output) {
    if (item.type !== "message") continue;
    const message = item as ResponseOutputMessage;
    for (const contentItem of message.content) {
      if (contentItem.type !== "output_text") continue;
      const outputText = contentItem as ResponseOutputText;
      for (const annotation of outputText.annotations) {
        if (annotation.type === "url_citation") {
          urls.push(annotation.url);
        }
      }
    }
  }
  return urls.length > 0 ? urls : undefined;
}

export class OpenAIProvider {
  async chat(
    messages: ChatMessage[],
    config: ModelConfig
  ): Promise<ProviderResponse> {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const reasoning = isReasoningModel(config.modelId);

    const params: ResponseCreateParamsNonStreaming = {
      model: config.modelId,
      input: messages.map((m) => ({ role: m.role, content: m.content })),
      max_output_tokens: config.parameters.maxTokens,
      tools: [{ type: "web_search" }],
      stream: false,
      ...(reasoning ? {} : { temperature: config.parameters.temperature }),
    };

    const response = await client.responses.create(params);
    const citations = extractCitations(response);

    return {
      content: response.output_text,
      tokenCount: {
        prompt: response.usage?.input_tokens ?? 0,
        completion: response.usage?.output_tokens ?? 0,
        total: response.usage?.total_tokens ?? 0,
      },
      ...(citations !== undefined ? { citations } : {}),
    };
  }
}
