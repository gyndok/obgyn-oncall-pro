-- Update the can_access_doctor_record function to be case insensitive
CREATE OR REPLACE FUNCTION public.can_access_doctor_record(doctor_email text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only allow access if:
  -- 1. The authenticated user's email matches the doctor's email exactly (case insensitive)
  -- 2. OR the user is the specific admin
  RETURN (
    LOWER(auth.email()) = LOWER(doctor_email) AND auth.email() IS NOT NULL
  ) OR (
    LOWER(auth.email()) = 'gyndok@yahoo.com'
  );
END;
$function$;