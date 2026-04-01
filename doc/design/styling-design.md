# スタイリング設計

## 関連ドキュメント

- [設計概要](./overview.md)
- [フロントエンド設計](./frontend-design.md)
- [アプリケーションアーキテクチャ設計](./app-architecture.md)

---

## 1. スタイリング方針

- **CSS Modules** を使用（各コンポーネントに `.module.css` ファイルを配置）
- グローバルスタイルは `src/app/globals.css` に最小限定義
- 外部CSSフレームワーク（Tailwind等）は使用しない
- ライトモードのみ（ダークモード不要）
- デスクトップ固定幅（レスポンシブ不要）

## 2. デザイントークン

### 2.1 カラーパレット

`globals.css` にCSS変数として定義する。

```css
:root {
  /* ベースカラー */
  --color-bg-primary: #ffffff;
  --color-bg-secondary: #f5f5f5;
  --color-bg-tertiary: #e8e8e8;

  /* テキスト */
  --color-text-primary: #1a1a1a;
  --color-text-secondary: #666666;
  --color-text-muted: #999999;

  /* ボーダー */
  --color-border: #e0e0e0;
  --color-border-hover: #cccccc;

  /* アクセント */
  --color-accent: #2563eb;
  --color-accent-hover: #1d4ed8;
  --color-accent-light: #eff6ff;

  /* ステータス */
  --color-error: #dc2626;
  --color-error-bg: #fef2f2;
  --color-success: #16a34a;
  --color-success-bg: #f0fdf4;

  /* プロバイダー別カラー（カラムヘッダーのアクセント） */
  --color-openai: #10a37f;
  --color-anthropic: #d4a574;
  --color-gemini: #4285f4;
  --color-perplexity: #20808d;
}
```

### 2.2 タイポグラフィ

```css
:root {
  /* フォントファミリー */
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    "Helvetica Neue", Arial, sans-serif;
  --font-mono: "SF Mono", "Fira Code", "Fira Mono", "Roboto Mono",
    Consolas, monospace;

  /* フォントサイズ */
  --font-size-xs: 0.75rem;    /* 12px */
  --font-size-sm: 0.875rem;   /* 14px */
  --font-size-base: 1rem;     /* 16px */
  --font-size-lg: 1.125rem;   /* 18px */
  --font-size-xl: 1.25rem;    /* 20px */

  /* 行間 */
  --line-height-tight: 1.25;
  --line-height-normal: 1.5;
  --line-height-relaxed: 1.75;

  /* フォントウェイト */
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-bold: 700;
}
```

### 2.3 スペーシング

```css
:root {
  --space-1: 0.25rem;   /* 4px */
  --space-2: 0.5rem;    /* 8px */
  --space-3: 0.75rem;   /* 12px */
  --space-4: 1rem;      /* 16px */
  --space-5: 1.25rem;   /* 20px */
  --space-6: 1.5rem;    /* 24px */
  --space-8: 2rem;      /* 32px */
  --space-10: 2.5rem;   /* 40px */
}
```

### 2.4 その他

```css
:root {
  /* 角丸 */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;

  /* シャドウ */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.07);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);

  /* トランジション */
  --transition-fast: 150ms ease;
  --transition-normal: 250ms ease;

  /* レイアウト */
  --header-height: 56px;
  --footer-height: 160px;
  --max-width: 1400px;
}
```

## 3. グローバルスタイル

### `src/app/globals.css`

```css
/* CSS変数定義（上記のデザイントークンすべて） */

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  font-size: 16px;
}

body {
  font-family: var(--font-sans);
  font-size: var(--font-size-base);
  line-height: var(--line-height-normal);
  color: var(--color-text-primary);
  background-color: var(--color-bg-secondary);
}

button {
  cursor: pointer;
  font-family: inherit;
  font-size: inherit;
}

textarea {
  font-family: inherit;
  font-size: inherit;
}
```

## 4. コンポーネント別スタイル

### 4.1 Header (`Header.module.css`)

```css
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--header-height);
  padding: 0 var(--space-6);
  background-color: var(--color-bg-primary);
  border-bottom: 1px solid var(--color-border);
}

.title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.resetButton {
  padding: var(--space-2) var(--space-4);
  background-color: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
}

.resetButton:hover:not(:disabled) {
  background-color: var(--color-bg-tertiary);
  border-color: var(--color-border-hover);
}

.resetButton:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

### 4.2 ResponsePanel (`ResponsePanel.module.css`)

```css
.panel {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
  padding: var(--space-4) var(--space-6);
  flex: 1;
  overflow-y: auto;
}

/* カラム数が4未満の場合 */
.panel[data-columns="3"] {
  grid-template-columns: repeat(3, 1fr);
}
.panel[data-columns="2"] {
  grid-template-columns: repeat(2, 1fr);
}
.panel[data-columns="1"] {
  grid-template-columns: 1fr;
}

/* 拡大表示時 */
.panelExpanded {
  grid-template-columns: 1fr;
}
```

### 4.3 ResponseColumn (`ResponseColumn.module.css`)

```css
.column {
  display: flex;
  flex-direction: column;
  background-color: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  cursor: pointer;
  transition: box-shadow var(--transition-fast);
}

.column:hover {
  box-shadow: var(--shadow-md);
}

.columnExpanded {
  cursor: default;
}

