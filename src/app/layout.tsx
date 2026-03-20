import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
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
    "業者の言い値が高いか安いか、実成約データで確かめよう。国土交通省の取引データ（76,000件超）をもとに、埼玉全175駅の中古マンション相場を可視化。業者と対等に交渉するための相場マップ。",
  keywords: ["埼玉", "中古マンション", "相場", "価格", "マップ", "不動産", "駅別", "成約価格", "交渉"],
  openGraph: {
    title: "埼玉県 中古マンション相場マップ",
    description:
      "業者の言い値が適正かどうか、国土交通省の実成約データ（76,000件超）で確かめよう。埼玉175駅の相場を駅別・築年数別・面積別に可視化。",
    type: "website",
    locale: "ja_JP",
  },
  twitter: {
    card: "summary_large_image",
    title: "埼玉県 中古マンション相場マップ",
    description: "業者の言い値が高いか安いか、実成約データで確かめよう。埼玉175駅・76,000件超の国交省データを無料公開。",
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
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
