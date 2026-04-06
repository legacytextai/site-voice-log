

## Diagnosis: Email + Password Auth for SiteLog

### Email/Password Auth Support Status

Email/password auth is natively supported by Lovable Cloud. It requires **no custom email domain, no custom templates, and no OTP configuration**. The only config needed is enabling email/password in **Cloud → Users → Auth Settings** (if not already on).

Email confirmation can remain **OFF** for MVP (enable auto-confirm). This means users sign up and immediately have an active session — no inbox verification required.

### Backend Compatibility With Existing auth_id / RLS / Edge Functions

**Everything already built works unchanged with email/password auth.** Specifically:

| Component | Status | Why |
|-----------|--------|-----|
| `users.auth_id` column | ✅ Compatible | `auth.users.id` is the same regardless of sign-in method |
| `get_user_id_for_auth()` | ✅ Compatible | Maps `auth.uid()` → `users.id`, method-agnostic |
| All RLS policies | ✅ Compatible | Use `auth.uid()` which works identically for password auth |
| `generate-report` JWT validation | ✅ Compatible | Validates JWT from `Authorization` header — same token format |
| `regenerate-report-pdf` JWT validation | ✅ Compatible | Same pattern |
| `resolveProfile()` in `useUser.ts` | ✅ Compatible | Looks up by `auth_id`, falls back to email binding — works for any auth method |

**Zero backend/migration/RLS/edge-function changes required.**

### Existing Users Migration Behavior

The current `resolveProfile` + edge function binding strategy handles this correctly:

1. User signs up with email that already exists in `users` table (with `auth_id = NULL`)
2. `resolveProfile` tries `auth_id` lookup → no match
3. Falls back to email lookup → finds existing row with `auth_id = NULL`
4. Sets user optimistically in frontend
5. On first edge function call, `resolveUserId` binds `auth_id` to the existing row via service role
6. Subsequent requests use `auth_id` directly

**One gap**: the client-side `resolveProfile` can't update `auth_id` itself (RLS blocks it since auth_id doesn't match yet). The edge function handles binding, but there's a window where the client can read via email match but can't write. This works for MVP because:
- Profile reads happen via the optimistic set
- Writes go through edge functions which bind `auth_id` on first call

### Password Recovery Diagnosis

**This is the one tricky part.** Supabase password reset works via:

1. App calls `supabase.auth.resetPasswordForEmail(email, { redirectTo })`
2. User receives email with a reset link
3. Link opens in browser at the `redirectTo` URL with a recovery token
4. App at that URL calls `supabase.auth.updateUser({ password })`

**The problem**: This link opens in the device browser, not the Replit webview. This is the same browser-isolation issue as magic links.

**MVP workaround options**:

- **Option A (simplest)**: The `redirectTo` points to the published Lovable web app URL (`https://site-voice-log.lovable.app/reset-password`). User resets password in the browser. Then returns to Replit app and signs in with new password. Not seamless but functional.
- **Option B**: Build a standalone `/reset-password` page in the Lovable web app that handles the token and shows a "password updated, return to your app" message. Same as Option A but with a better UX.
- **Option C**: Skip password reset entirely for MVP. If a user forgets their password, they contact support. Not ideal but simplest.

**Recommendation**: Option A/B. The reset flow happens rarely, and completing it in browser is acceptable. The user just signs back in with the new password in the Replit app.

### Minimum Required Backend / Auth Setting Changes

#### Required

1. **Auth setting**: Enable email/password sign-up in **Cloud → Users → Auth Settings**
2. **Auth setting**: Enable auto-confirm (skip email verification) for MVP
3. **Auth setting**: Update project name to "SiteLog"
4. **Frontend**: Replace `signInWithOtp` / `verifyOtp` with `signUp` / `signInWithPassword` in `useUser.ts`
5. **Frontend**: Replace `EmailEntry.tsx` OTP UI with email + password sign-up/sign-in form
6. **Frontend**: Add `/reset-password` route for browser-based password recovery

#### Optional (not blocking)

- Add password strength validation in the sign-up form
- Add "forgot password" link that calls `resetPasswordForEmail`
- Customize the password reset email template (requires custom email domain — defer)

### Recommended MVP Auth Path

```text
SIGN UP:
  Email + Password → supabase.auth.signUp({ email, password })
  → auto-confirmed → session created → resolveProfile binds auth_id

SIGN IN:
  Email + Password → supabase.auth.signInWithPassword({ email, password })
  → session created → resolveProfile resolves user

PASSWORD RESET:
  "Forgot password?" → supabase.auth.resetPasswordForEmail(email, { redirectTo })
  → email with link → opens Lovable web app /reset-password
  → user sets new password → returns to Replit app → signs in

SESSION:
  Supabase client persists session in localStorage
  → auto-refresh on app reopen
  → no re-login needed until token expires
```

**Files to change**: `useUser.ts`, `EmailEntry.tsx`, `Index.tsx`, add `/reset-password` page. **Zero backend/migration/edge-function changes.**

