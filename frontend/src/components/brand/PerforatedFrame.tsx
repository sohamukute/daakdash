import { type ReactNode } from "react";
import { cn } from "@/lib/cn";

type Props = {
  children: ReactNode;
  className?: string;
};

// a cream surface with a punched hole edge and a soft ink shadow, like a stamp or ticket stub
export function PerforatedFrame({ children, className }: Props) {
  return (
    <div className="relative">
      <div
        className="absolute inset-0 perforated bg-cream shadow-[0_18px_40px_-22px_rgba(26,23,20,0.55)]"
        aria-hidden
      />
      <div className={cn("relative px-6 py-5", className)}>{children}</div>
    </div>
  );
}
