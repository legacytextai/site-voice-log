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