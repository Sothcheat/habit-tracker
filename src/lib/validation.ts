/**
 * Client-side validation for the auth forms. Every rule here is a courtesy —
 * Supabase re-checks on the server — so the goal is fast, specific feedback,
 * not security.
 */

// Something@something.tld with no whitespace. Deliberately loose: the only
// real test of an address is whether mail reaches it.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MIN_PASSWORD_LENGTH = 8;

export function validateEmail(value: string): string | null {
  const email = value.trim();
  if (!email) return "Enter your email address.";
  if (!email.includes("@"))
    return "Email must include an @, like name@example.com.";
  if (!EMAIL_PATTERN.test(email))
    return "Enter a valid email, like name@example.com.";
  return null;
}

export type PasswordRule = {
  id: string;
  label: string;
  test: (value: string) => boolean;
};

export const PASSWORD_RULES: readonly PasswordRule[] = [
  {
    id: "length",
    label: `At least ${MIN_PASSWORD_LENGTH} characters`,
    test: (value) => value.length >= MIN_PASSWORD_LENGTH,
  },
  {
    id: "upper",
    label: "One uppercase letter",
    test: (value) => /[A-Z]/.test(value),
  },
  {
    id: "lower",
    label: "One lowercase letter",
    test: (value) => /[a-z]/.test(value),
  },
  { id: "number", label: "One number", test: (value) => /\d/.test(value) },
  {
    id: "symbol",
    label: "One symbol, like ! @ # $",
    // Anything that is not a letter, digit or whitespace.
    test: (value) => /[^A-Za-z0-9\s]/.test(value),
  },
];

/** For sign-up: the password must satisfy every rule. */
export function validateNewPassword(value: string): string | null {
  if (!value) return "Create a password.";
  if (PASSWORD_RULES.some((rule) => !rule.test(value))) {
    return "Password doesn't meet all the requirements.";
  }
  return null;
}

/**
 * For sign-in: only reject what cannot possibly be a valid password. The
 * complexity rules are NOT applied here — an account created before a rule
 * existed would be locked out of its own password.
 */
export function validateExistingPassword(value: string): string | null {
  if (!value) return "Enter your password.";
  if (value.length < MIN_PASSWORD_LENGTH) {
    return `Passwords are at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

export function validateConfirmPassword(
  password: string,
  confirm: string,
): string | null {
  if (!confirm) return "Re-enter your password.";
  if (password !== confirm) return "Passwords don't match.";
  return null;
}
