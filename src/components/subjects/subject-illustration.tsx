import { cn } from "@/lib/utils";

/**
 * Small decorative illustrations for subject pages, drawn in the brand palette
 * (ink + Scholar Gold) so they sit with the rest of the product. Decorative only.
 */
export function SubjectIllustration({ slug, className }: { slug?: string | null; className?: string }) {
  if (slug === "cloud-computing") {
    return (
      <svg viewBox="0 0 240 160" aria-hidden className={cn("text-fg", className)} fill="none">
        <rect x="0" y="0" width="240" height="160" rx="24" className="fill-surface-2" />
        {/* cloud */}
        <path
          d="M78 92c-14 0-25-10-25-23s11-23 25-23c3 0 6 .5 8.6 1.5C92 36 104 28 118 28c19 0 34 14 35.5 32 1-.1 2-.2 3-.2 13 0 24 10 24 22.5S169.5 105 156.5 105H78"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* servers */}
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(${70 + i * 38} 116)`}>
            <rect width="28" height="22" rx="5" stroke="currentColor" strokeWidth="2.5" />
            <circle cx="8" cy="11" r="2" className="fill-current" />
          </g>
        ))}
        {/* links */}
        <path d="M84 105v11M122 105v11M160 105v11" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        {/* confirmed seat */}
        <circle cx="168" cy="44" r="13" fill="var(--brand-gold)" />
        <path d="M162.5 44.5l4 4 7-8" stroke="var(--brand-midnight)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 240 160" aria-hidden className={cn("text-fg", className)} fill="none">
      <rect x="0" y="0" width="240" height="160" rx="24" className="fill-surface-2" />
      <rect x="72" y="40" width="96" height="80" rx="10" stroke="currentColor" strokeWidth="3" />
      <path d="M92 64h56M92 80h56M92 96h32" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="164" cy="44" r="12" fill="var(--brand-gold)" />
    </svg>
  );
}
