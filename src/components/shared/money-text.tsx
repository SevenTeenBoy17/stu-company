import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function MoneyText({
  children,
  className,
  tone = "light",
}: {
  children: ReactNode;
  className?: string;
  tone?: "light" | "dark";
}) {
  return (
    <span
      className={cn(
        "font-extrabold tabular-nums",
        tone === "dark" ? "text-[#ffb7af]" : "text-[#d43c33]",
        className,
      )}
    >
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
