import { cn } from "@/lib/cn";

type Props = {
  withTagline?: boolean;
  className?: string;
};

// the DaakDash logotype: Fraunces with a small ink stamp dot between the two halves
export function Wordmark({ withTagline = false, className }: Props) {
  return (
    <div className={cn("flex flex-col", className)}>
      <span className="font-display text-2xl font-semibold leading-none tracking-tight text-ink">
        Daak
        <span className="relative mx-0.5 inline-block h-2 w-2 -translate-y-1 rounded-full bg-inkred align-middle" />
        Dash
      </span>
      {withTagline && (
        <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/60">
          purani daak, nayi raftaar
        </span>
      )}
    </div>
  );
}
