ALTER TABLE public.users ADD COLUMN project_name text;

CREATE POLICY "public_update" ON public.users
  FOR UPDATE USING (true);