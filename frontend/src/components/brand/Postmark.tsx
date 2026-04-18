import { cn } from "@/lib/cn";

type Props = {
  label: string;
  time?: string;
  stamped?: boolean;
  muted?: boolean;
  className?: string;
};

// a round ink stamp badge, slightly rotated and a little distressed, for status and timeline
export function Postmark({ label, time, stamped = false, muted = false, className }: Props) {
  return (
    <div
      className={cn(
        "grid h-20 w-20 shrink-0 place-items-center rounded-full border-2 text-center",
        "-rotate-3",
        muted ? "border-ink/30 text-ink/45" : "border-inkred text-inkred",
        stamped && "animate-stamp-in",
        className,
      )}
      style={{ boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.35)" }}
    >
      <div className="rounded-full">
        <div className="font-mono text-[9px] font-bold uppercase leading-tight tracking-wide">
          {label}
        </div>
        {time && <div className="mt-0.5 font-mono text-[8px] leading-none opacity-70">{time}</div>}
      </div>
    </div>
  );
}
