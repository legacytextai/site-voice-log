

## Fix: Atomic Profile Resolution RPC (Revised)

### Database Migration

Create `get_or_create_user_profile` with both revisions incorporated:

```sql
CREATE OR REPLACE FUNCTION public.get_or_create_user_profile(auth_uid uuid, user_email text)
RETURNS TABLE(id uuid, email text, project_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
  _email text;
  _project_name text;
BEGIN
  -- Case 1: already bound to this auth user
  SELECT u.id, u.email, u.project_name INTO _id, _email, _project_name
  FROM public.users u WHERE u.auth_id = auth_uid LIMIT 1;
  IF FOUND THEN
    RETURN QUERY SELECT _id, _email, _project_name;
    RETURN;
  END IF;

  -- Case 2: email exists — check auth_id state
  SELECT u.id, u.email, u.project_name, u.auth_id INTO _id, _email, _project_name
  FROM public.users u WHERE u.email = user_email LIMIT 1;

  IF FOUND THEN
    -- 2a: already linked to a DIFFERENT auth user → error
    IF _id IS NOT NULL AND (SELECT u.auth_id FROM public.users u WHERE u.email = user_email) IS NOT NULL THEN
      RAISE EXCEPTION 'Email already linked to another account';
    END IF;
    -- 2b: legacy row with NULL auth_id → bind it
    UPDATE public.users u SET auth_id = auth_uid
    WHERE u.email = user_email AND u.auth_id IS NULL
    RETURNING u.id, u.email, u.project_name INTO _id, _email, _project_name;
    RETURN QUERY SELECT _id, _email, _project_name;
    RETURN;
  END IF;

  -- Case 3: no row at all → create
  INSERT INTO public.users (email, auth_id)
  VALUES (user_email, auth_uid)
  RETURNING public.users.id, public.users.email, public.users.project_name
  INTO _id, _email, _project_name;

  RETURN QUERY SELECT _id, _email, _project_name;
END;
$$;

-- Lock down permissions: only authenticated users can call this
REVOKE ALL ON FUNCTION public.get_or_create_user_profile(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_create_user_profile(uuid, text) TO authenticated;
```

**Revision 1 handled**: Case 2a explicitly checks if the email row has a non-NULL `auth_id` that differs from the caller's. Raises `'Email already linked to another account'` instead of silently failing or hitting a constraint error.

**Revision 2 handled**: `REVOKE ALL FROM PUBLIC` removes default execute access. `GRANT EXECUTE TO authenticated` restricts the function to signed-in users only. Anonymous callers cannot invoke it.

### Frontend Change: `src/hooks/useUser.ts`

Replace the multi-step `resolveProfile` body with:

```typescript
const resolveProfile = useCallback(async (authUser: { id: string; email?: string }) => {
  const email = authUser.email || "";
  const { data, error } = await supabase.rpc('get_or_create_user_profile', {
    auth_uid: authUser.id,
    user_email: email,
  });
  if (error || !data || data.length === 0) {
    console.error("Profile resolution failed:", error?.message);
    return;
  }
  const profile = data[0];
  setUser({ id: profile.id, email: profile.email, project_name: profile.project_name });
}, []);
```

The existing `bind_auth_id` call and all fallback SELECT/INSERT logic are removed — the RPC handles everything atomically.

### Files To Change

| Target | Change |
|--------|--------|
| Database migration | Create `get_or_create_user_profile` function + explicit GRANT |
| `src/hooks/useUser.ts` | Replace `resolveProfile` with single RPC call |

