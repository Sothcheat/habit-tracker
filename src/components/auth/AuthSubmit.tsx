import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** The primary action on an auth form: full width at auth scale. */
function AuthSubmit({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      type="submit"
      className={cn("h-11 w-full font-medium text-sm", className)}
      {...props}
    />
  );
}

export { AuthSubmit };
