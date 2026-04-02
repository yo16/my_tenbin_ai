"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import type { Components } from "react-markdown";
import styles from "./MarkdownRenderer.module.css";

interface MarkdownRendererProps {
  /** Markdownテキスト */
  content: string;
}

const components: Components = {
  code(props) {
    const { className, children, ...rest } = props;
    const match = /language-(\w+)/.exec(className ?? "");
    const language = match ? match[1] : "";

    // ブロックコード: classNameにlanguage-xxxが含まれる場合
    if (match) {
      return (
        <div className={styles.codeBlock}>
          <SyntaxHighlighter
            language={language}
            style={vscDarkPlus}
            PreTag="div"
          >
            {String(children).replace(/\n$/, "")}
          </SyntaxHighlighter>
        </div>
      );
    }

    // インラインコード
    return (
      <code className={styles.inlineCode} {...rest}>
        {children}
      </code>
    );
  },
};

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className={styles.markdown}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
