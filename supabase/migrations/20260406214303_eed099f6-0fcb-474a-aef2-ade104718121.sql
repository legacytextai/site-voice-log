-- 1. Add auth_id column to users table
ALTER TABLE users ADD COLUMN auth_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX idx_users_auth_id ON users(auth_id);

-- 2. Create helper function for RLS
CREATE OR REPLACE FUNCTION public.get_user_id_for_auth(auth_uid uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.users WHERE auth_id = auth_uid LIMIT 1;
$$;

-- 3. Drop all existing permissive RLS policies

DROP POLICY IF EXISTS "public_insert" ON users;
DROP POLICY IF EXISTS "public_select" ON users;
DROP POLICY IF EXISTS "public_update" ON users;

DROP POLICY IF EXISTS "Anyone can insert voice logs" ON voice_logs;
DROP POLICY IF EXISTS "Anyone can read voice logs" ON voice_logs;
DROP POLICY IF EXISTS "Anyone can update voice logs" ON voice_logs;
DROP POLICY IF EXISTS "Anyone can delete voice logs" ON voice_logs;

DROP POLICY IF EXISTS "Anyone can insert daily reports" ON daily_reports;
DROP POLICY IF EXISTS "Anyone can read daily reports" ON daily_reports;
DROP POLICY IF EXISTS "Anyone can update daily reports" ON daily_reports;

DROP POLICY IF EXISTS "public_insert_admin" ON admin_reports;
DROP POLICY IF EXISTS "public_select_admin" ON admin_reports;
DROP POLICY IF EXISTS "public_update_admin" ON admin_reports;

-- 4. Create ownership-enforcing RLS policies

CREATE POLICY "users_select_own" ON users
  FOR SELECT TO authenticated
  USING (id = public.get_user_id_for_auth(auth.uid()));

CREATE POLICY "users_update_own" ON users
  FOR UPDATE TO authenticated
  USING (id = public.get_user_id_for_auth(auth.uid()));

CREATE POLICY "voice_logs_select_own" ON voice_logs
  FOR SELECT TO authenticated
  USING (user_id = public.get_user_id_for_auth(auth.uid()));

CREATE POLICY "voice_logs_insert_own" ON voice_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.get_user_id_for_auth(auth.uid()));

CREATE POLICY "voice_logs_update_own" ON voice_logs
  FOR UPDATE TO authenticated
  USING (user_id = public.get_user_id_for_auth(auth.uid()));

CREATE POLICY "voice_logs_delete_own" ON voice_logs
  FOR DELETE TO authenticated
  USING (user_id = public.get_user_id_for_auth(auth.uid()));

CREATE POLICY "daily_reports_select_own" ON daily_reports
  FOR SELECT TO authenticated
  USING (user_id = public.get_user_id_for_auth(auth.uid()));

CREATE POLICY "daily_reports_insert_own" ON daily_reports
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.get_user_id_for_auth(auth.uid()));

CREATE POLICY "daily_reports_update_own" ON daily_reports
  FOR UPDATE TO authenticated
  USING (user_id = public.get_user_id_for_auth(auth.uid()));

CREATE POLICY "admin_reports_select_own" ON admin_reports
  FOR SELECT TO authenticated
  USING (user_id = public.get_user_id_for_auth(auth.uid()));

CREATE POLICY "admin_reports_insert_own" ON admin_reports
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.get_user_id_for_auth(auth.uid()));

CREATE POLICY "admin_reports_update_own" ON admin_reports
  FOR UPDATE TO authenticated
  USING (user_id = public.get_user_id_for_auth(auth.uid()));