# プロジェクト固有設定

このファイルを `CLAUDE.project.md` にコピーし、プロジェクトに合わせて編集してください。
`scripts/setup.sh` を実行すると、`CLAUDE.base.md` とこのファイルが結合されて `CLAUDE.md` が生成されます。

## 技術スタック

- フレームワーク: Next.js (App Router)
- DB/Auth: Supabase
- デプロイ: Vercel
- タスク管理: Beads
- テスト: Jest + Playwright
- スタイリング: Tailwind CSS
<!-- 必要に応じて変更・追加してください -->

## Git戦略

### ブランチ構成
- `release`: 正式版ブランチ（エージェント操作禁止）
- `preview`: プレビュー版ブランチ（エージェント操作禁止）
- `dev`: 開発ブランチ（featureブランチのマージ先）
- `feature/bd-{beads-id}`: タスクごとのブランチ
<!-- ブランチ名やルールをプロジェクトに合わせて変更してください -->

### ルール
- Git Worktreeを使い、並行で進められるタスクは並行で進める
- featureブランチはBeadsのIDを使って命名する
- release, previewブランチはエージェントが操作しない

## 要件定義ドキュメント

- 配置先: `doc/requirements.md`
<!-- 複数ファイルに分割する場合は、ここにファイル一覧を記載してください -->

## 設計ドキュメント構成

設計エージェント(`design-architect`)が作成する設計ドキュメントの一覧です。
プロジェクトの技術スタックに合わせて、不要なものを削除・必要なものを追加してください。

- `doc/design/overview.md`: 設計概要（各ドキュメントへのリンク集）
- `doc/design/app-architecture.md`: アプリ構成、ページ構成、状態管理
- `doc/design/api-design.md`: API Routes一覧、リクエスト/レスポンス定義
- `doc/design/db-design.md`: スキーマ設計、ER図、インデックス戦略
- `doc/design/supabase-design.md`: RLSポリシー、Auth設定、Supabase固有設計
- `doc/design/frontend-design.md`: コンポーネント設計、ページ遷移
- `doc/design/styling-design.md`: デザインシステム、カラー、タイポグラフィ
- `doc/design/infra-design.md`: Vercel設定、環境変数、CI/CD
- `doc/design/security-design.md`: 認証フロー、脆弱性対策方針
<!-- Supabaseを使わない場合は supabase-design.md を削除してください -->
<!-- Vercel以外のデプロイ先を使う場合は infra-design.md の説明を変更してください -->

## プロジェクト固有ルール

<!-- プロジェクト固有の追加ルールがあれば、ここに記載してください -->
<!-- 例: -->
<!-- - 日本語でコミットメッセージを書くこと -->
<!-- - src/generated/ 以下のファイルは手動編集禁止 -->
