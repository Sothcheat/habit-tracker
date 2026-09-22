import { ThemeToggle } from "@/components/ThemeToggle";
import { Wordmark } from "@/components/Wordmark";

type AuthLayoutProps = {
  title: string;
  description: string;
  children: React.ReactNode;
  /** Rendered under the card, e.g. the link to the other form. */
  footer: React.ReactNode;
};

/**
 * Centred single-column auth page: wordmark, a card holding the form, and a
 * footer line. One soft accent wash behind it all — enough to keep the page
 * from reading as a blank sheet, faint enough to stay out of the way.
 */
function AuthLayout({ title, description, children, footer }: AuthLayoutProps) {
  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-4 py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_55%_at_50%_0%,var(--accent),transparent_70%)] opacity-70"
      />

      <ThemeToggle className="absolute top-4 right-4" />

      <div className="relative flex w-full max-w-[26rem] flex-col gap-8">
        <Wordmark className="self-center" />

        <div className="flex flex-col gap-6 rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <header className="flex flex-col gap-1.5">
            <h1 className="font-semibold text-card-foreground text-xl tracking-tight">
              {title}
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {description}
            </p>
          </header>

          {children}
        </div>

        <p className="text-center text-muted-foreground text-sm">{footer}</p>
      </div>
    </main>
  );
}

export { AuthLayout };
