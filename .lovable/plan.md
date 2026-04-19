

## Add Public `/support` Page

### Implementation

**1. Create `src/pages/Support.tsx`**
- Centered, minimal layout (max-w-2xl, mx-auto, padded)
- Sets `document.title = "FieldLog Support"` via `useEffect`
- Content sections:
  - Heading: "FieldLog Support"
  - Intro copy
  - Subtle `<hr>` divider (border-border)
  - Contact section with `mailto:publicworkschannel@gmail.com` link
  - Response time note
- Black/white FieldLog aesthetic using existing tokens (`bg-background`, `text-foreground`, `text-muted-foreground`)
- Mobile-friendly with responsive padding

**2. Update `src/App.tsx`**
- Add `<Route path="/support" element={<Support />} />` above the catch-all
- Import the new component

### Access
No auth guards exist at the route level (Index handles its own auth state internally). `/support` will be publicly accessible by default — no extra exclusion logic needed.

### Files
| Action | File |
|--------|------|
| Create | `src/pages/Support.tsx` |
| Edit | `src/App.tsx` (add route + import) |

Total: 1 new file, 1 edit.

