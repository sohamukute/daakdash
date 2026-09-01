type Name = "runner" | "postbox" | "milestone" | "truck" | "train";

type Props = {
  name: Name;
  className?: string;
};

// one color line engravings in a stamp feel. stroke follows currentColor so callers set the tone.
const paths: Record<Name, JSX.Element> = {
  runner: (
    <>
      <circle cx="34" cy="14" r="5" />
      <path d="M34 19 L30 34 L20 44 M30 34 L40 40 L48 34 M30 26 L18 24 M30 26 L44 20" />
    </>
  ),
  postbox: (
    <>
      <rect x="20" y="14" width="24" height="38" rx="12" />
      <path d="M26 26 h12 M32 14 v-4 M26 52 v6 M38 52 v6" />
    </>
  ),
  milestone: (
    <>
      <path d="M22 50 h20 v-22 a10 10 0 0 0 -20 0 z" />
      <path d="M22 36 h20 M28 44 h8" />
    </>
  ),
  truck: (
    <>
      <path d="M10 18 h26 v22 h-26 z M36 26 h10 l6 8 v6 h-16 z" />
      <circle cx="20" cy="46" r="4" />
      <circle cx="44" cy="46" r="4" />
    </>
  ),
  train: (
    <>
      <rect x="16" y="14" width="32" height="30" rx="6" />
      <path d="M16 30 h32 M24 14 v16 M40 14 v16 M22 50 l-4 6 M42 50 l4 6" />
      <circle cx="24" cy="46" r="3" />
      <circle cx="40" cy="46" r="3" />
    </>
  ),
};

export function StampArt({ name, className }: Props) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {paths[name]}
    </svg>
  );
}
