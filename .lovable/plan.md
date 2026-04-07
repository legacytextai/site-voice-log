

## Diagnosis: Profile Resolution Failure — Root Cause Identified

### Existing Users Row State

All 4 users in `public.users` have **`auth_id = NULL`**:

```text
email               | auth_id | created_at
abdul.b@fecgc.com   | NULL    | 2026-03-29
abdul.b@fecg.com    | NULL    | 2026-04-05
fade.j@fecgc.com    | NULL    | 2026-03-30
zeidkhoja@gmail.com | NULL    | 2026-03-30
```

These are legacy rows created before auth was implemented. They have no `auth_id` binding.

### Auth Binding State

Auth logs confirm `abdul.b@fecgc.com` successfully authenticates (auth.users.id = `8c97bddd-b6fa-46f6-8cf7-60b864faf74a`). But the corresponding `public.users` row has `auth_id = NULL` — complete mismatch.

### RLS / Policy Findings

This is where everything breaks. The cascade:

1. **`users_select_own`** policy uses `id = get_user_id_for_auth(auth.uid())`. The function `get_user_id_for_auth` does `SELECT id FROM users WHERE auth_id = auth_uid`. Since `auth_id` is NULL → function returns NULL → `id = NULL` is always false → **all SELECT queries are blocked by RLS**.

2. **`byEmail` fallback** in `useUser.ts` also fails because the same SELECT RLS policy blocks it — the user can't read ANY row.

3. **Insert fallback** would set `auth_id = auth.uid()` correctly, but hits the **`users_email_key` UNIQUE constraint** because a row with that email already exists.

4. **Retry lookup** by `auth_id` also fails (same RLS block).

5. All paths exhausted → `"profile resolve failed after all paths"` → sign out.

### Exact Root Cause

**Legacy users rows have NULL `auth_id`**, which creates a deadlock:
- Can't SELECT (RLS depends on `auth_id` match)
- Can't INSERT (email unique constraint blocks duplicate)
- Can't UPDATE (can't select the row to update it)

### Exact Database Fix Recommended

**One migration with two parts:**

**Part 1 — Backfill `auth_id` for existing users.** Create a trigger function that runs on sign-in to bind `auth_id` automatically. Since RLS blocks the client, this must be a **database-level trigger on `auth.users`** — but we can't modify auth schema. Instead, use a **security definer function** callable from the client:

```sql
CREATE OR REPLACE FUNCTION public.bind_auth_id(auth_uid uuid, user_email text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.users 
  SET auth_id = auth_uid 
  WHERE email = user_email AND auth_id IS NULL;
$$;
```

**Part 2 — Update `useUser.ts`** to call `bind_auth_id` before the profile lookup:

```typescript
// Before the byAuth lookup, try to bind auth_id for legacy users
await supabase.rpc('bind_auth_id', { 
  auth_uid: authUser.id, 
  user_email: email 
});
```

This way, on first sign-in after the fix:
1. `bind_auth_id` sets `auth_id` on the legacy row (bypasses RLS via SECURITY DEFINER)
2. `byAuth` lookup now finds the row (RLS passes)
3. Profile resolves → user enters the app

### Files / Settings To Change

| Target | Change |
|--------|--------|
| Database migration | Create `bind_auth_id` security definer function |
| `src/hooks/useUser.ts` | Call `rpc('bind_auth_id')` at the start of `resolveProfile` |

Two changes. No table structure changes. No RLS policy changes. Existing data preserved.

