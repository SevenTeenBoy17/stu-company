import Link from "next/link";

import { learningModules, siteNavGroups } from "@/lib/content";
import { Logo } from "@/components/site/logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-900/8 bg-[#0b1020] text-white">
      <div className="mx-auto max-w-[1440px] px-4 py-14 sm:py-16 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 xl:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Logo />
            <p className="mt-6 max-w-md text-sm leading-7 text-white/58">
              用 AI 把经济学装进游戏里。Brown Zone 把财商教育、策略模拟与家校共育做成同一套演示级产品体验。
            </p>
            <div className="mt-6 space-y-2 text-sm text-white/46">
              <p>成都市树德实验中学 · 学生创意公司计划书 Demo</p>
              <p>contact@brownzone.ai</p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-white/45">核心页面</h3>
            <div className="mt-5 space-y-3 text-sm text-white/70">
              <Link href="/">首页</Link>
              <Link href="/learn" className="block">投资课程</Link>
              <Link href="/demo" className="block">试玩入口</Link>
              <Link href="/student" className="block">学生策略台</Link>
              <Link href="/teacher" className="block">教师指挥舱</Link>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-white/45">功能模块</h3>
            <div className="mt-5 space-y-3 text-sm text-white/70">
              {learningModules.slice(0, 4).map((module) => (
                <p key={module.key}>{module.title}</p>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-white/45">导航提要</h3>
            <div className="mt-5 space-y-3 text-sm text-white/70">
              {siteNavGroups.map((group) => (
                <p key={group.title}>{group.title}</p>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-16 border-t border-white/8 pt-6 text-xs leading-6 text-white/38">
          <p>
            Brown Zone 演示环境仅用于教育展示与模拟体验，不提供任何真实交易、开户或收益承诺。所有页面与数据均围绕未成年人友好、去金钱化与课堂应用场景设计。
          </p>
        </div>
      </div>
    </footer>
  );
}
