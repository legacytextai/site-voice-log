import { useState } from "react";

interface EmailEntryProps {
  onLogin: (email: string) => Promise<void>;
}

const EmailEntry = ({ onLogin }: EmailEntryProps) => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const handleSubmit = async (e: React.FormEvent) => {
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

        <form onSubmit={handleSubmit} className="space-y-4">
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
            {isSubmitting ? "Loading…" : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default EmailEntry;
