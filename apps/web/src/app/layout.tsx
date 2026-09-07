import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spot Finder",
  description: "地図を動かし、検索半径を指定して周辺のスポットを探索できます。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
