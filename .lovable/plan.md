

## Plan: Supabase Auth Security Layer for SiteLog

### 1. Database Migration (single SQL migration)

**Schema changes:**
- Add `auth_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE` to `users` table (nullable for safe migration)
- Create `get_user_id_for_auth(auth_uid uuid)` security definer function
- Drop all existing permissive `true` RLS policies on `users`, `voice_logs`, `daily_reports`, `admin_reports`
- Create ownership-enforcing RLS policies using `get_user_id_for_auth(auth.uid())`
- Add index on `users(auth_id)` for lookup performance

**RLS policy design:**

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `users` | `id = get_user_id_for_auth(auth.uid())` | service role only (edge functions create users) | `id = get_user_id_for_auth(auth.uid())` | N/A |
| `voice_logs` | `user_id = get_user_id_for_auth(auth.uid())` | `user_id = get_user_id_for_auth(auth.uid())` | `user_id = get_user_id_for_auth(auth.uid())` | `user_id = get_user_id_for_auth(auth.uid())` |
| `daily_reports` | `user_id = get_user_id_for_auth(auth.uid())` | `user_id = get_user_id_for_auth(auth.uid())` | `user_id = get_user_id_for_auth(auth.uid())` | N/A |
| `admin_reports` | `user_id = get_user_id_for_auth(auth.uid())` | `user_id = get_user_id_for_auth(auth.uid())` | `user_id = get_user_id_for_auth(auth.uid())` | N/A |

**Note on edge functions**: Edge functions use `SUPABASE_SERVICE_ROLE_KEY` which bypasses RLS. They will continue to work. The RLS policies protect against direct client-side access from unauthenticated or wrong users.

### 2. Edge Function: `generate-report`

**Changes (lines 141-175 area):**
- Extract `Authorization` header from request
- Validate JWT using `supabase.auth.getUser()` with anon key client
- Look up `users.id` from `auth_id = auth_user.id`
- Use that resolved `user_id` instead of the client-supplied one
- Reject if no matching user found
- Remove `user_id` from required input validation (it's now derived from JWT)

**Rest of function unchanged** — all downstream logic uses the resolved `user_id`.

### 3. Edge Function: `regenerate-report-pdf`

**Same pattern:**
- Extract and validate JWT from Authorization header
- Resolve `user_id` from `auth_id`
- Use resolved `user_id` for all lookups
- Remove `user_id` from required input fields

### 4. NULL user_id inspection

Will query existing rows to report counts of NULL `user_id` in `voice_logs` and `daily_reports`. No schema change yet — just reporting.

### 5. Frontend auth hook

**Replace `useUser` hook:**
- Use `supabase.auth.signInWithOtp({ email })` for magic link login
- On auth state change (`onAuthStateChange`), look up or create `users` row by email and bind `auth_id`
- Session managed by Supabase Auth (no more localStorage `sitelog_user_id`)
- Keep `project_name` on `users` table as before

**Update `Index.tsx`:**
- Login flow calls OTP instead of direct insert
- All `supabase.functions.invoke()` calls automatically include the JWT via the authenticated client

### Technical Details

**Files changed:**
1. New migration SQL (schema + function + RLS policies)
2. `supabase/functions/generate-report/index.ts` — JWT validation + user_id resolution
3. `supabase/functions/regenerate-report-pdf/index.ts` — same pattern
4. `src/hooks/useUser.ts` — Supabase Auth OTP flow
5. `src/pages/Index.tsx` — minor login flow adjustment

**Migration risk:** Zero for existing data. `auth_id` is nullable; existing rows unaffected. Old `true` RLS policies are replaced, but edge functions use service role key (bypasses RLS). Frontend will require authentication after this change — unauthenticated access will be blocked by RLS.

**Auth configuration:** Will use `cloud--configure_auth` to ensure email OTP is enabled. Will NOT enable auto-confirm (users must verify email).

