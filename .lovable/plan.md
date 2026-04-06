

## Diagnosis: Password Reset Redirect Issue

### Root Cause

The `redirectTo` in `useUser.ts` line 97 uses `window.location.origin`, which resolves to the **Replit webview origin** (e.g., `https://<replit-id>.replit.dev`), not the published Lovable app URL. When Supabase processes the reset, it redirects to `https://<replit-id>.replit.dev/reset-password` — but the user opens the link in their device browser, which has no access to the Replit webview. The browser likely fails to load the Replit URL correctly and falls back or redirects to the Lovable homepage.

Additionally, Supabase Auth's **Site URL** setting determines the base redirect. If it's set to `https://site-voice-log.lovable.app` without `/reset-password`, and the `redirectTo` from the Replit origin isn't in the allowed redirect URLs list, Supabase falls back to the Site URL root — the homepage.

### Current Wrong Redirect

- `redirectTo` = `${window.location.origin}/reset-password` = Replit webview URL (not accessible in device browser)
- Supabase likely rejects this as an unallowed redirect and falls back to Site URL (`https://site-voice-log.lovable.app/`)
- User lands on homepage, not the reset page

### Exact Redirect Fix

**One code change** in `src/hooks/useUser.ts` line 97:

Replace:
```typescript
redirectTo: `${window.location.origin}/reset-password`,
```

With:
```typescript
redirectTo: `https://site-voice-log.lovable.app/reset-password`,
```

This hardcodes the redirect to the published Lovable app's `/reset-password` route, which:
- Is accessible in any device browser
- Already has the `ResetPassword` component mounted at that route
- Will correctly handle the recovery token from the URL hash

No other changes needed — the `/reset-password` route exists in `App.tsx` (line 20), and the `ResetPassword.tsx` component already handles `PASSWORD_RECOVERY` events and `type=recovery` hash detection.

### Reset Password Route Plan

Already implemented and correct:
- Route: `/reset-password` in `App.tsx`
- Component: `ResetPassword.tsx` — detects recovery session, shows password form, calls `updateUser({ password })`
- Success state shows "return to app" message

### Email Link Rendering

The invisible/poorly rendered link is a default Supabase email template issue. To fix this properly would require setting up a custom email domain and scaffolding auth email templates. This is **not required** for the redirect fix — the link still works when tapped (even if visually broken). We can address email template branding separately.

### What To Test Next

After implementing the one-line redirect fix:
1. Tap "Forgot password?" in the Replit app
2. Enter email, submit
3. Open the reset email on your phone
4. Tap the link area — should open `https://site-voice-log.lovable.app/reset-password`
5. The page should show "Set your new password" form (not the homepage)
6. Enter new password, submit
7. Return to Replit app, sign in with new password

### Technical Details

**Files to change:** 1 file, 1 line
- `src/hooks/useUser.ts` line 97: hardcode `redirectTo` to `https://site-voice-log.lovable.app/reset-password`

