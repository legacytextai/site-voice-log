

## Fix: Loading Screen Deadlock in useUser.ts

### Root Cause

In `useUser.ts` line 31, `onAuthStateChange` callback uses `await resolveProfile(session.user)`. The Supabase auth client warns against awaiting async operations inside this callback — it can deadlock the internal auth state machine, preventing `setIsLoading(false)` from executing.

Additionally, both `onAuthStateChange` and `getSession().then()` race to call `resolveProfile`, potentially causing double-execution or missed `isLoading = false` calls if one path fails.

### Fix

Refactor `useUser.ts` to:

1. **Remove `await` from `onAuthStateChange`** — use fire-and-forget for `resolveProfile`
2. **Gate on `getSession` only for initial load** — set `isLoading = false` after `getSession` resolves
3. **Let `onAuthStateChange` handle subsequent auth changes** (sign in/out) without blocking

```typescript
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      if (session?.user) {
        resolveProfile(session.user);  // fire-and-forget — no await
      } else {
        setUser(null);
      }
    }
  );

  supabase.auth.getSession().then(async ({ data: { session } }) => {
    if (session?.user) {
      await resolveProfile(session.user);
    }
    setIsLoading(false);  // only place that sets loading false
  });

  return () => subscription.unsubscribe();
}, [resolveProfile]);
```

Key change: `onAuthStateChange` no longer awaits and no longer sets `isLoading`. The initial load is handled entirely by `getSession`, which is safe to await.

### File To Change

| File | Change |
|------|--------|
| `src/hooks/useUser.ts` | Remove `await` and `setIsLoading` from `onAuthStateChange` callback |

One file, ~3 lines changed.

