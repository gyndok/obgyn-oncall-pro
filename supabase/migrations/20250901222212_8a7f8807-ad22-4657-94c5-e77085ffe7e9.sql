-- Fix RLS policies for doctor_requests table to properly match authenticated users
-- with their doctor records through the auth_user_id field

-- Drop existing policies
DROP POLICY IF EXISTS "Doctors can modify their own requests" ON doctor_requests;
DROP POLICY IF EXISTS "Doctors can update their own requests or admin can update all" ON doctor_requests;
DROP POLICY IF EXISTS "Doctors can view their own requests or admin can view all" ON doctor_requests;

-- Create new policies that properly join with doctors table
CREATE POLICY "Doctors can insert their own requests" 
ON doctor_requests 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM doctors 
    WHERE doctors.id = doctor_id 
    AND doctors.auth_user_id = auth.uid()
  ) OR auth.email() = 'gyndok@yahoo.com'
);

CREATE POLICY "Doctors can update their own requests or admin can update all" 
ON doctor_requests 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM doctors 
    WHERE doctors.id = doctor_id 
    AND doctors.auth_user_id = auth.uid()
  ) OR auth.email() = 'gyndok@yahoo.com'
);

CREATE POLICY "Doctors can view their own requests or admin can view all" 
ON doctor_requests 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM doctors 
    WHERE doctors.id = doctor_id 
    AND doctors.auth_user_id = auth.uid()
  ) OR auth.email() = 'gyndok@yahoo.com'
);