import { useState } from "react";
import { Link } from "react-router";
import { AuthDivider } from "@/components/auth/AuthDivider";
import { AuthFeedback, type Feedback } from "@/components/auth/AuthFeedback";
import { AuthField } from "@/components/auth/AuthField";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthSubmit } from "@/components/auth/AuthSubmit";
import { PasswordRules } from "@/components/auth/PasswordRules";
import { ProviderButtons } from "@/components/auth/ProviderButtons";
import { useFocusRequest } from "@/hooks/useFocusRequest";
import { describeAuthError } from "@/lib/auth-errors";
import { supabase } from "@/lib/supabase";
import {
  validateConfirmPassword,
  validateEmail,
  validateNewPassword,
} from "@/lib/validation";

type Errors = {
  email?: string | null;
  password?: string | null;
  confirm?: string | null;
};

const EMAIL_ID = "signup-email";
const PASSWORD_ID = "signup-password";
const CONFIRM_ID = "signup-confirm-password";

function SignUpForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  // After the first submit, every field validates live as it changes.
  const [attempted, setAttempted] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [pending, setPending] = useState(false);
  const requestFocus = useFocusRequest();

  function validateAll(): Errors {
    return {
      email: validateEmail(email),
      password: validateNewPassword(password),
      confirm: validateConfirmPassword(password, confirmPassword),
    };
  }

  function resetForm() {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setErrors({});
    setAttempted(false);
  }

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setAttempted(true);

    const next = validateAll();
    setErrors(next);
    const firstInvalid = next.email
      ? EMAIL_ID
      : next.password
        ? PASSWORD_ID
        : next.confirm
          ? CONFIRM_ID
          : null;
    if (firstInvalid) {
      requestFocus(firstInvalid);
      return;
    }

    setPending(true);
    const address = email.trim();
    const { data, error } = await supabase.auth.signUp({
      email: address,
      password,
      options: { emailRedirectTo: window.location.origin },
    });

    if (error) {
      const { kind, message } = describeAuthError(error);
      if (kind === "user_exists") {
        setErrors({ email: message });
        requestFocus(EMAIL_ID);
      } else if (kind === "weak_password") {
        setErrors({ password: message });
        requestFocus(PASSWORD_ID);
      } else {
        setFeedback({ kind: "error", text: message });
      }
      setPending(false);
      return;
    }

    // Success either way: nothing typed should outlive the request.
    resetForm();
    setPending(false);

    // Confirmation off: signUp returns a session, the auth listener fires, and
    // App swaps this screen for the home page.
    if (data.session) return;

    // Confirmation on: no session until the emailed link is followed.
    // Supabase returns this same shape for an address that already exists, so
    // the copy must not claim a new account was made.
    setFeedback({
      kind: "success",
      text: `Check ${address} for a confirmation link, then sign in.`,
    });
  }

  return (
    <AuthLayout
      title="Create your account"
      description="Start with one habit. You can always add more later."
      footer={
        <>
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      <ProviderButtons
        disabled={pending}
        onError={(text) => setFeedback(text ? { kind: "error", text } : null)}
      />

      <AuthDivider />

      {/* noValidate: our messages replace the browser's, which differ per
          browser and cannot be styled. */}
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <AuthField
          id={EMAIL_ID}
          label="Email"
          type="email"
          inputMode="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (attempted || errors.email) {
              setErrors((c) => ({
                ...c,
                email: validateEmail(event.target.value),
              }));
            }
          }}
          onBlur={() => {
            if (email)
              setErrors((c) => ({ ...c, email: validateEmail(email) }));
          }}
          error={errors.email}
          placeholder="you@example.com"
          autoComplete="email"
          disabled={pending}
        />

        <AuthField
          id={PASSWORD_ID}
          label="Password"
          type="password"
          value={password}
          onChange={(event) => {
            const value = event.target.value;
            setPassword(value);
            if (attempted || errors.password) {
              setErrors((c) => ({
                ...c,
                password: validateNewPassword(value),
                confirm: confirmPassword
                  ? validateConfirmPassword(value, confirmPassword)
                  : c.confirm,
              }));
            }
          }}
          // Once something is typed, the checklist names exactly which rule
          // fails; repeating it as a sentence is noise. Empty still says so.
          error={password ? null : errors.password}
          invalid={Boolean(errors.password)}
          hint={<PasswordRules value={password} showErrors={attempted} />}
          autoComplete="new-password"
          disabled={pending}
        />

        <AuthField
          id={CONFIRM_ID}
          label="Confirm password"
          type="password"
          value={confirmPassword}
          onChange={(event) => {
            const value = event.target.value;
            setConfirmPassword(value);
            if (attempted || errors.confirm) {
              setErrors((c) => ({
                ...c,
                confirm: validateConfirmPassword(password, value),
              }));
            }
          }}
          onBlur={() => {
            if (confirmPassword) {
              setErrors((c) => ({
                ...c,
                confirm: validateConfirmPassword(password, confirmPassword),
              }));
            }
          }}
          error={errors.confirm}
          placeholder="Re-enter your password"
          autoComplete="new-password"
          disabled={pending}
        />

        <AuthSubmit disabled={pending} className="mt-1">
          {pending ? "Creating account…" : "Create account"}
        </AuthSubmit>
      </form>

      <AuthFeedback feedback={feedback} />
    </AuthLayout>
  );
}

export { SignUpForm };
