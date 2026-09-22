import type { AuthError } from "@supabase/supabase-js";

export type AuthErrorKind =
  | "invalid_credentials"
  | "email_not_confirmed"
  | "user_exists"
  | "weak_password"
  | "rate_limited"
  | "other";

/**
 * Turns a Supabase auth error into something a person can act on. Matches on
 * the stable `code` first and falls back to the message for older servers.
 */
export function describeAuthError(error: AuthError): {
  kind: AuthErrorKind;
  message: string;
} {
  const code = error.code ?? "";
  const text = error.message.toLowerCase();

  if (code === "invalid_credentials" || text.includes("invalid login")) {
    // Supabase will not say which half was wrong, on purpose: telling an
    // attacker "right email, wrong password" confirms the account exists.
    return {
      kind: "invalid_credentials",
      message: "Incorrect email or password.",
    };
  }
  if (code === "email_not_confirmed" || text.includes("not confirmed")) {
    return {
      kind: "email_not_confirmed",
      message:
        "Confirm your email before signing in. Check your inbox for the link.",
    };
  }
  if (
    code === "user_already_exists" ||
    code === "email_exists" ||
    text.includes("already registered")
  ) {
    return {
      kind: "user_exists",
      message: "An account with this email already exists. Try signing in.",
    };
  }
  if (code === "weak_password") {
    return { kind: "weak_password", message: error.message };
  }
  if (code.startsWith("over_") || error.status === 429) {
    return {
      kind: "rate_limited",
      message: "Too many attempts. Wait a minute, then try again.",
    };
  }
  return { kind: "other", message: error.message };
}
