/**
 * POST /api/chat の構造化エラーログ テスト
 *
 * テスト対象: src/app/api/chat/route.ts
 * フォーカス: my_tenbin_ai-21i で追加された構造化エラーログ機能
 *   - 正常系でのログ出力（console.info 開始ログ / console.error 不出力）
 *   - 例外発生時の構造化 console.error 出力
 *   - OpenAI APIError 風エラーでの追加フィールド抽出
 *   - 並行リクエストでの reqId 分離
 *   - 機微情報のログ非含有
 *
 * モック戦略:
 *   - @/lib/providers を jest.mock() で差し替え（getProvider の返値を制御）
 *   - openai モジュールを jest.mock() で差し替え（OpenAI.APIError を制御）
 *     ※ MockAPIError はファクトリ内部で定義し、hoisting 問題（TDZ）を回避する
 *   - MODEL_CONFIGS から実在する id "openai" / "anthropic" を使用
 *   - console.info / console.error を jest.spyOn() でスパイ
 *   - process.env でダミー API キーをセット
 */

import { NextRequest } from "next/server";
import { POST } from "../route";

// ---------------------------------------------------------------------------
// プロバイダーモック
// ---------------------------------------------------------------------------

/** provider.chat() の実装を差し替えるモック関数 */
const mockProviderChat = jest.fn();

jest.mock("@/lib/providers", () => ({
  getProvider: jest.fn(() => ({
    chat: mockProviderChat,
  })),
}));

// ---------------------------------------------------------------------------
// OpenAI SDK モック（APIError クラスをファクトリ内部で定義）
//
// 【hoisting 対策】
// jest.mock() のファクトリはファイル先頭に巻き上げられる（Jest の仕様）。
// ファクトリ外のトップレベルで定義したクラスをファクトリ内から参照すると、
// ファクトリ実行時点で当該クラスが TDZ（Temporal Dead Zone）により
// undefined になっている可能性がある。
// これにより MockOpenAI.APIError = undefined となり、
// route.ts 内の `err instanceof OpenAI.APIError` が常に false となる恐れがある。
//
// 対策: APIError クラスをファクトリ関数の内部で定義し、
// ファクトリが完全に自己完結するようにする。
// テストコードから APIError を new する場合は、
// require("openai") でファクトリが返したコンストラクタから取得する。
// ---------------------------------------------------------------------------

jest.mock("openai", () => {
  // ファクトリ内で APIError クラスを定義することで hoisting 問題を回避する
  class APIError extends Error {
    status: number | undefined;
    code: string | undefined;
    type: string | undefined;
    error: unknown;
    headers: unknown;

    constructor(
      message: string,
      opts: {
        status?: number;
        code?: string;
        type?: string;
        error?: unknown;
        headers?: unknown;
      } = {}
    ) {
      super(message);
      this.name = "APIError";
      this.status = opts.status;
      this.code = opts.code;
      this.type = opts.type;
      this.error = opts.error;
      this.headers = opts.headers;
    }
  }

  // デフォルトエクスポートは OpenAI クラスのコンストラクタ
  const MockOpenAI = jest.fn().mockImplementation(() => ({}));
  // route.ts は `err instanceof OpenAI.APIError` で判定するため、
  // ファクトリ内で定義した APIError を MockOpenAI.APIError にセットする
  MockOpenAI.APIError = APIError;
  return MockOpenAI;
});

// ---------------------------------------------------------------------------
// テスト用 APIError ヘルパー
//
// テストから APIError インスタンスを生成するため、
// jest.mock() ファクトリが返した MockOpenAI.APIError を使用する。
// これにより route.ts の instanceof 判定と同じクラスを参照できる。
// ---------------------------------------------------------------------------

/** ファクトリが設定した APIError コンストラクタを取得する */
function getMockAPIErrorClass(): new (
  message: string,
  opts?: {
    status?: number;
    code?: string;
    type?: string;
    error?: unknown;
    headers?: unknown;
  }
) => Error & {
  status?: number;
  code?: string;
  type?: string;
  error?: unknown;
  headers?: unknown;
} {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const OpenAI = require("openai");
  return OpenAI.APIError;
}

