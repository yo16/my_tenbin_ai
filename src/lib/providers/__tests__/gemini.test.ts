/**
 * GeminiProvider.chat() の単体テスト
 *
 * テスト対象: src/lib/providers/gemini.ts
 * 前提: gemini.ts が @google/genai SDK の GoogleGenAI クラスを使用し、
 *       ai.models.generateContent を呼び出していること。
 *       本テストはそのインターフェース仕様を明文化し、実装の正確性を保証する。
 *
 * モック戦略:
 *   - @google/genai npm パッケージ全体を jest.mock() で差し替え
 *   - ai.models.generateContent が返す値をテストケースごとに制御する
 *   - 実 API への通信は一切行わない
 */

import { GeminiProvider } from "../gemini";
import { ChatMessage, ModelConfig } from "@/types";

// ---------------------------------------------------------------------------
// Google GenAI SDK モック
// ---------------------------------------------------------------------------

const mockGenerateContent = jest.fn();

jest.mock("@google/genai", () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: mockGenerateContent,
    },
  })),
}));

// ---------------------------------------------------------------------------
// テストフィクスチャ
// ---------------------------------------------------------------------------

/** ユーザーメッセージ1件 */
const MESSAGES: ChatMessage[] = [
  { role: "user", content: "Hello, Gemini!" },
];

/** 標準モデル設定 (gemini-2.0-flash) */
const BASE_CONFIG: ModelConfig = {
  id: "gemini-gemini-2.0-flash",
  name: "Gemini 2.0 Flash",
  provider: "gemini",
  modelId: "gemini-2.0-flash",
  enabled: true,
  parameters: {
    temperature: 0.7,
    maxTokens: 1024,
  },
};

