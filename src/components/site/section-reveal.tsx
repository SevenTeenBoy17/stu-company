import type { ReactNode } from "react";

export function SectionReveal({
  children,
  delay = 0,
  className,
  id,
  reveal = true,
  sceneItem = false,
  motionCard = false,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  id?: string;
  reveal?: boolean;
  sceneItem?: boolean;
  motionCard?: boolean;
}) {
  return (
    <div
      id={id}
      className={className}
      data-motion-reveal={reveal ? true : undefined}
      data-motion-delay={reveal ? delay : undefined}
      data-motion-scene-item={sceneItem ? true : undefined}
      data-motion-card={motionCard ? true : undefined}
    >
      {children}
    </div>
  );
}
