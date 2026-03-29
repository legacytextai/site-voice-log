

## Plan: First-Time Onboarding Popup

### Change
Add an onboarding dialog to `src/pages/Index.tsx` using the existing `Dialog` component. Shows once after first login, dismissed via "Got It", persisted with `localStorage`.

### Implementation — `src/pages/Index.tsx`

1. Import `Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription` from `@/components/ui/dialog`
2. Import `Button` from `@/components/ui/button`
3. Add `justLoggedIn` ref (set true after `login()` call succeeds)
4. Add `showOnboarding` state — set true when user becomes non-null AND `justLoggedIn` is true AND `localStorage.getItem("sitelog_onboarding_seen")` is falsy
5. Render dialog with exact copy:
   - Title: "Quick Start — Just Tap to Record"
   - Body: ordered list with the 3 steps (exact wording confirmed above)
   - Button: "Got It" → sets `localStorage.setItem("sitelog_onboarding_seen", "true")`, closes dialog
6. Wrap login call to set the justLoggedIn flag

### Logic Flow
```text
User enters email → login() succeeds → justLoggedIn = true
→ useEffect sees user + justLoggedIn + no localStorage flag
→ showOnboarding = true → dialog renders
→ "Got It" clicked → localStorage flag set → dialog closes
→ Future visits: localStorage flag exists → dialog never shows
```

### Files
| File | Action |
|------|--------|
| `src/pages/Index.tsx` | Modify — add ~30 lines for dialog + state logic |