/** 任意パラメータで ModelConfig を生成するヘルパー */
function buildConfig(
  modelId: string,
  overrides: Partial<ModelConfig["parameters"]> = {}
): ModelConfig {
  return {
    id: `gemini-${modelId}`,
    name: modelId,
    provider: "gemini",
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
 * generateContent の最小成功レスポンスを組み立てるヘルパー。
 * text, usageMetadata, candidates を外部から差し込める。
 */
function buildGenerateContentResponse({
  text = "Test response",
  promptTokenCount = 10,
  candidatesTokenCount = 20,
  totalTokenCount = 30,
  groundingChunks = undefined as
    | Array<{ web?: { uri?: string } }>
    | undefined,
}: {
  text?: string | undefined;
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
  groundingChunks?: Array<{ web?: { uri?: string } }> | undefined;
} = {}) {
  const candidates =
    groundingChunks !== undefined
      ? [
          {
            groundingMetadata: {
              groundingChunks,
            },
          },
        ]
      : undefined;

  return {
    text,
    usageMetadata: {
      promptTokenCount,
      candidatesTokenCount,
      totalTokenCount,
    },
    candidates,
  };
}

// ---------------------------------------------------------------------------
// テスト
// ---------------------------------------------------------------------------

describe("GeminiProvider.chat()", () => {
  let provider: GeminiProvider;

  beforeEach(() => {
    provider = new GeminiProvider();
    mockGenerateContent.mockReset();
  });

  // =========================================================================
  // 1. 基本パラメータ
  // =========================================================================

  describe("基本パラメータ", () => {
    it("ai.models.generateContent を正しいパラメータで呼び出す", async () => {
      // Arrange
      mockGenerateContent.mockResolvedValue(buildGenerateContentResponse());

      // Act
      await provider.chat(MESSAGES, BASE_CONFIG);

      // Assert
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
      const callArg = mockGenerateContent.mock.calls[0][0];

      expect(callArg.model).toBe("gemini-2.0-flash");
      expect(callArg.config.temperature).toBe(0.7);
      expect(callArg.config.maxOutputTokens).toBe(1024);
      expect(callArg.config.tools).toEqual([{ googleSearch: {} }]);
    });

    it("config.tools に googleSearch が含まれる", async () => {
      // Arrange
      mockGenerateContent.mockResolvedValue(buildGenerateContentResponse());

      // Act
      await provider.chat(MESSAGES, BASE_CONFIG);

      // Assert
      const callArg = mockGenerateContent.mock.calls[0][0];
      expect(callArg.config.tools).toHaveLength(1);
      expect(callArg.config.tools[0]).toEqual({ googleSearch: {} });
    });
  });

  // =========================================================================
  // 2. role 変換
  // =========================================================================

  describe("role 変換", () => {
    it("user ロールはそのまま user として変換される", async () => {
      // Arrange
      mockGenerateContent.mockResolvedValue(buildGenerateContentResponse());

      // Act
      await provider.chat(MESSAGES, BASE_CONFIG);

      // Assert
      const callArg = mockGenerateContent.mock.calls[0][0];
      expect(callArg.contents).toEqual([
        { role: "user", parts: [{ text: "Hello, Gemini!" }] },
      ]);
    });

    it("assistant ロールは model に変換される", async () => {
      // Arrange
      const messages: ChatMessage[] = [
        { role: "assistant", content: "Assistant reply" },
      ];
      mockGenerateContent.mockResolvedValue(buildGenerateContentResponse());

      // Act
      await provider.chat(messages, BASE_CONFIG);

      // Assert
      const callArg = mockGenerateContent.mock.calls[0][0];
      expect(callArg.contents[0].role).toBe("model");
    });

    it("マルチターン（user/assistant/user）が正しくマップされる", async () => {
      // Arrange
      const multiTurn: ChatMessage[] = [
        { role: "user", content: "First question" },
        { role: "assistant", content: "First answer" },
        { role: "user", content: "Follow-up" },
      ];
      mockGenerateContent.mockResolvedValue(buildGenerateContentResponse());

      // Act
      await provider.chat(multiTurn, BASE_CONFIG);

      // Assert
      const callArg = mockGenerateContent.mock.calls[0][0];
      expect(callArg.contents).toEqual([
        { role: "user", parts: [{ text: "First question" }] },
        { role: "model", parts: [{ text: "First answer" }] },
        { role: "user", parts: [{ text: "Follow-up" }] },
      ]);
    });
  });

  // =========================================================================
  // 3. content 抽出
  // =========================================================================

  describe("content 抽出", () => {
    it("response.text が content に格納される", async () => {
      // Arrange
      mockGenerateContent.mockResolvedValue(
        buildGenerateContentResponse({ text: "Gemini の回答" })
      );

      // Act
      const result = await provider.chat(MESSAGES, BASE_CONFIG);

      // Assert
      expect(result.content).toBe("Gemini の回答");
    });

    it("response.text が undefined の場合は空文字になる", async () => {
      // Arrange
      // ヘルパーは分割代入デフォルト値を持つため `undefined` を渡しても上書きされない。
      // 明示的に { text: undefined } を含むオブジェクトを直接構築する。
      mockGenerateContent.mockResolvedValue({
        text: undefined,
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 20,
          totalTokenCount: 30,
        },
        candidates: undefined,
      });

      // Act
      const result = await provider.chat(MESSAGES, BASE_CONFIG);

      // Assert
      expect(result.content).toBe("");
    });
  });

  // =========================================================================
  // 4. citations 抽出（groundingMetadata 経由）
  // =========================================================================

  describe("citations 抽出（groundingMetadata 経由）", () => {
    it("groundingChunks の web.uri が citations に抽出される（1件）", async () => {
      // Arrange
      mockGenerateContent.mockResolvedValue(
        buildGenerateContentResponse({
          groundingChunks: [{ web: { uri: "https://example.com" } }],
        })
      );

      // Act
      const result = await provider.chat(MESSAGES, BASE_CONFIG);

      // Assert
      expect(result.citations).toEqual(["https://example.com"]);
    });

    it("複数 chunks のすべての URL が抽出される", async () => {
      // Arrange
      mockGenerateContent.mockResolvedValue(
        buildGenerateContentResponse({
          groundingChunks: [
            { web: { uri: "https://first.com" } },
            { web: { uri: "https://second.org" } },
            { web: { uri: "https://third.net" } },
          ],
        })
      );

      // Act
      const result = await provider.chat(MESSAGES, BASE_CONFIG);

      // Assert
      expect(result.citations).toEqual([
        "https://first.com",
        "https://second.org",
        "https://third.net",
      ]);
    });

    it("重複 URL はユニーク化される", async () => {
      // Arrange
      mockGenerateContent.mockResolvedValue(
        buildGenerateContentResponse({
          groundingChunks: [
            { web: { uri: "https://example.com" } },
            { web: { uri: "https://example.com" } },
            { web: { uri: "https://other.com" } },
          ],
        })
      );

      // Act
      const result = await provider.chat(MESSAGES, BASE_CONFIG);

      // Assert
      expect(result.citations).toEqual([
        "https://example.com",
        "https://other.com",
      ]);
    });

    it("chunks が空配列の場合、citations は undefined になる", async () => {
      // Arrange
      mockGenerateContent.mockResolvedValue(
        buildGenerateContentResponse({
          groundingChunks: [],
        })
      );

      // Act
      const result = await provider.chat(MESSAGES, BASE_CONFIG);

      // Assert
      expect(result.citations).toBeUndefined();
    });

    it("groundingMetadata が欠落してもクラッシュしない（candidates あり）", async () => {
      // Arrange: candidates はあるが groundingMetadata が無い
      mockGenerateContent.mockResolvedValue({
        text: "Response",
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 20,
          totalTokenCount: 30,
        },
        candidates: [
          {
            /* groundingMetadata なし */
          },
        ],
      });

      // Act & Assert: クラッシュせず実行完了する
      const result = await provider.chat(MESSAGES, BASE_CONFIG);
      expect(result.citations).toBeUndefined();
    });

    it("candidates が欠落してもクラッシュしない", async () => {
      // Arrange: candidates プロパティ自体が無い
      mockGenerateContent.mockResolvedValue({
        text: "Response",
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 20,
          totalTokenCount: 30,
        },
        // candidates なし
      });

      // Act & Assert: クラッシュせず実行完了する
      const result = await provider.chat(MESSAGES, BASE_CONFIG);
      expect(result.citations).toBeUndefined();
    });

    it("web フィールドが欠落している chunk はスキップされる", async () => {
      // Arrange
      mockGenerateContent.mockResolvedValue(
        buildGenerateContentResponse({
          groundingChunks: [
            { web: { uri: "https://valid.com" } },
            {
              /* web なし */
            },
            { web: { uri: "https://also-valid.com" } },
          ],
        })
      );

      // Act
      const result = await provider.chat(MESSAGES, BASE_CONFIG);

      // Assert: web を持つ chunk の uri のみ抽出される
      expect(result.citations).toEqual([
        "https://valid.com",
        "https://also-valid.com",
      ]);
    });

    it("uri が空文字の chunk はスキップされる", async () => {
      // Arrange
      mockGenerateContent.mockResolvedValue(
        buildGenerateContentResponse({
          groundingChunks: [
            { web: { uri: "" } },
            { web: { uri: "https://valid.com" } },
          ],
        })
      );

      // Act
      const result = await provider.chat(MESSAGES, BASE_CONFIG);

      // Assert
      expect(result.citations).toEqual(["https://valid.com"]);
    });

    it("すべての chunk の uri が空文字の場合、citations は undefined になる", async () => {
      // Arrange
      mockGenerateContent.mockResolvedValue(
        buildGenerateContentResponse({
          groundingChunks: [
            { web: { uri: "" } },
            { web: { uri: "" } },
          ],
        })
      );

      // Act
      const result = await provider.chat(MESSAGES, BASE_CONFIG);

      // Assert
      expect(result.citations).toBeUndefined();
    });
  });

  // =========================================================================
  // 5. token count
  // =========================================================================

  describe("token count", () => {
    it("usageMetadata の各フィールドが tokenCount に正しくマップされる", async () => {
      // Arrange
      mockGenerateContent.mockResolvedValue(
        buildGenerateContentResponse({
          promptTokenCount: 15,
          candidatesTokenCount: 25,
          totalTokenCount: 40,
        })
      );

      // Act
      const result = await provider.chat(MESSAGES, BASE_CONFIG);

      // Assert
      expect(result.tokenCount.prompt).toBe(15);
      expect(result.tokenCount.completion).toBe(25);
      expect(result.tokenCount.total).toBe(40);
    });

    it("usageMetadata が undefined の場合、すべて 0 になる", async () => {
      // Arrange
      mockGenerateContent.mockResolvedValue({
        text: "Response",
        usageMetadata: undefined,
      });

      // Act
      const result = await provider.chat(MESSAGES, BASE_CONFIG);

      // Assert
      expect(result.tokenCount.prompt).toBe(0);
      expect(result.tokenCount.completion).toBe(0);
      expect(result.tokenCount.total).toBe(0);
    });

    it("promptTokenCount が 0 の場合、正しく 0 が反映される", async () => {
      // Arrange
      mockGenerateContent.mockResolvedValue(
        buildGenerateContentResponse({
          promptTokenCount: 0,
          candidatesTokenCount: 50,
          totalTokenCount: 50,
        })
      );

      // Act
      const result = await provider.chat(MESSAGES, BASE_CONFIG);

      // Assert
      expect(result.tokenCount.prompt).toBe(0);
      expect(result.tokenCount.completion).toBe(50);
      expect(result.tokenCount.total).toBe(50);
    });
  });

  // =========================================================================
  // 6. 空メッセージ配列
  // =========================================================================

  describe("空メッセージ配列", () => {
    it("messages が空配列でもクラッシュせず呼び出される", async () => {
      // Arrange
      mockGenerateContent.mockResolvedValue(buildGenerateContentResponse());

      // Act
      await provider.chat([], BASE_CONFIG);

      // Assert
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
      const callArg = mockGenerateContent.mock.calls[0][0];
      expect(callArg.contents).toEqual([]);
    });
  });

  // =========================================================================
  // 7. SDK エラーの伝播
  // =========================================================================

  describe("SDK エラーの伝播", () => {
    it("generateContent が reject した場合、同じエラーで reject される", async () => {
      // Arrange
      const sdkError = new Error("API rate limit exceeded");
      mockGenerateContent.mockRejectedValue(sdkError);

      // Act & Assert
      await expect(provider.chat(MESSAGES, BASE_CONFIG)).rejects.toThrow(
        "API rate limit exceeded"
      );
    });

    it("reject されたエラーオブジェクトの参照が保持される", async () => {
      // Arrange
      const sdkError = new Error("Network error");
      mockGenerateContent.mockRejectedValue(sdkError);

      // Act & Assert
      await expect(provider.chat(MESSAGES, BASE_CONFIG)).rejects.toBe(sdkError);
    });
  });
});