/* ヘッダー部（プロバイダー別カラーをトップボーダーで表示） */
.columnHeader {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.columnHeader[data-provider="openai"] {
  border-top: 3px solid var(--color-openai);
}
.columnHeader[data-provider="anthropic"] {
  border-top: 3px solid var(--color-anthropic);
}
.columnHeader[data-provider="gemini"] {
  border-top: 3px solid var(--color-gemini);
}
.columnHeader[data-provider="perplexity"] {
  border-top: 3px solid var(--color-perplexity);
}

.modelName {
  font-weight: var(--font-weight-bold);
  font-size: var(--font-size-base);
}

.modelId {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.tokenCount {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

/* 回答本文エリア */
.content {
  flex: 1;
  padding: var(--space-4);
  overflow-y: auto;
}

/* ユーザーメッセージ */
.userMessage {
  padding: var(--space-2) var(--space-3);
  margin-bottom: var(--space-3);
  background-color: var(--color-accent-light);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

/* エラー表示 */
.error {
  padding: var(--space-3);
  background-color: var(--color-error-bg);
  color: var(--color-error);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
}

/* フッター（コピーボタン） */
.columnFooter {
  padding: var(--space-2) var(--space-4);
  border-top: 1px solid var(--color-border);
  display: flex;
  justify-content: flex-end;
}

.copyButton {
  padding: var(--space-1) var(--space-3);
  background: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
}

.copyButton:hover {
  background-color: var(--color-bg-secondary);
}

.copyButtonSuccess {
  color: var(--color-success);
  border-color: var(--color-success);
}
```

### 4.4 MarkdownRenderer (`MarkdownRenderer.module.css`)

```css
.markdown {
  line-height: var(--line-height-relaxed);
  font-size: var(--font-size-sm);
  word-wrap: break-word;
}

.markdown h1,
.markdown h2,
.markdown h3 {
  margin-top: var(--space-4);
  margin-bottom: var(--space-2);
  font-weight: var(--font-weight-bold);
}

.markdown h1 { font-size: var(--font-size-xl); }
.markdown h2 { font-size: var(--font-size-lg); }
.markdown h3 { font-size: var(--font-size-base); }

.markdown p {
  margin-bottom: var(--space-3);
}

.markdown ul,
.markdown ol {
  margin-bottom: var(--space-3);
  padding-left: var(--space-6);
}

.markdown li {
  margin-bottom: var(--space-1);
}

.markdown blockquote {
  margin: var(--space-3) 0;
  padding: var(--space-2) var(--space-4);
  border-left: 3px solid var(--color-border);
  color: var(--color-text-secondary);
  background-color: var(--color-bg-secondary);
}

.markdown table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: var(--space-3);
}

.markdown th,
.markdown td {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  text-align: left;
}

.markdown th {
  background-color: var(--color-bg-secondary);
  font-weight: var(--font-weight-medium);
}

.inlineCode {
  padding: 0.15em 0.4em;
  background-color: var(--color-bg-tertiary);
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 0.9em;
}

/* コードブロックのラッパー */
.codeBlock {
  margin: var(--space-3) 0;
  border-radius: var(--radius-sm);
  overflow: hidden;
}
```

### 4.5 LoadingIndicator (`LoadingIndicator.module.css`)

```css
.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-8) var(--space-4);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.dots {
  display: inline-flex;
  gap: 4px;
  margin-left: var(--space-2);
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--color-text-muted);
  animation: bounce 1.4s infinite ease-in-out both;
}

.dot:nth-child(1) { animation-delay: -0.32s; }
.dot:nth-child(2) { animation-delay: -0.16s; }
.dot:nth-child(3) { animation-delay: 0s; }

@keyframes bounce {
  0%, 80%, 100% {
    transform: scale(0);
    opacity: 0.3;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}
```

### 4.6 ModelSelector (`ModelSelector.module.css`)

```css
.selector {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-6);
}

.label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  cursor: pointer;
  user-select: none;
}

.label:has(input:disabled) {
  opacity: 0.5;
  cursor: not-allowed;
}

.checkbox {
  width: 16px;
  height: 16px;
  accent-color: var(--color-accent);
}
```

### 4.7 PromptInput (`PromptInput.module.css`)

```css
.container {
  padding: var(--space-3) var(--space-6) var(--space-4);
  background-color: var(--color-bg-primary);
  border-top: 1px solid var(--color-border);
}

.inputRow {
  display: flex;
  gap: var(--space-3);
  align-items: flex-end;
}

.textarea {
  flex: 1;
  min-height: 60px;
  max-height: 200px;
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  line-height: var(--line-height-normal);
  resize: vertical;
  transition: border-color var(--transition-fast);
}

.textarea:focus {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 2px var(--color-accent-light);
}

.textarea:disabled {
  background-color: var(--color-bg-secondary);
  cursor: not-allowed;
}

.sendButton {
  padding: var(--space-3) var(--space-6);
  background-color: var(--color-accent);
  color: #ffffff;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  transition: background-color var(--transition-fast);
  white-space: nowrap;
}

.sendButton:hover:not(:disabled) {
  background-color: var(--color-accent-hover);
}

.sendButton:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.hint {
  margin-top: var(--space-1);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  text-align: right;
}
```

## 5. ページレイアウト

### `page.module.css`

```css
.main {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-width: var(--max-width);
  margin: 0 auto;
}
```

全体をビューポート高さいっぱいの flexbox で構成し、ResponsePanel が残りの高さを `flex: 1` で占有する。

```
+---------------------------+
| Header (固定高さ)          |
+---------------------------+
|                           |
| ResponsePanel (flex: 1)   |
|  (スクロール可)            |
|                           |
+---------------------------+
| ModelSelector (固定高さ)   |
+---------------------------+
| PromptInput (固定高さ)     |
+---------------------------+
```
