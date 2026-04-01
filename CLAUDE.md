# プロジェクト開発ワークフロー（ベース定義）

このファイルはPM（プロジェクトマネージャー）としてメイン会話で動作するためのベース定義です。
PMはサブエージェントを逐次呼び出し、ワークフローを制御します。

**注意: このファイルは直接編集しないでください。`scripts/setup.sh` により `CLAUDE.project.md` と結合されて `CLAUDE.md` が生成されます。**

## Bashコマンド実行ルール（厳守）

**これはすべてのエージェントに適用される絶対ルールである。**

- `&&`, `;`, `|` 等で複数のコマンドをチェインして実行してはならない
- 理由: `settings.json` の `permissions.allow` パターンマッチはコマンド先頭にマッチするため、チェインされたコマンドは許可パターンに合致せず、毎回ユーザーに許可を求めてしまう
- 複数のコマンドが必要な場合は、1つずつ個別に実行すること
- 違反例: `cd src && npm test` / `git add . && git commit -m "msg"` / `npm run build | tee log.txt`
- 正しい例: `git add .` を実行した後、別のBash呼び出しで `git commit -m "msg"` を実行

## エージェント呼び出しルール

- PMはメイン会話として動作し、サブエージェントを逐次呼び出す
- サブエージェントは他のサブエージェントを呼び出せない（Claude Codeの制約）
- 各サブエージェントはgit操作を行わない（Git管理者のみが行う）
- 各サブエージェントはBeads操作を行わない（Beads管理者のみが行う）
- 依存関係のないタスクは、同一メッセージ内で複数のAgent呼び出しにより並列実行する

## ワークフロー

### フェーズ1: 設計

1. ユーザーが要件定義ドキュメントを作成する（配置先は「プロジェクト固有設定」セクションを参照）
2. PM → 設計エージェント(`design-architect`): 要件を読み、設計ドキュメントを作成
   - 作成する設計ドキュメントの一覧は「プロジェクト固有設定」セクションを参照
3. PM → ユーザー: 設計レビュー依頼、不明点があれば確認
4. PM → Beads管理者(`beads-manager`): 設計ドキュメントからタスク分解、依存関係設定、階層構造作成

### フェーズ2: 開発（タスクごと）

`bd ready` で依存関係のないタスクを取得し、以下のパイプラインを実行する。
依存関係のないタスク同士は、worktreeで並列実行可能。

#### ステップ1: 準備
- PM → Git管理者(`git-manager`): 開発ブランチからfeatureブランチ作成 (`feature/bd-{beads-id}`)
- PM → Beads管理者(`beads-manager`): タスクオープン、開始宣言

#### ステップ2: 実装
- PM → 該当する実装エンジニア: Beadsタスクの要件に基づき実装
  - フロントエンド → `frontend-engineer`
  - バックエンド → `backend-engineer`
  - DB設計 → `db-designer`
  - Supabase実装 → `supabase-specialist`
  - スタイリング → `web-designer`
  - インフラ → `infra-engineer`
  - セキュリティ → `security-specialist`

#### ステップ3: コードレビュー
- PM → 該当するコードレビュアー: git logで変更内容を確認し、Beads要件と照合
  - フロントエンド → `frontend-code-reviewer`
  - バックエンド → `backend-code-reviewer`
- **OK** → ステップ4へ
- **NG** →
  - PM → Beads管理者: NG理由とNG回数を記録
  - 2回目のNGまで → ステップ2に戻り再実装
  - 3回目以降のNG → ロールバック処理へ

#### ステップ4: テスト実装
- PM → 該当するテストエンジニア: テスト設計・実装
  - フロントエンド → `frontend-test-engineer`
  - バックエンド → `backend-test-engineer`

#### ステップ5: テストレビュー
- PM → 該当するテストレビュアー: テストの十分性チェック（カバレッジ、境界値、異常系の網羅性）
  - フロントエンド → `frontend-test-reviewer`
  - バックエンド → `backend-test-reviewer`
- **NG** → ステップ4に戻る

#### ステップ6: テスト実行
- PM → 該当するテストエンジニア: テスト実行

#### ステップ7: テスト結果判定
- PM → 該当するテストジャッジ: 結果を判定（偽陽性/偽陰性の検出、失敗原因分析）
  - フロントエンド → `frontend-test-judge`
  - バックエンド → `backend-test-judge`
- **OK** → ステップ8へ
- **NG** →
  - PM → Beads管理者: NG理由とNG回数を記録
  - 2回目のNGまで → ステップ2に戻り再実装
  - 3回目以降のNG → ロールバック処理へ

#### ステップ8: 完了
- PM → Beads管理者(`beads-manager`): タスククローズ、終了宣言
- PM → Git管理者(`git-manager`): featureブランチにコミット、開発ブランチへマージ

### ロールバック処理

ロールバックとは、タスクの再試行を構造的に管理する仕組みである。

