-- Seed the 7 doctors from the OBGYN Call Scheduler PRD
INSERT INTO public.doctors (name, email, mobile, active) VALUES
('Dr. Klein', 'klein@obgyn-clinic.com', NULL, true),
('Dr. LeBlanc', 'leblanc@obgyn-clinic.com', NULL, true),
('Dr. Johnson', 'johnson@obgyn-clinic.com', NULL, true),
('Dr. Kenney', 'kenney@obgyn-clinic.com', NULL, true),
('Dr. LaBerge', 'laberge@obgyn-clinic.com', NULL, true),
('Dr. Clinger', 'clinger@obgyn-clinic.com', NULL, true),
('Dr. Demerson', 'demerson@obgyn-clinic.com', NULL, true)
ON CONFLICT (email) DO NOTHING;