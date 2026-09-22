/** The rule between the provider buttons and the email form. */
function AuthDivider() {
  return (
    <div className="flex items-center gap-3" aria-hidden="true">
      <span className="h-px flex-1 bg-border" />
      <span className="text-muted-foreground text-xs">or</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

export { AuthDivider };
