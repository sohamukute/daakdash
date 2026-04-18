import { LANGS } from "@/lib/i18n";
import { useT } from "@/context/LanguageContext";

// a small language dropdown for the header. India speaks many languages, so every screen can be
// read in the viewer's own. English stays the source of truth.
export function LangSwitcher({ className = "" }: { className?: string }) {
  const { lang, setLang } = useT();
  return (
    <select
      value={lang}
      onChange={(e) => setLang(e.target.value as typeof lang)}
      aria-label="language"
      className={`rounded-sm border border-ink/20 bg-cream px-2 py-1 font-mono text-[11px] text-ink outline-none ${className}`}
    >
      {LANGS.map((l) => (
        <option key={l.code} value={l.code}>{l.label}</option>
      ))}
    </select>
  );
}
