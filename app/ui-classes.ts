// Shared Tailwind class strings, so forms and buttons look the same everywhere.

export const inputClass =
  "min-h-11 w-full rounded-lg border border-foreground/20 bg-surface px-3 text-base text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/40";

const buttonBase =
  "flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-base font-semibold cursor-pointer transition hover:scale-98 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100";

export const primaryButtonClass = `${buttonBase} bg-primary text-background`;

export const secondaryButtonClass = `${buttonBase} border border-foreground/20 bg-transparent text-foreground`;
