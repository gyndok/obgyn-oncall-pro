-- Fix the security issue by setting search_path on the trigger function
CREATE OR REPLACE FUNCTION lowercase_email_trigger()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.email = LOWER(NEW.email);
  RETURN NEW;
END;
$$;