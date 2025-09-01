-- Drop existing policies to replace with more secure ones
DROP POLICY IF EXISTS "Doctors can view their own record" ON public.doctors;
DROP POLICY IF EXISTS "Doctors can update their own record" ON public.doctors;

-- Create a security definer function to check if user can access doctor record
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
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create more secure RLS policies using the function
CREATE POLICY "Doctors can only view their own record"
ON public.doctors
FOR SELECT
USING (
  public.can_access_doctor_record(email)
);

CREATE POLICY "Doctors can only update their own record"
ON public.doctors
FOR UPDATE
USING (
  public.can_access_doctor_record(email)
);

-- Ensure no INSERT or DELETE access for regular users
CREATE POLICY "Only admin can insert doctors"
ON public.doctors
FOR INSERT
WITH CHECK (auth.email() = 'gyndok@yahoo.com');

CREATE POLICY "Only admin can delete doctors"
ON public.doctors
FOR DELETE
USING (auth.email() = 'gyndok@yahoo.com');