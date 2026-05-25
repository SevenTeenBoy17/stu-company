import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Noto_Sans_SC, Noto_Serif_SC } from "next/font/google";

import { GlobalAiAssistant } from "@/components/shared/global-ai-assistant";
import { getCurrentUser } from "@/lib/session-user";

import "./globals.css";

const sansFont = Noto_Sans_SC({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const displayFont = Noto_Serif_SC({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "700"],
  display: "swap",
});

const latinFont = Inter({
  variable: "--font-latin",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const monoFont = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Brown Zone | Mr.Brown AI 经济沙盘",
  description:
    "面向中学生的 AI 财商教育网页端应用，包含沉浸式经济沙盘、课程模块、教师与家长协同视图，以及全站 KeyAI 导师入口。",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const currentUser = await getCurrentUser();

  return (
    <html
      lang="zh-CN"
      className={`${sansFont.variable} ${displayFont.variable} ${latinFont.variable} ${monoFont.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-bg-app text-fg-default">
        {children}
        <GlobalAiAssistant
          viewer={
            currentUser
              ? {
                  id: currentUser.id,
                  role: currentUser.role,
                  name: currentUser.name,
                }
              : null
          }
        />
      </body>
    </html>
  );
}
