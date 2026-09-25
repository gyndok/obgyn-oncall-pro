CREATE TABLE public.group_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_by uuid,
  subject text NOT NULL,
  recipient_count integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.group_email_log TO authenticated;
GRANT ALL ON public.group_email_log TO service_role;
ALTER TABLE public.group_email_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view group email log" ON public.group_email_log FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.get_block_request_summary(p_block_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE body text;
BEGIN
  RETURN NULL;
END $fn$;