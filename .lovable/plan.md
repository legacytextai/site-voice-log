

## Plan: Add Sign Out Button

### What happens
- "Sign Out" clears localStorage (user ID + onboarding flag) and returns to email entry screen
- Re-entering the same email loads the existing user and all their data
- Re-entering a new email triggers onboarding again

### Changes

**`src/hooks/useUser.ts`** — Add `logout` callback:
- Removes `sitelog_user_id` and `sitelog_onboarding_seen` from localStorage
- Sets user state to `null`

**`src/pages/Index.tsx`** — Add sign out button:
- Small ghost-style "Sign Out" text button in the header (top-right)
- Calls `logout()` on click

### Files
| File | Change |
|------|--------|
| `src/hooks/useUser.ts` | Add `logout` function |
| `src/pages/Index.tsx` | Render sign out button in header |

