

## Diagnosis: Password Reset Redirect Mismatch + UX Fix

### Root Cause Of Redirect Mismatch

The Lovable web app's `useUser.ts` correctly hardcodes `redirectTo: "https://site-voice-log.lovable.app/reset-password"`. But the **Replit app has its own separate codebase** with its own `resetPasswordForEmail` call — likely still using `window.location.origin` (a Replit webview URL). Since that Replit URL isn't in the Supabase redirect allowlist, Supabase silently falls back to the **Site URL root** (`https://site-voice-log.lovable.app/`), landing on the homepage.

We cannot fix the Replit code (per instructions). The fix must be on the Lovable web app side.

### Exact Fix Needed

**Add recovery token detection to the Index/homepage route.** If someone lands on `/` with a recovery hash token (e.g., `#access_token=...&type=recovery`), automatically redirect them to `/reset-password` with the hash preserved. This catches the Supabase fallback case — no matter where the reset was triggered, the recovery token will be detected and routed correctly.

**File:** `src/pages/Index.tsx` — add an early `useEffect` that checks `window.location.hash` for `type=recovery` and redirects to `/reset-password` + hash.

### Reset Success Page UX Fix

The current "Go to App" button calls `navigate("/")`, which just loads the Lovable homepage in the browser — useless for a Replit user.

**Replace with:**
- Remove the button entirely
- Show clear text: "Password updated successfully. Return to the SiteLog app and sign in with your new password."
- No fake deep-link button

**File:** `src/pages/ResetPassword.tsx` — update the success state JSX.

### Files To Change

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Add `useEffect` to detect `type=recovery` in hash and redirect to `/reset-password` |
| `src/pages/ResetPassword.tsx` | Replace "Go to App" button with instructional text (no navigation) |

Two files, minimal changes, no backend/auth setting changes needed.

