/** Brand mark: a bold Z on a yellow tile, with one dark square for the board. */
export default function Logo({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="9" fill="#ffd60a" />
      <path d="M8.5 8.5h15v3.6L13.9 20h9.6v3.5h-15v-3.6L18.1 12H8.5z" fill="#09090b" />
      <rect x="22.5" y="5" width="4.5" height="4.5" rx="1" fill="#09090b" opacity="0.85" />
    </svg>
  );
}
