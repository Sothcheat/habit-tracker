import { useState } from "react";
import { Link } from "react-router";
import { AuthDivider } from "@/components/auth/AuthDivider";
import { AuthFeedback, type Feedback } from "@/components/auth/AuthFeedback";
import { AuthField } from "@/components/auth/AuthField";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthSubmit } from "@/components/auth/AuthSubmit";
import { ProviderButtons } from "@/components/auth/ProviderButtons";
import { useFocusRequest } from "@/hooks/useFocusRequest";
import { describeAuthError } from "@/lib/auth-errors";
import { supabase } from "@/lib/supabase";
import { validateEmail, validateExistingPassword } from "@/lib/validation";

type Errors = { email?: string | null; password?: string | null };

const EMAIL_ID = "signin-email";
const PASSWORD_ID = "signin-password";

function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [pending, setPending] = useState(false);
  const requestFocus = useFocusRequest();
  // Set when Supabase refuses sign-in because the address is unconfirmed, so
  // the resend action knows where to send.
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setUnconfirmedEmail(null);

    const next: Errors = {
      email: validateEmail(email),
      password: validateExistingPassword(password),
    };
    setErrors(next);
    if (next.email || next.password) {
      requestFocus(next.email ? EMAIL_ID : PASSWORD_ID);
      return;
    }

    setPending(true);
    const address = email.trim();
    const { error } = await supabase.auth.signInWithPassword({
      email: address,
      password,
    });

    // On success the auth listener swaps this screen for the home page, which
    // unmounts the form and discards its state.
    if (!error) return;

    const { kind, message } = describeAuthError(error);
    if (kind === "invalid_credentials") {
      setErrors({ password: message });
      setPassword("");
      requestFocus(PASSWORD_ID);
    } else if (kind === "email_not_confirmed") {
      setUnconfirmedEmail(address);
      setFeedback({ kind: "error", text: message });
    } else {
      setFeedback({ kind: "error", text: message });
    }
    setPending(false);
  }

  async function handleResend() {
    if (!unconfirmedEmail) return;
    setPending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: unconfirmedEmail,
      options: { emailRedirectTo: window.location.origin },
    });
    setFeedback(
      error
        ? { kind: "error", text: describeAuthError(error).message }
        : {
            kind: "success",
            text: `A new confirmation link is on its way to ${unconfirmedEmail}.`,
          },
    );
    if (!error) setUnconfirmedEmail(null);
    setPending(false);
  }

  async function handleForgotPassword() {
    const emailError = validateEmail(email);
    if (emailError) {
      setErrors({ email: emailError });
      setFeedback({
        kind: "error",
        text: "Enter your email above, then select Forgot password.",
      });
      requestFocus(EMAIL_ID);
      return;
    }

    const address = email.trim();
    setPending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(address, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setFeedback(
      error
        ? { kind: "error", text: describeAuthError(error).message }
        : {
            kind: "success",
            text: `If an account exists for ${address}, a reset link is on its way.`,
          },
    );
    setPending(false);
  }

  return (
    <AuthLayout
      title="Welcome back"
      description="Pick up where you left off. No streak pressure — just continue."
      footer={
        <>
          New here?{" "}
          <Link
            to="/signup"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Create an account
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
            if (errors.email) {
              setErrors((current) => ({
                ...current,
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
            setPassword(event.target.value);
            if (errors.password) {
              setErrors((current) => ({
                ...current,
                password: validateExistingPassword(event.target.value),
              }));
            }
          }}
          error={errors.password}
          // Words, not dots: "••••••••" in an empty field reads as a password
          // that's already filled in.
          placeholder="Enter your password"
          autoComplete="current-password"
          disabled={pending}
          action={
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={pending}
              className="text-muted-foreground text-sm underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50"
            >
              Forgot password?
            </button>
          }
        />

        <AuthSubmit disabled={pending} className="mt-1">
          {pending ? "Signing in…" : "Sign in"}
        </AuthSubmit>
      </form>

      <AuthFeedback feedback={feedback} />

      {unconfirmedEmail && (
        <button
          type="button"
          onClick={handleResend}
          disabled={pending}
          className="-mt-3 self-start font-medium text-foreground text-sm underline-offset-4 hover:underline disabled:opacity-50"
        >
          Resend confirmation email
        </button>
      )}
    </AuthLayout>
  );
}

export { SignInForm };
