import { useState } from "react";

interface EmailEntryProps {
  onLogin: (email: string) => Promise<void>;
  onVerifyOtp?: (email: string, token: string) => Promise<void>;
  otpSent?: boolean;
}

const EmailEntry = ({ onLogin, onVerifyOtp, otpSent }: EmailEntryProps) => {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const handleSubmitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!isValidEmail(email)) {
      setError("Please enter a valid email address");
      return;
    }

    setIsSubmitting(true);
    try {
      await onLogin(email.trim().toLowerCase());
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!otp || otp.length < 6) {
      setError("Please enter the 6-digit code from your email");
      return;
    }

    setIsSubmitting(true);
    try {
      await onVerifyOtp?.(email.trim().toLowerCase(), otp.trim());
    } catch {
      setError("Invalid or expired code. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (otpSent) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5">
        <div className="w-full max-w-sm space-y-8">
          <div>
            <h1 className="text-lg font-bold text-foreground tracking-tight">
              SiteLog
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Check your email for a verification code
            </p>
          </div>

          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              We sent a code to <strong className="text-foreground">{email}</strong>
            </p>
            <input
              type="text"
              inputMode="numeric"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="Enter 6-digit code"
              autoFocus
              className="w-full px-4 py-3 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-center tracking-[0.3em] font-mono text-lg"
            />

            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}

            <button
              type="submit"
              disabled={isSubmitting || otp.length < 6}
              className="w-full py-3.5 bg-foreground text-background text-sm font-medium tracking-wide uppercase rounded-lg transition-opacity duration-150 disabled:opacity-30 disabled:cursor-not-allowed active:opacity-80"
            >
              {isSubmitting ? "Verifying…" : "Verify"}
            </button>

            <button
              type="button"
              onClick={() => {
                setOtp("");
                setError("");
                onLogin(email.trim().toLowerCase());
              }}
              className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Resend code
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5">
      <div className="w-full max-w-sm space-y-8">
        <div>
          <h1 className="text-lg font-bold text-foreground tracking-tight">
            SiteLog
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Enter your email to get started
          </p>
        </div>

        <form onSubmit={handleSubmitEmail} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            autoFocus
            className="w-full px-4 py-3 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !email}
            className="w-full py-3.5 bg-foreground text-background text-sm font-medium tracking-wide uppercase rounded-lg transition-opacity duration-150 disabled:opacity-30 disabled:cursor-not-allowed active:opacity-80"
          >
            {isSubmitting ? "Sending code…" : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default EmailEntry;
