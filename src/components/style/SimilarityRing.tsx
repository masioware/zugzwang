/** The match as a ring that fills with the percentage, the number in the middle. */
export default function SimilarityRing({ value, label }: { value: number; label: string }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const filled = (Math.max(0, Math.min(100, value)) / 100) * circumference;
  return (
    <div className="relative h-28 w-28 shrink-0" role="img" aria-label={`${label}: ${value}%`}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--color-line-2)" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          className="transition-[stroke-dasharray] duration-500"
          style={{ filter: 'drop-shadow(0 0 6px rgb(255 214 10 / 0.35))' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-3xl leading-none font-bold tabular-nums">{value}%</span>
        <span className="eyebrow mt-1">{label}</span>
      </div>
    </div>
  );
}