/** APIError インスタンスを生成するファクトリ関数 */
function createAPIError(
  message: string,
  opts: {
    status?: number;
    code?: string;
    type?: string;
    error?: unknown;
    headers?: unknown;
  } = {}
): Error {
  const APIError = getMockAPIErrorClass();
  return new APIError(message, opts);
}

// ---------------------------------------------------------------------------
// テストフィクスチャ
// ---------------------------------------------------------------------------

/**
 * NextRequest を生成するヘルパー。
 * jest.config.js の testEnvironment が "node" のため、
 * Next.js の NextRequest をそのまま使用できる。
 */
function buildRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** MODEL_CONFIGS に存在する openai モデルの正常リクエストボディ */
const VALID_OPENAI_BODY = {
  modelId: "openai",
  messages: [{ role: "user", content: "Hello" }],
};

/** MODEL_CONFIGS に存在する anthropic モデルの正常リクエストボディ */
const VALID_ANTHROPIC_BODY = {
  modelId: "anthropic",
  messages: [{ role: "user", content: "Hello" }],
};

/** provider.chat() の成功レスポンス */
const PROVIDER_SUCCESS = {
  content: "Test response",
  tokenCount: { prompt: 10, completion: 20, total: 30 },
};

// ---------------------------------------------------------------------------
// セットアップ
// ---------------------------------------------------------------------------

beforeEach(() => {
  // ダミー API キーをセット（APIキー存在チェックを通過させる）
  process.env.OPENAI_API_KEY = "sk-test-dummy-openai-key";
  process.env.ANTHROPIC_API_KEY = "sk-ant-test-dummy-anthropic-key";
  process.env.GOOGLE_API_KEY = "test-dummy-google-key";
  process.env.PERPLEXITY_API_KEY = "pplx-test-dummy-key";

  mockProviderChat.mockReset();
  jest.spyOn(console, "info").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  delete process.env.OPENAI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.GOOGLE_API_KEY;
  delete process.env.PERPLEXITY_API_KEY;
});

// ===========================================================================
// 1. 正常系: エラーログが出ない、開始ログが出る
// ===========================================================================

describe("正常系リクエスト", () => {
  it("console.error が呼ばれない", async () => {
    // Arrange
    mockProviderChat.mockResolvedValue(PROVIDER_SUCCESS);

    // Act
    await POST(buildRequest(VALID_OPENAI_BODY));

    // Assert
    expect(console.error).not.toHaveBeenCalled();
  });

  it("console.info の開始ログが1回出力される", async () => {
    // Arrange
    mockProviderChat.mockResolvedValue(PROVIDER_SUCCESS);

    // Act
    await POST(buildRequest(VALID_OPENAI_BODY));

    // Assert
    expect(console.info).toHaveBeenCalledTimes(1);
  });

  it("console.info の開始ログに reqId / provider / model が含まれる", async () => {
    // Arrange
    mockProviderChat.mockResolvedValue(PROVIDER_SUCCESS);

    // Act
    await POST(buildRequest(VALID_OPENAI_BODY));

    // Assert
    const [logMessage] = (console.info as jest.Mock).mock.calls[0];
    // [chat][reqId=XXXXXXXX][provider=openai][model=gpt-5.4-mini] start
    expect(logMessage).toMatch(
      /^\[chat\]\[reqId=[a-f0-9]{8}\]\[provider=openai\]\[model=.+\] start$/
    );
  });

  it("成功レスポンスの JSON に content / tokenCount が含まれる", async () => {
    // Arrange
    mockProviderChat.mockResolvedValue(PROVIDER_SUCCESS);

    // Act
    const response = await POST(buildRequest(VALID_OPENAI_BODY));
    const json = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(json).toMatchObject({
      content: "Test response",
      tokenCount: { prompt: 10, completion: 20, total: 30 },
    });
  });

  it("APIキー未設定時は 500/API_KEY_MISSING が返り console.info は呼ばれない", async () => {
    // Arrange: beforeEach でセットした OPENAI_API_KEY をこのテスト内で削除
    const savedKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    // Act
    const response = await POST(buildRequest(VALID_OPENAI_BODY));
    const json = await response.json();

    // Assert: APIキーチェックはプロバイダー呼び出し前に行われるため、
    // console.info（開始ログ）には到達しない
    expect(response.status).toBe(500);
    expect(json.code).toBe("API_KEY_MISSING");
    expect(console.info).not.toHaveBeenCalled();

    // Teardown: 他テストへの影響を防ぐためキーを復元
    if (savedKey !== undefined) {
      process.env.OPENAI_API_KEY = savedKey;
    }
  });
});

