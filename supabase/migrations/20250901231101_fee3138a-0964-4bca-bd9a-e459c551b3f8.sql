-- Fix Carolyn's account setup status since she has already logged in
UPDATE doctors 
SET account_setup_completed = true 
WHERE email = 'carolynpk@gmail.com' AND first_login_at IS NOT NULL;