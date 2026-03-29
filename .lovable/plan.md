

## Plan: Fix Onboarding Dialog Mobile Overflow

### Problem
The onboarding dialog extends edge-to-edge on small screens, cutting off text on the sides (visible in the iPhone screenshot — step 3 text is clipped).

### Fix — `src/pages/Index.tsx`

Change the `DialogContent` className from `max-w-sm` to `max-w-[calc(100vw-2rem)] sm:max-w-sm` so it respects a 1rem margin on each side on mobile. This ensures the dialog never exceeds viewport width minus comfortable padding.

One line change.

