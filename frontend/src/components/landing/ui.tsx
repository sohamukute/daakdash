import type { ReactNode } from "react";

// small red-dot eyebrow used above section headings
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-[13px] tracking-wide text-dd-ink/70">
      <span className="h-1.5 w-1.5 rounded-full bg-dd-red" aria-hidden="true" />
      {children}
    </p>
  );
}
