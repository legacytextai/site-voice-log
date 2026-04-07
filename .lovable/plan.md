

## Diagnosis: Password Reset Broken — Two Distinct Issues Found

### Exact Reset Error

**Case 2 (Lovable web app "Something went wrong")**: The auth logs show that `resetPasswordForEmail` calls DO succeed (HTTP 200 from `/recover`). However, the user hit **429 rate limiting** ("For security purposes, you can only request this after 26 seconds") on subsequent attempts. The `catch` block in `EmailEntry.tsx` line 37 swallows the actual error and shows a generic "Something went wrong" — hiding the real rate-limit message. The first attempt likely succeeded and sent the email, but the user didn't realize it and retried, hitting rate limits.

**Case 1 (Link opens homepage)**: Auth logs confirm the `/verify` endpoint returns 303 (redirect) after clicking the email link. But the redirect destination is the **Site URL root** (`https://site-voice-log.lovable.app/`) instead of `/reset-password`. This happens because `https://site-voice-log.lovable.app/reset-password` is **not in the Supabase Auth redirect allowlist**. When the `redirect_to` parameter isn't in the allowlist, Supabase silently falls back to the Site URL root.

### Root Cause

Two independent bugs:

1. **Redirect allowlist missing entry** — The `redirectTo` in the code points to `/reset-password`, but this URL was never added to the auth redirect allowlist. Supabase falls back to root → homepage.

2. **Error swallowing in EmailEntry** — The forgot-password `catch` block hides the actual error (e.g. "429: rate limit") behind a generic "Something went wrong" message, making the user think the first send failed when it actually succeeded.

3. **ResetPassword page has no timeout/fallback** — If someone lands on `/reset-password` without a recovery token (which happens because of bug #1), they see "Loading recovery session…" forever with no way to proceed.

### Plan

**Step 1 — Add redirect URL to auth allowlist**

Use `cloud--configure_auth` to add `https://site-voice-log.lovable.app/reset-password` to the allowed redirect URLs. This is the critical fix — without it, the email link will always land on the homepage.

**Step 2 — Fix error display in EmailEntry.tsx**

Change line 37 from:
```
setError("Something went wrong. Please try again.");
```
to:
```
setError(err?.message || "Something went wrong. Please try again.");
```
This surfaces the actual Supabase error (rate limit, network issue, etc.) instead of hiding it.

**Step 3 — Add timeout/fallback to ResetPassword.tsx**

Add a timeout (e.g. 5 seconds) to the "Loading recovery session…" state. If `isRecovery` doesn't become `true` within that time, show a helpful message: "No recovery session found. Please request a new password reset link." with a link back to the sign-in page. This prevents infinite loading when someone reaches the page without a valid token.

### Files To Change

| File | Change |
|------|--------|
| Auth settings | Add `https://site-voice-log.lovable.app/reset-password` to redirect allowlist |
| `src/components/EmailEntry.tsx` | Show actual error message instead of generic text |
| `src/pages/ResetPassword.tsx` | Add timeout fallback for missing recovery session |

### What To Test Next

After implementation:
1. Wait 30+ seconds (rate limit cooldown), then send a fresh reset from the Lovable web app — should show "Password reset link sent"
2. Click the link in the email — should open `/reset-password` (not homepage)
3. Should see the password form, not "Loading recovery session…"
4. Set new password → success message
5. Return to Replit app → sign in with new password

