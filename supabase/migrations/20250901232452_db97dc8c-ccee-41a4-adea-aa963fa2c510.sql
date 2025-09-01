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
$function$

-- Also create a trigger to automatically lowercase emails on insert/update for doctors table
CREATE OR REPLACE FUNCTION lowercase_email_trigger()
RETURNS TRIGGER AS $$
BEGIN
  NEW.email = LOWER(NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for doctors table
CREATE TRIGGER ensure_lowercase_email
  BEFORE INSERT OR UPDATE ON doctors
  FOR EACH ROW
  EXECUTE FUNCTION lowercase_email_trigger();