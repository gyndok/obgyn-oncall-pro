-- Fix the security issue in doctors table RLS policy
-- Drop the existing problematic policy
DROP POLICY IF EXISTS "Doctors can view their own record" ON public.doctors;

-- Create a corrected policy that properly matches authenticated users to their doctor records
CREATE POLICY "Doctors can view their own record" 
ON public.doctors 
FOR SELECT 
USING (
  -- Allow doctors to see their own record by matching email addresses
  (auth.email() = email) OR 
  -- Allow admin access
  (auth.email() = 'gyndok@yahoo.com'::text)
);

-- Also add a policy to allow doctors to update their own records (for future use)
CREATE POLICY "Doctors can update their own record" 
ON public.doctors 
FOR UPDATE 
USING (
  -- Allow doctors to update their own record by matching email addresses
  (auth.email() = email) OR 
  -- Allow admin access
  (auth.email() = 'gyndok@yahoo.com'::text)
);