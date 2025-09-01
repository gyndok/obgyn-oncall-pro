-- Fix the function to have proper search_path security
CREATE OR REPLACE FUNCTION public.can_access_doctor_record(doctor_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Only allow access if:
  -- 1. The authenticated user's email matches the doctor's email exactly
  -- 2. OR the user is the specific admin
  RETURN (
    auth.email() = doctor_email AND auth.email() IS NOT NULL
  ) OR (
    auth.email() = 'gyndok@yahoo.com'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;