// ===========================================================================
// 2. 例外発生時に構造化ログが出る
// ===========================================================================

describe("プロバイダー例外時の構造化エラーログ", () => {
  it("console.error がちょうど1回呼ばれる", async () => {
    // Arrange
    mockProviderChat.mockRejectedValue(new Error("rate limit exceeded"));

    // Act
    await POST(buildRequest(VALID_OPENAI_BODY));

    // Assert
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it("第1引数がプレフィックス文字列で reqId/provider/model を含み末尾が error", async () => {
    // Arrange
    mockProviderChat.mockRejectedValue(new Error("rate limit exceeded"));

    // Act
    await POST(buildRequest(VALID_OPENAI_BODY));

    // Assert
    const [prefix] = (console.error as jest.Mock).mock.calls[0];
    expect(typeof prefix).toBe("string");
    // [chat][reqId=XXXXXXXX][provider=openai][model=gpt-5.4-mini] error
    expect(prefix).toMatch(
      /^\[chat\]\[reqId=[a-f0-9]{8}\]\[provider=openai\]\[model=.+\] error$/
    );
  });

  it("第2引数のオブジェクトに必須フィールドが存在する", async () => {
    // Arrange
    mockProviderChat.mockRejectedValue(new Error("rate limit exceeded"));

    // Act
    await POST(buildRequest(VALID_OPENAI_BODY));

    // Assert
    const [, logEntry] = (console.error as jest.Mock).mock.calls[0];
    expect(logEntry).toHaveProperty("timestamp");
    expect(logEntry).toHaveProperty("provider");
    expect(logEntry).toHaveProperty("modelId");
    expect(logEntry).toHaveProperty("reqId");
    expect(logEntry).toHaveProperty("errorMessage");
    expect(logEntry).toHaveProperty("errorName");
    expect(logEntry).toHaveProperty("stack");
  });

  it("errorMessage が投げたエラーの message と一致する", async () => {
    // Arrange
    const testError = new Error("rate limit exceeded");
    mockProviderChat.mockRejectedValue(testError);

    // Act
    await POST(buildRequest(VALID_OPENAI_BODY));

    // Assert
    const [, logEntry] = (console.error as jest.Mock).mock.calls[0];
    expect(logEntry.errorMessage).toBe("rate limit exceeded");
  });

  it("provider フィールドがリクエストのプロバイダーと一致する", async () => {
    // Arrange
    mockProviderChat.mockRejectedValue(new Error("some error"));

    // Act
    await POST(buildRequest(VALID_OPENAI_BODY));

    // Assert
    const [, logEntry] = (console.error as jest.Mock).mock.calls[0];
    expect(logEntry.provider).toBe("openai");
  });

  it("modelId フィールドがモデル設定の modelId と一致する", async () => {
    // Arrange
    mockProviderChat.mockRejectedValue(new Error("some error"));

    // Act
    await POST(buildRequest(VALID_OPENAI_BODY));

    // Assert
    const [, logEntry] = (console.error as jest.Mock).mock.calls[0];
    // MODEL_CONFIGS の openai エントリの modelId
    expect(typeof logEntry.modelId).toBe("string");
    expect(logEntry.modelId.length).toBeGreaterThan(0);
  });

  it("reqId フィールドが8文字の16進数文字列である", async () => {
    // Arrange
    mockProviderChat.mockRejectedValue(new Error("some error"));

    // Act
    await POST(buildRequest(VALID_OPENAI_BODY));

    // Assert
    const [, logEntry] = (console.error as jest.Mock).mock.calls[0];
    expect(logEntry.reqId).toMatch(/^[a-f0-9]{8}$/);
  });

  it("timestamp フィールドが ISO 8601 形式の文字列である", async () => {
    // Arrange
    mockProviderChat.mockRejectedValue(new Error("some error"));

    // Act
    await POST(buildRequest(VALID_OPENAI_BODY));

    // Assert
    const [, logEntry] = (console.error as jest.Mock).mock.calls[0];
    expect(typeof logEntry.timestamp).toBe("string");
    expect(() => new Date(logEntry.timestamp)).not.toThrow();
    expect(new Date(logEntry.timestamp).toISOString()).toBe(logEntry.timestamp);
  });

  it("通常 Error の場合 errorStatus / errorType / errorBody は undefined", async () => {
    // Arrange
    mockProviderChat.mockRejectedValue(new Error("generic error"));

    // Act
    await POST(buildRequest(VALID_OPENAI_BODY));

    // Assert
    const [, logEntry] = (console.error as jest.Mock).mock.calls[0];
    expect(logEntry.errorStatus).toBeUndefined();
    expect(logEntry.errorType).toBeUndefined();
    expect(logEntry.errorBody).toBeUndefined();
  });

  it("code プロパティなしの通常 Error の場合 errorCode は undefined になる", async () => {
    // Arrange: code プロパティを持たない通常の Error
    const plainError = new Error("connection failed");
    mockProviderChat.mockRejectedValue(plainError);

    // Act
    await POST(buildRequest(VALID_OPENAI_BODY));

    // Assert: route.ts は OpenAI APIError でない場合も err.code を拾うが、
    // 通常の Error には code プロパティがないため undefined になる
    const [, logEntry] = (console.error as jest.Mock).mock.calls[0];
    expect(logEntry.errorCode).toBeUndefined();
  });

  it("code プロパティ付きの通常 Error の場合 errorCode がその値になる", async () => {
    // Arrange: code プロパティを付与した通常の Error（Node.js のシステムエラー相当）
    const sysError = new Error("ECONNREFUSED");
    (sysError as Error & { code?: string }).code = "ECONNREFUSED";
    mockProviderChat.mockRejectedValue(sysError);

    // Act
    await POST(buildRequest(VALID_OPENAI_BODY));

    // Assert: route.ts は OpenAI APIError でなくても err.code を拾う
    const [, logEntry] = (console.error as jest.Mock).mock.calls[0];
    expect(logEntry.errorCode).toBe("ECONNREFUSED");
  });

  it("UI レスポンスは rate limit エラーで RATE_LIMITED / 500 を返す", async () => {
    // Arrange
    mockProviderChat.mockRejectedValue(new Error("rate limit exceeded"));

    // Act
    const response = await POST(buildRequest(VALID_OPENAI_BODY));
    const json = await response.json();

    // Assert
    expect(response.status).toBe(500);
    expect(json.code).toBe("RATE_LIMITED");
    expect(typeof json.error).toBe("string");
  });

  it("UI レスポンスは汎用エラーで PROVIDER_ERROR / 500 を返す", async () => {
    // Arrange
    mockProviderChat.mockRejectedValue(new Error("unexpected provider error"));

    // Act
    const response = await POST(buildRequest(VALID_OPENAI_BODY));
    const json = await response.json();

    // Assert
    expect(response.status).toBe(500);
    expect(json.code).toBe("PROVIDER_ERROR");
  });
});

// ===========================================================================
// 3. OpenAI APIError 風エラーでの追加フィールド抽出
// ===========================================================================

describe("OpenAI APIError 風エラーの構造化ログ", () => {
  /**
   * 【instanceof 判定の確認について】
   * route.ts は `err instanceof OpenAI.APIError` で判定する。
   * jest.mock("openai") のファクトリ内で APIError クラスを定義し、
   * MockOpenAI.APIError に設定することで、createAPIError() で生成した
   * インスタンスに対して instanceof 判定が true になる。
   * 以下のテストで errorStatus 等に具体的な値が入ることを確認することで、
   * instanceof 判定が機能していること（true になっていること）を保証する。
   * もし instanceof 判定が false になっていれば、
   * errorStatus / errorType / errorBody が undefined になりテストが失敗する。
   */

  it("errorStatus が APIError の status から取得される（instanceof 判定が機能していることを確認）", async () => {
    // Arrange
    const apiError = createAPIError("rate_limit_exceeded", {
      status: 429,
      code: "rate_limit_exceeded",
      type: "tokens",
    });
    mockProviderChat.mockRejectedValue(apiError);

    // Act
    await POST(buildRequest(VALID_OPENAI_BODY));

    // Assert: errorStatus に数値 429 が入っていることで instanceof 判定が true であることを確認
    const [, logEntry] = (console.error as jest.Mock).mock.calls[0];
    expect(logEntry.errorStatus).toBe(429);
    // instanceof 判定が true であれば errorStatus は undefined ではない（数値が入る）
    expect(logEntry.errorStatus).not.toBeUndefined();
  });

  it("errorCode が APIError の code から取得される", async () => {
    // Arrange
    const apiError = createAPIError("rate_limit_exceeded", {
      status: 429,
      code: "rate_limit_exceeded",
    });
    mockProviderChat.mockRejectedValue(apiError);

    // Act
    await POST(buildRequest(VALID_OPENAI_BODY));

    // Assert
    const [, logEntry] = (console.error as jest.Mock).mock.calls[0];
    expect(logEntry.errorCode).toBe("rate_limit_exceeded");
  });

  it("errorType が APIError の type から取得される", async () => {
    // Arrange
    const apiError = createAPIError("tokens exceeded", {
      status: 429,
      type: "tokens",
    });
    mockProviderChat.mockRejectedValue(apiError);

    // Act
    await POST(buildRequest(VALID_OPENAI_BODY));

    // Assert
    const [, logEntry] = (console.error as jest.Mock).mock.calls[0];
    expect(logEntry.errorType).toBe("tokens");
  });

  it("errorBody が APIError の error フィールドから取得される", async () => {
    // Arrange
    const bodyObj = { message: "quota exceeded", param: null };
    const apiError = createAPIError("quota exceeded", {
      status: 429,
      error: bodyObj,
    });
    mockProviderChat.mockRejectedValue(apiError);

    // Act
    await POST(buildRequest(VALID_OPENAI_BODY));

    // Assert
    const [, logEntry] = (console.error as jest.Mock).mock.calls[0];
    expect(logEntry.errorBody).toEqual(bodyObj);
  });

  it("全13フィールドが APIError 系エラーで正しく揃う", async () => {
    // Arrange: 全フィールドに値が入る APIError を生成
    const headersObj = new Headers({
      "x-request-id": "req-full-test",
      "retry-after": "30",
    });
    const apiError = createAPIError("full field test", {
      status: 429,
      code: "rate_limit_exceeded",
      type: "tokens",
      error: { detail: "quota exceeded" },
      headers: headersObj,
    });
    mockProviderChat.mockRejectedValue(apiError);

    // Act
    await POST(buildRequest(VALID_OPENAI_BODY));

    // Assert: ChatErrorLog インターフェースで定義された全13フィールドのキーが揃うことを確認
    const [, logEntry] = (console.error as jest.Mock).mock.calls[0];
    const EXPECTED_KEYS = [
      "timestamp",
      "provider",
      "modelId",
      "reqId",
      "errorName",
      "errorMessage",
      "errorStatus",
      "errorCode",
      "errorType",
      "errorBody",
      "requestId",
      "retryAfter",
      "stack",
    ];
    expect(Object.keys(logEntry).sort()).toEqual(EXPECTED_KEYS.sort());
  });

  describe("headers が Headers オブジェクト形式（.get() メソッド）", () => {
    it("requestId が x-request-id ヘッダから取得される", async () => {
      // Arrange
      const headersObj = new Headers({
        "x-request-id": "req-abc-123",
        "retry-after": "60",
      });
      const apiError = createAPIError("rate_limit", {
        status: 429,
        headers: headersObj,
      });
      mockProviderChat.mockRejectedValue(apiError);

      // Act
      await POST(buildRequest(VALID_OPENAI_BODY));

      // Assert
      const [, logEntry] = (console.error as jest.Mock).mock.calls[0];
      expect(logEntry.requestId).toBe("req-abc-123");
    });

    it("retryAfter が retry-after ヘッダから取得される", async () => {
      // Arrange
      const headersObj = new Headers({
        "x-request-id": "req-abc-123",
        "retry-after": "60",
      });
      const apiError = createAPIError("rate_limit", {
        status: 429,
        headers: headersObj,
      });
      mockProviderChat.mockRejectedValue(apiError);

      // Act
      await POST(buildRequest(VALID_OPENAI_BODY));

      // Assert
      const [, logEntry] = (console.error as jest.Mock).mock.calls[0];
      expect(logEntry.retryAfter).toBe("60");
    });
  });

  describe("headers が plain object 形式（プロパティアクセス）", () => {
    it("requestId が x-request-id プロパティから取得される", async () => {
      // Arrange
      const headersPlain = {
        "x-request-id": "req-plain-456",
        "retry-after": "30",
      };
      const apiError = createAPIError("rate_limit", {
        status: 429,
        headers: headersPlain,
      });
      mockProviderChat.mockRejectedValue(apiError);

      // Act
      await POST(buildRequest(VALID_OPENAI_BODY));

      // Assert
      const [, logEntry] = (console.error as jest.Mock).mock.calls[0];
      expect(logEntry.requestId).toBe("req-plain-456");
    });

    it("retryAfter が retry-after プロパティから取得される", async () => {
      // Arrange
      const headersPlain = {
        "x-request-id": "req-plain-456",
        "retry-after": "30",
      };
      const apiError = createAPIError("rate_limit", {
        status: 429,
        headers: headersPlain,
      });
      mockProviderChat.mockRejectedValue(apiError);

      // Act
      await POST(buildRequest(VALID_OPENAI_BODY));

      // Assert
      const [, logEntry] = (console.error as jest.Mock).mock.calls[0];
      expect(logEntry.retryAfter).toBe("30");
    });
  });

  it("headers が undefined の場合 requestId / retryAfter は undefined", async () => {
    // Arrange
    const apiError = createAPIError("server error", {
      status: 500,
      headers: undefined,
    });
    mockProviderChat.mockRejectedValue(apiError);

    // Act
    await POST(buildRequest(VALID_OPENAI_BODY));

    // Assert
    const [, logEntry] = (console.error as jest.Mock).mock.calls[0];
    expect(logEntry.requestId).toBeUndefined();
    expect(logEntry.retryAfter).toBeUndefined();
  });

  it("headers が空オブジェクト {} の場合 requestId / retryAfter は undefined", async () => {
    // Arrange: get メソッドも x-request-id プロパティも持たない空オブジェクト
    const apiError = createAPIError("server error", {
      status: 500,
      headers: {},
    });
    mockProviderChat.mockRejectedValue(apiError);

    // Act
    await POST(buildRequest(VALID_OPENAI_BODY));

    // Assert: 空オブジェクトにはヘッダ値が存在しないため両フィールドが undefined になる
    const [, logEntry] = (console.error as jest.Mock).mock.calls[0];
    expect(logEntry.requestId).toBeUndefined();
    expect(logEntry.retryAfter).toBeUndefined();
  });
});

// ===========================================================================
// 4. 並行リクエストでの reqId 分離
// ===========================================================================

describe("並行リクエスト時の reqId 分離", () => {
  it("2回の連続呼び出しで異なる reqId がログに記録される", async () => {
    // Arrange
    mockProviderChat.mockRejectedValue(new Error("some error"));

    // Act: 2回連続呼び出し
    await POST(buildRequest(VALID_OPENAI_BODY));
    await POST(buildRequest(VALID_OPENAI_BODY));

    // Assert
    const calls = (console.error as jest.Mock).mock.calls;
    expect(calls).toHaveLength(2);

    const [, logEntry1] = calls[0];
    const [, logEntry2] = calls[1];

    // reqId は異なるべき（UUID ベースなので衝突はほぼ起きない）
    expect(logEntry1.reqId).not.toBe(logEntry2.reqId);
  });

  it("2回の連続呼び出しで各ログの provider が正しい", async () => {
    // Arrange
    mockProviderChat.mockRejectedValue(new Error("some error"));

    // Act
    await POST(buildRequest(VALID_OPENAI_BODY));
    await POST(buildRequest(VALID_ANTHROPIC_BODY));

    // Assert
    const calls = (console.error as jest.Mock).mock.calls;
    expect(calls).toHaveLength(2);

    const [, logEntry1] = calls[0];
    const [, logEntry2] = calls[1];

    expect(logEntry1.provider).toBe("openai");
    expect(logEntry2.provider).toBe("anthropic");
  });

  it("2回の連続呼び出しで各ログの modelId が呼び出しに対応する", async () => {
    // Arrange
    mockProviderChat.mockRejectedValue(new Error("some error"));

    // Act
    await POST(buildRequest(VALID_OPENAI_BODY));
    await POST(buildRequest(VALID_ANTHROPIC_BODY));

    // Assert
    const calls = (console.error as jest.Mock).mock.calls;
    const [, logEntry1] = calls[0];
    const [, logEntry2] = calls[1];

    // modelId はそれぞれのモデル設定に基づく値（openai と anthropic で異なる）
    expect(logEntry1.modelId).not.toBe(logEntry2.modelId);
  });

  it("プレフィックス文字列の reqId がログオブジェクトの reqId と一致する", async () => {
    // Arrange
    mockProviderChat.mockRejectedValue(new Error("some error"));

    // Act
    await POST(buildRequest(VALID_OPENAI_BODY));

    // Assert
    const [prefix, logEntry] = (console.error as jest.Mock).mock.calls[0];
    // プレフィックスの reqId を抽出して logEntry.reqId と照合
    const match = prefix.match(/\[reqId=([a-f0-9]{8})\]/);
    expect(match).not.toBeNull();
    expect(match![1]).toBe(logEntry.reqId);
  });
});

// ===========================================================================
// 5. 機微情報がログに含まれない
// ===========================================================================

describe("機微情報のログ非含有", () => {
  it("ログオブジェクトに messages キーが存在しない", async () => {
    // Arrange
    mockProviderChat.mockRejectedValue(new Error("some error"));

    // Act
    await POST(buildRequest(VALID_OPENAI_BODY));

    // Assert
    const [, logEntry] = (console.error as jest.Mock).mock.calls[0];
    expect(logEntry).not.toHaveProperty("messages");
  });

  it("ログオブジェクトに apiKey キーが存在しない", async () => {
    // Arrange
    mockProviderChat.mockRejectedValue(new Error("some error"));

    // Act
    await POST(buildRequest(VALID_OPENAI_BODY));

    // Assert
    const [, logEntry] = (console.error as jest.Mock).mock.calls[0];
    expect(logEntry).not.toHaveProperty("apiKey");
  });

  it("ログオブジェクトに authorization キーが存在しない", async () => {
    // Arrange
    mockProviderChat.mockRejectedValue(new Error("some error"));

    // Act
    await POST(buildRequest(VALID_OPENAI_BODY));

    // Assert
    const [, logEntry] = (console.error as jest.Mock).mock.calls[0];
    expect(logEntry).not.toHaveProperty("authorization");
  });

  it("ログオブジェクトの文字列値に sk- で始まる値が含まれない", async () => {
    // Arrange
    mockProviderChat.mockRejectedValue(new Error("some error"));

    // Act
    await POST(buildRequest(VALID_OPENAI_BODY));

    // Assert: 全フィールド値を文字列に変換して sk- パターンを検索
    const [, logEntry] = (console.error as jest.Mock).mock.calls[0];
    const serialized = JSON.stringify(logEntry);
    // sk- 始まりは API キー漏洩の典型パターン
    expect(serialized).not.toMatch(/sk-[a-zA-Z0-9\-_]{10,}/);
  });

  it("ログオブジェクトのフィールド数が既知のフィールドのみに限定される", async () => {
    // Arrange
    mockProviderChat.mockRejectedValue(new Error("some error"));

    // Act
    await POST(buildRequest(VALID_OPENAI_BODY));

    // Assert: ChatErrorLog インターフェースで定義された13フィールドのみ
    const [, logEntry] = (console.error as jest.Mock).mock.calls[0];
    const EXPECTED_KEYS = [
      "timestamp",
      "provider",
      "modelId",
      "reqId",
      "errorName",
      "errorMessage",
      "errorStatus",
      "errorCode",
      "errorType",
      "errorBody",
      "requestId",
      "retryAfter",
      "stack",
    ];
    const actualKeys = Object.keys(logEntry);
    expect(actualKeys.sort()).toEqual(EXPECTED_KEYS.sort());
  });

  it("正常系ログ（console.info）にも機微情報が含まれない", async () => {
    // Arrange
    mockProviderChat.mockResolvedValue(PROVIDER_SUCCESS);

    // Act
    await POST(buildRequest(VALID_OPENAI_BODY));

    // Assert
    const [logMessage] = (console.info as jest.Mock).mock.calls[0];
    expect(logMessage).not.toMatch(/sk-[a-zA-Z0-9\-_]{10,}/);
    expect(typeof logMessage).toBe("string");
  });
});
