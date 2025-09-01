-- Add admin column to doctors table
ALTER TABLE public.doctors 
ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT false;

-- Create index for better performance when querying admin users
CREATE INDEX idx_doctors_admin ON public.doctors(is_admin) WHERE is_admin = true;