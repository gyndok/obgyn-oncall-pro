-- Fix Emily's email case to match auth system
UPDATE doctors 
SET email = 'emily.m.laberge@gmail.com' 
WHERE email = 'Emily.m.laberge@gmail.com';