import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "my天秤AI",
  description: "複数のAIモデルに同じプロンプトを送り、回答を並べて比較するツール",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
