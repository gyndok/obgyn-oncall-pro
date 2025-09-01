-- Clear existing doctors and insert the correct ones
DELETE FROM public.doctors;

-- Insert the correct doctor list
INSERT INTO public.doctors (name, email, mobile) VALUES
('Lilliam Clinger', 'lilliam.aguilar@gmail.com', '+1 (713) 480-3432'),
('Carolyn Kenney', 'carolynpk@gmail.com', '+1 (214) 460-5205'),
('Joy LeBlanc', 'Joyleblanc@yahoo.com', '+1 (713) 825-8321'),
('Emily LaBerge', 'Emily.m.laberge@gmail.com', '+1 (281) 615-1870'),
('Keisha Demerson', 'Lakeisha.demerson@gmail.com', '+1 (404) 217-8853'),
('Raphny Johnson', 'Faithmd2012@gmail.com', '+1 (832) 805-4065'),
('Geff Klein', 'gyndok@yahoo.com', '+1 (832) 594-3745');