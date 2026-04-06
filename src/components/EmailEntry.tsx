import { useState } from "react";

interface EmailEntryProps {
  onSignUp: (email: string, password: string) => Promise<void>;
  onSignIn: (email: string, password: string) => Promise<void>;
  onResetPassword: (email: string) => Promise<void>;
}

type Mode = "signin" | "signup" | "forgot";

const EmailEntry = ({ onSignUp, onSignIn, onResetPassword }: EmailEntryProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mode, setMode] = useState<Mode>("signin");

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");

    if (!isValidEmail(email)) {
      setError("Please enter a valid email address");
      return;
    }

    if (mode === "forgot") {
      setIsSubmitting(true);
      try {
        await onResetPassword(email.trim().toLowerCase());
        setInfo("Password reset link sent. Check your email.");
      } catch {
        setError("Something went wrong. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === "signup") {
        await onSignUp(email.trim().toLowerCase(), password);
      } else {
        await onSignIn(email.trim().toLowerCase(), password);
      }
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchMode = (newMode: Mode) => {
    setMode(newMode);
    setError("");
    setInfo("");
    setPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5">
      <div className="w-full max-w-sm space-y-8">
        <div>
          <h1 className="text-lg font-bold text-foreground tracking-tight">
            SiteLog
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {mode === "signin" && "Sign in to your account"}
            {mode === "signup" && "Create a new account"}
            {mode === "forgot" && "Reset your password"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            autoFocus
            className="w-full px-4 py-3 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />

          {mode !== "forgot" && (
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full px-4 py-3 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          )}

          {mode === "signup" && (
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              className="w-full px-4 py-3 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}
          {info && <p className="text-xs text-green-600">{info}</p>}

          <button
            type="submit"
            disabled={isSubmitting || !email}
            className="w-full py-3.5 bg-foreground text-background text-sm font-medium tracking-wide uppercase rounded-lg transition-opacity duration-150 disabled:opacity-30 disabled:cursor-not-allowed active:opacity-80"
          >
            {isSubmitting
              ? "Please wait…"
              : mode === "signin"
              ? "Sign In"
              : mode === "signup"
              ? "Create Account"
              : "Send Reset Link"}
          </button>
        </form>

        <div className="flex flex-col items-center gap-2 text-xs">
          {mode === "signin" && (
            <>
              <button
                type="button"
                onClick={() => switchMode("forgot")}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Forgot password?
              </button>
              <button
                type="button"
                onClick={() => switchMode("signup")}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Don't have an account? <span className="text-foreground font-medium">Sign up</span>
              </button>
            </>
          )}
          {mode === "signup" && (
            <button
              type="button"
              onClick={() => switchMode("signin")}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Already have an account? <span className="text-foreground font-medium">Sign in</span>
            </button>
          )}
          {mode === "forgot" && (
            <button
              type="button"
              onClick={() => switchMode("signin")}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailEntry;