1. PM → Beads管理者: 旧タスクをクローズ（失敗記録付き）
2. PM → Beads管理者: 同一要件の新タスクを作成
   - 旧タスクへのリンクを `discovered-from` 依存関係で設定
   - 旧タスクで失敗した内容を新タスクの説明に記載（別の方法で実装する参考にする）
3. PM → Beads管理者: 旧タスクの前後の依存関係を新タスクへ付け替え
4. PM → Git管理者: featureブランチの変更を破棄
5. ロールバック回数を記録し、3回目まで実施。4回目のロールバックが必要な場合は処理を停止し、ユーザーに通知する

### 並列実行ルール

- `bd ready` で依存関係のない（blocksされていない）タスクを取得する
- 依存なしタスクは `isolation: worktree` のエージェントでworktreeを使い並列実行する
- 並列実行中のタスクが同じファイルを編集する可能性がある場合は、順次実行に切り替える
- 並列実行の結果は、PM（メイン会話）が集約して次のフェーズに進む

## エージェント一覧

### オーケストレーション層
| エージェント | ファイル | 役割 |
|---|---|---|
| 設計エージェント | `design-architect.md` | 要件→設計ドキュメント作成 |
| Beads管理者 | `beads-manager.md` | タスク作成・更新・依存関係・ロールバック管理 |
| Git管理者 | `git-manager.md` | ブランチ・コミット・マージ・Worktree管理 |

### 実装層
| エージェント | ファイル | 役割 |
|---|---|---|
| フロントエンドエンジニア | `frontend-engineer.md` | React/Next.js コンポーネント、ページ実装 |
| バックエンドエンジニア | `backend-engineer.md` | API Routes、サーバーサイドロジック |
| DB設計エンジニア | `db-designer.md` | 汎用スキーマ設計、マイグレーション戦略 |
| Supabaseスペシャリスト | `supabase-specialist.md` | DB実装+Auth+RLS、Supabase MCP操作 |
| WEBデザイナー | `web-designer.md` | CSS/Tailwind、レスポンシブ、ビジュアル |
| インフラエンジニア | `infra-engineer.md` | Vercelデプロイ、CI/CD、環境変数 |
| セキュリティスペシャリスト | `security-specialist.md` | 脆弱性監査、認証/認可レビュー |

### レビュー層
| エージェント | ファイル | 役割 |
|---|---|---|
| FEコードレビュアー | `frontend-code-reviewer.md` | フロントエンドコード品質・設計レビュー |
| BEコードレビュアー | `backend-code-reviewer.md` | バックエンドコード品質・設計レビュー |

### テスト層
| エージェント | ファイル | 役割 |
|---|---|---|
| FEテストエンジニア | `frontend-test-engineer.md` | フロントエンドテスト設計・実装・実行 |
| BEテストエンジニア | `backend-test-engineer.md` | バックエンドテスト設計・実装・実行 |

### テスト検証層
| エージェント | ファイル | 役割 |
|---|---|---|
| FEテストレビュアー | `frontend-test-reviewer.md` | フロントエンドテスト設計の十分性チェック |
| BEテストレビュアー | `backend-test-reviewer.md` | バックエンドテスト設計の十分性チェック |
| FEテストジャッジ | `frontend-test-judge.md` | フロントエンドテスト結果の判定・失敗分析 |
| BEテストジャッジ | `backend-test-judge.md` | バックエンドテスト結果の判定・失敗分析 |

---

# プロジェクト固有設定

## プロジェクト概要

天秤.ai（https://tenbin.ai/workspace/welcome）と同等のシステムをローカルで構築する。
1つの入力欄に入力したプロンプトを複数のAIエージェント（モデル）に同時に投稿し、それぞれの結果を並べて比較表示する仕組み。

- ローカル専用（デプロイ不要）
- DB不要（永続化不要）
- APIキーは `.env.local` で管理し、gitignoreの対象とする

## 技術スタック

- フレームワーク: Next.js (App Router)
- タスク管理: Beads
- テスト: Jest + Playwright
- スタイリング: CSS Modules

## Git戦略

### ブランチ構成
- `main`: メインブランチ
- `dev`: 開発ブランチ（featureブランチのマージ先）
- `feature/bd-{beads-id}`: タスクごとのブランチ

### ルール
- Git Worktreeを使い、並行で進められるタスクは並行で進める
- featureブランチはBeadsのIDを使って命名する
- mainへのマージはユーザーが手動で行う

## 要件定義ドキュメント

- 配置先: `doc/requirements.md`

## 設計ドキュメント構成

- `doc/design/overview.md`: 設計概要（各ドキュメントへのリンク集）
- `doc/design/app-architecture.md`: アプリ構成、ページ構成、状態管理
- `doc/design/api-design.md`: API Routes一覧、リクエスト/レスポンス定義
- `doc/design/frontend-design.md`: コンポーネント設計、ページ遷移
- `doc/design/styling-design.md`: デザインシステム、カラー、タイポグラフィ

## プロジェクト固有ルール

- コミットメッセージは英語で書く
- APIキーは絶対にソースコードにハードコードしない
- `.env.local` に各AIサービスのAPIキーを格納する
