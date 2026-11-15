// Shared loading indicator: use this for every loading state in the app.
// Pass `label` when the spinner stands alone (it is announced as a status);
// omit it when nearby text already says what is loading (purely decorative).
export function Spinner({ className = "size-6", label }: { className?: string; label?: string }) {
  const svg = (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
  if (!label) return svg;

  return (
    <span role="status" className="inline-flex items-center">
      {svg}
      <span className="sr-only">{label}</span>
    </span>
  );
}
