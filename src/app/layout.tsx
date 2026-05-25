import type { Metadata } from "next";
import { Manrope, Sora, JetBrains_Mono } from "next/font/google";

import { GlobalAiAssistant } from "@/components/shared/global-ai-assistant";
import { getCurrentUser } from "@/lib/session-user";

import "./globals.css";

const bodyFont = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
});

const displayFont = Sora({
  variable: "--font-display",
  subsets: ["latin"],
});

const monoFont = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
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
      className={`${bodyFont.variable} ${displayFont.variable} ${monoFont.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
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
