DROP POLICY IF EXISTS "Doctors can insert their own requests" ON public.doctor_requests;
DROP POLICY IF EXISTS "Doctors can update their own requests or admin can update all" ON public.doctor_requests;

CREATE POLICY "Doctors can insert their own requests" ON public.doctor_requests
FOR INSERT TO authenticated
WITH CHECK (
  private.has_role(auth.uid(), 'admin'::app_role)
  OR (
    EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = doctor_requests.doctor_id AND d.auth_user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.blocks b WHERE b.id = doctor_requests.block_id AND b.status = 'collecting' AND (b.deadline IS NULL OR now() < b.deadline))
  )
);

CREATE POLICY "Doctors can update their own requests or admin can update all" ON public.doctor_requests
FOR UPDATE TO authenticated
USING (
  private.has_role(auth.uid(), 'admin'::app_role)
  OR (
    EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = doctor_requests.doctor_id AND d.auth_user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.blocks b WHERE b.id = doctor_requests.block_id AND b.status = 'collecting' AND (b.deadline IS NULL OR now() < b.deadline))
  )
)
WITH CHECK (
  private.has_role(auth.uid(), 'admin'::app_role)
  OR (
    EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = doctor_requests.doctor_id AND d.auth_user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.blocks b WHERE b.id = doctor_requests.block_id AND b.status = 'collecting' AND (b.deadline IS NULL OR now() < b.deadline))
  )
);

CREATE OR REPLACE FUNCTION public.get_block_request_summary(p_block_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT (private.has_role(auth.uid(), 'admin'::app_role)
          OR EXISTS (SELECT 1 FROM public.doctors WHERE auth_user_id = auth.uid() AND active)) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT jsonb_build_object(
    'total_doctors', (SELECT count(*) FROM public.doctors WHERE active),
    'submitted', (SELECT count(*) FROM public.doctor_requests r JOIN public.doctors d ON d.id = r.doctor_id AND d.active
                  WHERE r.block_id = p_block_id AND r.status = 'submitted'),
    'in_progress', (SELECT count(*) FROM public.doctor_requests r JOIN public.doctors d ON d.id = r.doctor_id AND d.active
                    WHERE r.block_id = p_block_id AND r.status = 'in_progress'),
    'weekend_counts', COALESCE((
      SELECT jsonb_object_agg(w, c) FROM (
        SELECT (e.value)::text AS w, count(*) AS c
        FROM public.doctor_requests r
        JOIN public.doctors d ON d.id = r.doctor_id AND d.active
        CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.preferred_weekends::jsonb, '[]'::jsonb)) e(value)
        WHERE r.block_id = p_block_id AND r.status = 'submitted'
          AND (d.auth_user_id IS DISTINCT FROM auth.uid())
        GROUP BY 1
      ) s
    ), '{}'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_block_request_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_block_request_summary(uuid) TO authenticated;