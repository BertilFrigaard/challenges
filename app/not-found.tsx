import type { Metadata } from "next";
import Link from "next/link";
import { primaryButtonClass } from "./ui-classes";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center font-sans">
      <p className="text-6xl font-bold text-primary sm:text-7xl">404</p>
      <h1 className="mt-4 text-2xl font-semibold text-foreground sm:text-3xl">Page not found</h1>
      <p className="mt-2 max-w-sm text-base text-foreground/70">
        The page you are looking for doesn&apos;t exist or has been moved.
      </p>
      <Link href="/" className={`${primaryButtonClass} mt-8`}>
        Back to home
      </Link>
    </main>
  );
}
