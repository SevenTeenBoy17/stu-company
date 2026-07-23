import Link from "next/link";

import { Logo } from "@/components/site/logo";
import { learningModules, siteNavGroups } from "@/lib/content";

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-white/8 bg-bg-inverse text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 bg-[url('/brand/footer-pattern.svg')] bg-cover bg-center opacity-90"
      />
      <div className="relative z-10 mx-auto max-w-[1440px] px-4 py-14 sm:py-16 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 xl:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Logo />
            <p className="mt-6 max-w-md text-sm leading-7 text-white/62">
              用 AI 把经济学装进游戏里。Brown Zone 把财商教育、策略模拟与家校共育做成同一套产品级体验，让每一间教室都能拥有自己的经济沙盘。
            </p>
            <div className="mt-6 space-y-2 text-sm text-white/70">
              <p>成都市树德实验高级中学 · 学生创业团队出品</p>
              <a
                href="mailto:nuoyanoo@163.com"
                className="inline-block break-words transition-colors hover:text-white"
              >
                nuoyanoo@163.com
              </a>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-white/70">核心页面</h3>
            <div className="mt-4 flex flex-col text-sm text-white/74">
              <Link href="/" className="inline-flex min-h-11 items-center transition-colors hover:text-white">
                首页
              </Link>
              <Link href="/learn" className="inline-flex min-h-11 items-center transition-colors hover:text-white">
                投资课程
              </Link>
              <Link href="/demo" className="inline-flex min-h-11 items-center transition-colors hover:text-white">
                试玩入口
              </Link>
              <Link href="/pricing" className="inline-flex min-h-11 items-center transition-colors hover:text-white">
                订阅方案
              </Link>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-white/70">功能模块</h3>
            <div className="mt-5 space-y-3 text-sm text-white/74">
              {learningModules.slice(0, 4).map((module) => (
                <p key={module.key}>{module.title}</p>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-white/70">导航摘要</h3>
            <div className="mt-5 space-y-3 text-sm text-white/74">
              {siteNavGroups.map((group) => (
                <p key={group.title}>{group.title}</p>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-16 border-t border-white/8 pt-6 text-xs leading-6 text-white/70">
          <p>
            Brown Zone 仅用于教育模拟与学习体验，不提供任何真实交易、开户或收益承诺。所有页面与数据均围绕未成年人友好、去金钱化与课堂应用场景设计。
          </p>
        </div>
      </div>
    </footer>
  );
}
