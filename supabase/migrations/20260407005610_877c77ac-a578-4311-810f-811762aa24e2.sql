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
  SELECT u.id, u.email, u.project_name INTO _id, _email, _project_name
  FROM public.users u WHERE u.auth_id = auth_uid LIMIT 1;
  IF FOUND THEN
    RETURN QUERY SELECT _id, _email, _project_name;
    RETURN;
  END IF;

  SELECT u.id, u.email, u.project_name INTO _id, _email, _project_name
  FROM public.users u WHERE u.email = user_email LIMIT 1;

  IF FOUND THEN
    IF (SELECT u.auth_id FROM public.users u WHERE u.email = user_email) IS NOT NULL THEN
      RAISE EXCEPTION 'Email already linked to another account';
    END IF;
    UPDATE public.users u SET auth_id = auth_uid
    WHERE u.email = user_email AND u.auth_id IS NULL
    RETURNING u.id, u.email, u.project_name INTO _id, _email, _project_name;
    RETURN QUERY SELECT _id, _email, _project_name;
    RETURN;
  END IF;

  INSERT INTO public.users (email, auth_id)
  VALUES (user_email, auth_uid)
  RETURNING public.users.id, public.users.email, public.users.project_name
  INTO _id, _email, _project_name;

  RETURN QUERY SELECT _id, _email, _project_name;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_user_profile(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_create_user_profile(uuid, text) TO authenticated;