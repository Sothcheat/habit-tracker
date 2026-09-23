import { APP_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

/**
 * Three rising bars — a cadence building. The mark carries the brand so the
 * name itself can stay quiet.
 *
 * `heading` renders it as the page's `h1`. The tracker has no other candidate
 * — its three column headings are `h2` — so without it that page starts at
 * level two. The auth pages title their own card, so they leave it a `div`
 * rather than give the page a second `h1`.
 */
function Wordmark({
  className,
  heading = false,
}: {
  className?: string;
  heading?: boolean;
}) {
  const Tag = heading ? "h1" : "div";
  return (
    <Tag className={cn("flex items-center gap-2.5", className)}>
      <svg
        viewBox="0 0 32 32"
        className="size-7 text-primary"
        aria-hidden="true"
      >
        <title>{APP_NAME}</title>
        <g fill="currentColor">
          <rect x="4" y="18" width="5" height="10" rx="2.5" opacity="0.45" />
          <rect x="13.5" y="12" width="5" height="16" rx="2.5" opacity="0.7" />
          <rect x="23" y="4" width="5" height="24" rx="2.5" />
        </g>
      </svg>
      <span className="font-semibold text-foreground text-lg tracking-tight">
        {APP_NAME}
      </span>
    </Tag>
  );
}

export { Wordmark };
