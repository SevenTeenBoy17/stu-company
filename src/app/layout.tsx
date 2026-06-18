import type { Metadata } from "next";

import { DeferredAiAssistant } from "@/components/shared/deferred-ai-assistant";
import { getCurrentUser } from "@/lib/session-user";

import "./globals.css";

export const metadata: Metadata = {
  title: "Brown Zone | Mr.Brown AI 经济沙盘",
  description:
    "面向中学生的 AI 财商教育网页端应用，包含沉浸式经济沙盘、课程模块、家校协同视图和全站 KeyAI 导师入口。",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const currentUser = await getCurrentUser().catch(() => null);

  return (
    <html lang="zh-CN" className="h-full antialiased" data-scroll-behavior="smooth">
      <body className="min-h-full bg-bg-app text-fg-default">
        {children}
        <DeferredAiAssistant
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
