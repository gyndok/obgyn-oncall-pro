-- Task 4: unique assignment per day + atomic replace
DELETE FROM public.assignments a
USING public.assignments b
WHERE a.block_id = b.block_id AND a.date = b.date
  AND (a.created_at < b.created_at OR (a.created_at = b.created_at AND a.id < b.id));

CREATE UNIQUE INDEX IF NOT EXISTS assignments_block_date_unique ON public.assignments (block_id, date);

CREATE OR REPLACE FUNCTION public.replace_block_assignments(p_block_id uuid, p_rows jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted integer;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can replace assignments';
  END IF;

  DELETE FROM public.assignments WHERE block_id = p_block_id;

  INSERT INTO public.assignments (block_id, week_index, date, weekday_name, is_weekend, doctor_id)
  SELECT p_block_id,
         (r->>'week_index')::int,
         (r->>'date')::date,
         r->>'weekday_name',
         COALESCE((r->>'is_weekend')::boolean, false),
         (r->>'doctor_id')::uuid
  FROM jsonb_array_elements(p_rows) r;

  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$;
REVOKE ALL ON FUNCTION public.replace_block_assignments(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.replace_block_assignments(uuid, jsonb) TO authenticated;

-- Task 5: move Google tokens to a service-role-only table
CREATE TABLE public.google_credentials (
  doctor_id uuid PRIMARY KEY REFERENCES public.doctors(id) ON DELETE CASCADE,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.google_credentials FROM anon, authenticated;
GRANT ALL ON public.google_credentials TO service_role;
ALTER TABLE public.google_credentials ENABLE ROW LEVEL SECURITY;

INSERT INTO public.google_credentials (doctor_id, access_token, refresh_token, expires_at)
SELECT id, google_access_token, google_refresh_token, google_token_expires_at
FROM public.doctors
WHERE google_access_token IS NOT NULL OR google_refresh_token IS NOT NULL;

ALTER TABLE public.doctors
  DROP COLUMN google_access_token,
  DROP COLUMN google_refresh_token,
  DROP COLUMN google_token_expires_at;

-- Only admins can update doctor rows
DROP POLICY IF EXISTS "Doctors can only update their own record" ON public.doctors;
CREATE POLICY "Only admin can update doctors" ON public.doctors
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

-- Self-linking of a doctor's account after sign-in
CREATE OR REPLACE FUNCTION public.link_my_doctor_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  UPDATE public.doctors
  SET auth_user_id = auth.uid(),
      first_login_at = COALESCE(first_login_at, now()),
      account_setup_completed = true
  WHERE lower(email) = lower(auth.email())
    AND auth_user_id IS NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.link_my_doctor_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_my_doctor_account() TO authenticated;