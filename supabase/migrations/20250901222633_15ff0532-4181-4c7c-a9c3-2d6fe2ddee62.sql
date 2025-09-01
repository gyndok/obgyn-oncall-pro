-- Add field to track if doctor has completed account setup
ALTER TABLE doctors ADD COLUMN account_setup_completed boolean DEFAULT false;

-- Update existing doctors who have logged in to mark their accounts as set up
UPDATE doctors 
SET account_setup_completed = true 
WHERE first_login_at IS NOT NULL;