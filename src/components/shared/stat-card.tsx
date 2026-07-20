import type { ReactNode } from "react";

import type { MotionNumberFormat } from "@/lib/motion-system";
import { formatMotionNumber } from "@/lib/motion-system";
import { cn } from "@/lib/utils";

/**
 * v2 信息收敛四件套 · StatCard —— 「数字说话」的统一数字卡。
 *
 * 大号 tabular-nums 数字（进入视口时由 motion provider 做 count-up，
 * data-motion-number 协议），配一行标签与可选的一句 hint。
 * Server Component 友好：无状态、无副作用；SSR 输出最终值文本，
 * JS 未加载/减动效时数字直接可读。
 */
export function StatCard({
  label,
  value,
  format = "integer",
  prefix = "",
  suffix = "",
  hint,
  className,
  valueClassName,
  children,
}: {
  label: ReactNode;
  value: number;
  format?: MotionNumberFormat;
  prefix?: string;
  suffix?: string;
  /** 数字下面那一句（超过一句的解说请放 Disclosure，不要塞这里） */
  hint?: ReactNode;
  className?: string;
  valueClassName?: string;
  /** 可选扩展区（如 Disclosure 详情），置于 hint 之下 */
  children?: ReactNode;
}) {
  return (
    <div className={cn("rounded-2xl border border-black/5 bg-white/80 p-4", className)}>
      <p className="text-caption font-semibold text-fg-muted">{label}</p>
      <p
        data-motion-number
        data-motion-value={value}
        data-motion-format={format}
        data-motion-prefix={prefix}
        data-motion-suffix={suffix}
        className={cn(
          "mt-1 text-2xl font-black text-fg-strong [font-variant-numeric:tabular-nums]",
          valueClassName,
        )}
      >
        {formatMotionNumber(value, format, prefix, suffix)}
      </p>
      {hint ? <p className="mt-1 text-caption text-fg-muted">{hint}</p> : null}
      {children}
    </div>
  );
}
