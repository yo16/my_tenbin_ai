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
