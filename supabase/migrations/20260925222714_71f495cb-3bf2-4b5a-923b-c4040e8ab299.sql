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
        CROSS JOIN LATERAL jsonb_array_elements_text(
          CASE WHEN jsonb_typeof(r.preferred_weekends::jsonb) = 'array' THEN r.preferred_weekends::jsonb ELSE '[]'::jsonb END
        ) e(value)
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