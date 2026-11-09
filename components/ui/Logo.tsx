/** Huisraad-woordmerk: huisje in lijnstijl + naam in serif. */
export function Logo({ size = 28, withText = true }: { size?: number; withText?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 text-ink">
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect x="1" y="1" width="30" height="30" rx="9" fill="var(--accent)" />
        <path
          d="M8 15.5L16 9l8 6.5M10 14v9h12v-9M14 23v-5h4v5"
          stroke="var(--accent-ink)"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {withText && <span className="font-display text-xl font-semibold tracking-tight">Huisraad</span>}
    </span>
  );
}
