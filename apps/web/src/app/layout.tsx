import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spot Finder",
  description: "Spot Finderの開発環境の接続確認",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
