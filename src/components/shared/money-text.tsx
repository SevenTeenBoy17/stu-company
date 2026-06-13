import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Renders a money amount with the house number styling and the Chinese-market
 * color convention (CLAUDE.md): **red = up/positive, green = down/negative**.
 *
 * A negative ¥ amount is by definition "down", so it is ALWAYS green — no matter
 * which module renders it. Positive/neutral amounts (prices, balances, gains)
 * keep the brand red. This is what keeps a loss from showing in the same red as
 * a gain across the dashboard (recent-operations, KPI tiles, AI notes, etc.).
 */
export function MoneyText({
  children,
  className,
  tone = "light",
}: {
  children: ReactNode;
  className?: string;
  tone?: "light" | "dark";
}) {
  const negative = String(children).trimStart().startsWith("-");
  const colorClass = negative
    ? tone === "dark"
      ? "text-[var(--down-200)]"
      : "text-down"
    : tone === "dark"
      ? "text-[var(--up-200)]"
      : "text-up";
  return (
    <span className={cn("font-extrabold tabular-nums whitespace-nowrap", colorClass, className)}>
      {children}
    </span>
  );
}

const moneyPattern = /(-?¥[\d,]+(?:\.\d+)?)/g;

export function MoneyInlineText({
  text,
  className,
  tone = "light",
}: {
  text: string;
  className?: string;
  tone?: "light" | "dark";
}) {
  const parts = text.split(moneyPattern);

  return (
    <span className={className}>
      {parts.map((part, index) =>
        /^-?¥[\d,]+(?:\.\d+)?$/.test(part) ? (
          <MoneyText key={`${part}-${index}`} tone={tone}>
            {part}
          </MoneyText>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        ),
      )}
    </span>
  );
}
