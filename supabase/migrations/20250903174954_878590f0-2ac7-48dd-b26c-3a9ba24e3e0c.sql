-- Update the RLS policy to allow all doctors to view submitted requests from other doctors
-- This will enable them to see "Already requested by:" information for weekend preferences

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Doctors can view their own requests or admin can view all" ON doctor_requests;

-- Create a new policy that allows:
-- 1. Doctors to view their own requests (any status)
-- 2. Doctors to view other doctors' SUBMITTED requests only
-- 3. Admin can view all requests
CREATE POLICY "Doctors can view own requests and others' submitted requests" 
ON doctor_requests 
FOR SELECT 
USING (
  -- Can view own requests (any status)
  (EXISTS (
    SELECT 1 
    FROM doctors 
    WHERE doctors.id = doctor_requests.doctor_id 
    AND doctors.auth_user_id = auth.uid()
  )) 
  OR 
  -- Can view other doctors' submitted requests only
  (
    doctor_requests.status = 'submitted' 
    AND auth.uid() IS NOT NULL
    AND EXISTS (SELECT 1 FROM doctors WHERE doctors.auth_user_id = auth.uid())
  )
  OR 
  -- Admin can view all
  (auth.email() = 'gyndok@yahoo.com')
);