import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "埼玉県 中古マンション相場マップ",
  description:
    "埼玉県内の中古マンション取引価格を駅ごとにマップで可視化。希望面積・築年数・価格帯で絞り込みながらエリアを比較できます。国土交通省の実取引データ（2005〜2025年・76,000件超）を使用。",
  keywords: ["埼玉", "中古マンション", "相場", "価格", "マップ", "不動産", "駅別"],
  openGraph: {
    title: "埼玉県 中古マンション相場マップ",
    description:
      "埼玉県内の中古マンション取引価格を駅ごとにマップで可視化。国土交通省の実取引データ（76,000件超）をもとに、エリア選びをデータで支援します。",
    type: "website",
    locale: "ja_JP",
  },
  twitter: {
    card: "summary_large_image",
    title: "埼玉県 中古マンション相場マップ",
    description: "埼玉県内の中古マンション取引価格を駅ごとにマップで可視化。国土交通省の実取引データ（76,000件超）。",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
