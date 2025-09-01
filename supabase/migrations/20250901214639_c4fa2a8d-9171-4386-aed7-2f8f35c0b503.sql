-- Add column to track if doctor has logged in
ALTER TABLE public.doctors 
ADD COLUMN first_login_at TIMESTAMP WITH TIME ZONE NULL;

-- Add column to store the auth user ID when they sign up
ALTER TABLE public.doctors 
ADD COLUMN auth_user_id UUID NULL;