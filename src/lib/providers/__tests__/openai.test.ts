/**
 * OpenAIProvider.chat() の単体テスト
 *
 * テスト対象: src/lib/providers/openai.ts
 * 前提: openai.ts が Responses API (client.responses.create) に移行済みであること。
 *       本テストはそのインターフェース仕様を明文化し、実装の正確性を保証する。
 *
 * モック戦略:
 *   - openai npm パッケージ全体を jest.mock() で差し替え
 *   - client.responses.create が返す値をテストケースごとに制御する
 *   - 実 API への通信は一切行わない
 */

import { OpenAIProvider } from "../openai";
import { ChatMessage, ModelConfig } from "@/types";

// ---------------------------------------------------------------------------
// OpenAI SDK モック
// ---------------------------------------------------------------------------

const mockResponsesCreate = jest.fn();

jest.mock("openai", () => {
  return jest.fn().mockImplementation(() => ({
    responses: {
      create: mockResponsesCreate,
    },
  }));
});

// ---------------------------------------------------------------------------
// テストフィクスチャ
// ---------------------------------------------------------------------------

/** ユーザーメッセージ1件 */
const MESSAGES: ChatMessage[] = [
  { role: "user", content: "Hello, world!" },
];

/** 通常モデル設定 (gpt-4.1) */
const NORMAL_CONFIG: ModelConfig = {
  id: "openai-gpt-4.1",
  name: "GPT-4.1",
  provider: "openai",
  modelId: "gpt-4.1",
  enabled: true,
  parameters: {
    temperature: 0.7,
    maxTokens: 1024,
  },
};

/** 推論モデル設定 (gpt-5.4-mini) */
const REASONING_CONFIG: ModelConfig = {
  id: "openai-gpt-5.4-mini",
  name: "GPT-5.4 mini",
  provider: "openai",
  modelId: "gpt-5.4-mini",
  enabled: true,
  parameters: {
    temperature: 0.7,
    maxTokens: 2048,
  },
};

/** 推論モデル設定を任意の modelId で生成するヘルパー */
function buildConfig(
  modelId: string,
  overrides: Partial<ModelConfig["parameters"]> = {}
): ModelConfig {
  return {
    id: `openai-${modelId}`,
    name: modelId,
    provider: "openai",
    modelId,
    enabled: true,
    parameters: {
      temperature: 0.7,
      maxTokens: 1024,
      ...overrides,
    },
  };
}

/**
 * Responses API の最小成功レスポンスを組み立てるヘルパー。
 * output_text と usage を外部から差し込める。
 */
function buildResponsesApiResponse({
  outputText = "Test response",
  inputTokens = 10,
  outputTokens = 20,
  totalTokens = 30,
  outputItems = [] as unknown[],
}: {
  outputText?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  outputItems?: unknown[];
} = {}) {
  return {
    output_text: outputText,
    output: outputItems,
    usage: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: totalTokens,
    },
  };
}

// ---------------------------------------------------------------------------
// テスト
// ---------------------------------------------------------------------------

