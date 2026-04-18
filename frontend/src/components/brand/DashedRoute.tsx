import { cn } from "@/lib/cn";

type Props = {
  vertical?: boolean;
  className?: string;
};

// a dashed ink connector, reused for the timeline spine and small route hints
export function DashedRoute({ vertical = false, className }: Props) {
  return (
    <div
      className={cn(
        vertical
          ? "w-px border-l-2 border-dashed border-ink/30"
          : "h-px border-t-2 border-dashed border-ink/30",
        className,
      )}
      aria-hidden
    />
  );
}