describe("OpenAIProvider.chat()", () => {
  let provider: OpenAIProvider;

  beforeEach(() => {
    provider = new OpenAIProvider();
    mockResponsesCreate.mockReset();
  });

  // =========================================================================
  // 1. 通常モデル (gpt-4.1)
  // =========================================================================

  describe("通常モデル (gpt-4.1)", () => {
    it("client.responses.create を正しいパラメータで呼び出す", async () => {
      // Arrange
      mockResponsesCreate.mockResolvedValue(buildResponsesApiResponse());

      // Act
      await provider.chat(MESSAGES, NORMAL_CONFIG);

      // Assert
      expect(mockResponsesCreate).toHaveBeenCalledTimes(1);
      const callArg = mockResponsesCreate.mock.calls[0][0];

      expect(callArg.model).toBe("gpt-4.1");
      expect(callArg.input).toEqual([{ role: "user", content: "Hello, world!" }]);
      expect(callArg.tools).toEqual([{ type: "web_search" }]);
      expect(callArg.max_output_tokens).toBe(1024);
      expect(callArg.temperature).toBe(0.7);
      expect(callArg.stream).toBe(false);
    });

    it("レスポンスの output_text が content に格納される", async () => {
      // Arrange
      mockResponsesCreate.mockResolvedValue(
        buildResponsesApiResponse({ outputText: "GPT-4.1 の回答" })
      );

      // Act
      const result = await provider.chat(MESSAGES, NORMAL_CONFIG);

      // Assert
      expect(result.content).toBe("GPT-4.1 の回答");
    });

    it("usage のトークン数が tokenCount に正しくマップされる", async () => {
      // Arrange
      mockResponsesCreate.mockResolvedValue(
        buildResponsesApiResponse({
          inputTokens: 15,
          outputTokens: 25,
          totalTokens: 40,
        })
      );

      // Act
      const result = await provider.chat(MESSAGES, NORMAL_CONFIG);

      // Assert
      expect(result.tokenCount.prompt).toBe(15);
      expect(result.tokenCount.completion).toBe(25);
      expect(result.tokenCount.total).toBe(40);
    });
  });

  // =========================================================================
  // 2. 推論モデル (gpt-5.4-mini)
  // =========================================================================

  describe("推論モデル (gpt-5.4-mini)", () => {
    it("temperature が含まれない", async () => {
      // Arrange
      mockResponsesCreate.mockResolvedValue(buildResponsesApiResponse());

      // Act
      await provider.chat(MESSAGES, REASONING_CONFIG);

      // Assert
      const callArg = mockResponsesCreate.mock.calls[0][0];
      expect(callArg).not.toHaveProperty("temperature");
    });

    it("model, input, tools, max_output_tokens, stream は通常モデルと同じ形式で渡される", async () => {
      // Arrange
      mockResponsesCreate.mockResolvedValue(buildResponsesApiResponse());

      // Act
      await provider.chat(MESSAGES, REASONING_CONFIG);

      // Assert
      const callArg = mockResponsesCreate.mock.calls[0][0];
      expect(callArg.model).toBe("gpt-5.4-mini");
      expect(callArg.input).toEqual([{ role: "user", content: "Hello, world!" }]);
      expect(callArg.tools).toEqual([{ type: "web_search" }]);
      expect(callArg.max_output_tokens).toBe(2048);
      expect(callArg.stream).toBe(false);
    });

    it.each(["o1", "o2", "o3", "o4", "o1-mini", "o3-mini"])(
      "%s モデルでも temperature が含まれない（o系推論モデル）",
      async (modelId) => {
        // Arrange
        mockResponsesCreate.mockResolvedValue(buildResponsesApiResponse());

        // Act
        await provider.chat(MESSAGES, buildConfig(modelId));

        // Assert
        const callArg = mockResponsesCreate.mock.calls[0][0];
        expect(callArg).not.toHaveProperty("temperature");
      }
    );

    it("o5 モデルは推論モデル判定の範囲外で、temperature が付与される（境界値）", async () => {
      // Arrange
      mockResponsesCreate.mockResolvedValue(buildResponsesApiResponse());

      // Act
      await provider.chat(MESSAGES, buildConfig("o5"));

      // Assert
      const callArg = mockResponsesCreate.mock.calls[0][0];
      expect(callArg.temperature).toBe(0.7);
    });

    it("gpt-4.1 は通常モデルとして判定され、temperature が含まれる", async () => {
      // Arrange
      mockResponsesCreate.mockResolvedValue(buildResponsesApiResponse());

      // Act
      await provider.chat(MESSAGES, buildConfig("gpt-4.1"));

      // Assert
      const callArg = mockResponsesCreate.mock.calls[0][0];
      expect(callArg.temperature).toBe(0.7);
    });
  });

  // =========================================================================
  // 3. citations 抽出
  // =========================================================================

  describe("citations 抽出", () => {
    /**
     * Responses API の output 配列に url_citation annotation を持つ item を組み立てる。
     */
    function buildOutputWithCitations(urls: string[]) {
      return [
        {
          type: "message",
          content: urls.map((url) => ({
            type: "output_text",
            annotations: [
              {
                type: "url_citation",
                url,
              },
            ],
          })),
        },
      ];
    }

    it("url_citation が 1 件の場合、その url が citations に入る", async () => {
      // Arrange
      const outputItems = buildOutputWithCitations(["https://example.com"]);
      mockResponsesCreate.mockResolvedValue(
        buildResponsesApiResponse({ outputItems })
      );

      // Act
      const result = await provider.chat(MESSAGES, NORMAL_CONFIG);

      // Assert
      expect(result.citations).toEqual(["https://example.com"]);
    });

    it("url_citation が複数の場合、すべての url が citations に入る", async () => {
      // Arrange
      const outputItems = buildOutputWithCitations([
        "https://example.com",
        "https://another.org",
        "https://third.net",
      ]);
      mockResponsesCreate.mockResolvedValue(
        buildResponsesApiResponse({ outputItems })
      );

      // Act
      const result = await provider.chat(MESSAGES, NORMAL_CONFIG);

      // Assert
      expect(result.citations).toEqual([
        "https://example.com",
        "https://another.org",
        "https://third.net",
      ]);
    });

    it("url_citation が無い場合、citations は undefined になる", async () => {
      // Arrange
      // output の annotations に url_citation が含まれない
      const outputItems = [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              annotations: [
                { type: "other_annotation", value: "irrelevant" },
              ],
            },
          ],
        },
      ];
      mockResponsesCreate.mockResolvedValue(
        buildResponsesApiResponse({ outputItems })
      );

      // Act
      const result = await provider.chat(MESSAGES, NORMAL_CONFIG);

      // Assert
      expect(result.citations).toBeUndefined();
    });

    it("output 配列が空の場合、citations は undefined になる", async () => {
      // Arrange
      mockResponsesCreate.mockResolvedValue(
        buildResponsesApiResponse({ outputItems: [] })
      );

      // Act
      const result = await provider.chat(MESSAGES, NORMAL_CONFIG);

      // Assert
      expect(result.citations).toBeUndefined();
    });

    it("type:'message' 以外の output item が混在しても citations を抽出できる", async () => {
      // Arrange: reasoning など非 message item と message item の混在
      const outputItems = [
        { type: "reasoning", content: [] },
        {
          type: "message",
          content: [
            {
              type: "output_text",
              annotations: [
                { type: "url_citation", url: "https://example.com" },
              ],
            },
          ],
        },
        { type: "function_call", arguments: "{}" },
      ];
      mockResponsesCreate.mockResolvedValue(
        buildResponsesApiResponse({ outputItems })
      );

      // Act
      const result = await provider.chat(MESSAGES, NORMAL_CONFIG);

      // Assert
      expect(result.citations).toEqual(["https://example.com"]);
    });

    it("type:'output_text' 以外の content が混在しても citations を抽出できる", async () => {
      // Arrange: refusal など非 output_text content と output_text content の混在
      const outputItems = [
        {
          type: "message",
          content: [
            { type: "refusal", refusal: "Cannot answer" },
            {
              type: "output_text",
              annotations: [
                { type: "url_citation", url: "https://example.com" },
              ],
            },
          ],
        },
      ];
      mockResponsesCreate.mockResolvedValue(
        buildResponsesApiResponse({ outputItems })
      );

      // Act
      const result = await provider.chat(MESSAGES, NORMAL_CONFIG);

      // Assert
      expect(result.citations).toEqual(["https://example.com"]);
    });

    it("url_citation と他アノテーションが混在する場合、url_citation の url のみ抽出される", async () => {
      // Arrange
      const outputItems = [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              annotations: [
                { type: "url_citation", url: "https://example.com" },
                { type: "file_citation", file_id: "file_123" },
                { type: "url_citation", url: "https://another.org" },
              ],
            },
          ],
        },
      ];
      mockResponsesCreate.mockResolvedValue(
        buildResponsesApiResponse({ outputItems })
      );

      // Act
      const result = await provider.chat(MESSAGES, NORMAL_CONFIG);

      // Assert
      expect(result.citations).toEqual([
        "https://example.com",
        "https://another.org",
      ]);
    });
  });

  // =========================================================================
  // 6. messages 変換
  // =========================================================================

  describe("messages の input への変換", () => {
    it("マルチターン（user, assistant, user）が input に正しくマップされる", async () => {
      // Arrange
      const multiTurn: ChatMessage[] = [
        { role: "user", content: "First question" },
        { role: "assistant", content: "First answer" },
        { role: "user", content: "Follow-up" },
      ];
      mockResponsesCreate.mockResolvedValue(buildResponsesApiResponse());

      // Act
      await provider.chat(multiTurn, NORMAL_CONFIG);

      // Assert
      const callArg = mockResponsesCreate.mock.calls[0][0];
      expect(callArg.input).toEqual([
        { role: "user", content: "First question" },
        { role: "assistant", content: "First answer" },
        { role: "user", content: "Follow-up" },
      ]);
    });

    it("messages が空配列でも input: [] でクラッシュせず呼び出される", async () => {
      // Arrange
      mockResponsesCreate.mockResolvedValue(buildResponsesApiResponse());

      // Act
      await provider.chat([], NORMAL_CONFIG);

      // Assert
      const callArg = mockResponsesCreate.mock.calls[0][0];
      expect(callArg.input).toEqual([]);
    });
  });

  // =========================================================================
  // 7. maxTokens が未定義のケース
  // =========================================================================

  describe("maxTokens が未定義の場合", () => {
    it("max_output_tokens が undefined としてリクエストに含まれる", async () => {
      // Arrange
      const config = buildConfig("gpt-4.1", { maxTokens: undefined });
      mockResponsesCreate.mockResolvedValue(buildResponsesApiResponse());

      // Act
      await provider.chat(MESSAGES, config);

      // Assert: クラッシュせず呼び出される、max_output_tokens は undefined
      const callArg = mockResponsesCreate.mock.calls[0][0];
      expect(callArg.max_output_tokens).toBeUndefined();
    });
  });

  // =========================================================================
  // 4. usage が undefined の場合
  // =========================================================================

  describe("usage が undefined の場合", () => {
    it("tokenCount の各値がすべて 0 になる", async () => {
      // Arrange
      mockResponsesCreate.mockResolvedValue({
        output_text: "some text",
        output: [],
        usage: undefined,
      });

      // Act
      const result = await provider.chat(MESSAGES, NORMAL_CONFIG);

      // Assert
      expect(result.tokenCount.prompt).toBe(0);
      expect(result.tokenCount.completion).toBe(0);
      expect(result.tokenCount.total).toBe(0);
    });
  });

  // =========================================================================
  // 5. SDK エラーの伝播
  // =========================================================================

  describe("SDK エラーの伝播", () => {
    it("client.responses.create が reject した場合、同じエラーで reject される", async () => {
      // Arrange
      const sdkError = new Error("API rate limit exceeded");
      mockResponsesCreate.mockRejectedValue(sdkError);

      // Act & Assert
      await expect(provider.chat(MESSAGES, NORMAL_CONFIG)).rejects.toThrow(
        "API rate limit exceeded"
      );
    });

    it("reject されたエラーオブジェクトの参照が保持される", async () => {
      // Arrange
      const sdkError = new Error("Network error");
      mockResponsesCreate.mockRejectedValue(sdkError);

      // Act & Assert
      await expect(provider.chat(MESSAGES, NORMAL_CONFIG)).rejects.toBe(sdkError);
    });
  });
});
