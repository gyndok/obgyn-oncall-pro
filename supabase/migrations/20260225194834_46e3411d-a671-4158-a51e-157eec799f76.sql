-- Delete Clinger's request for the current block
DELETE FROM public.doctor_requests WHERE id = 'db475a52-f8c7-4817-9826-e1af87794467';

-- Update Klein's preferred_weekends: remove week 7 ([3,5,7] -> [3,5])
UPDATE public.doctor_requests 
SET preferred_weekends = '[3, 5]'::json
WHERE id = '9db0ed37-f108-420b-b259-8af97d761918';

-- Update Johnson's preferred_weekends: remove week 7 ([7,4] -> [4])
UPDATE public.doctor_requests 
SET preferred_weekends = '[4]'::json
WHERE id = 'bfca3ade-2e47-4087-b23a-d3dbb0afaa12';

-- Also remove any unavailable dates in week 7 (May 11-17) from LaBerge's request
-- LaBerge has dates 2026-05-01 through 2026-05-17 marked unavailable
-- Dates in week 7 (May 11-17) should be removed since the block will only be 6 weeks
-- New unavailable_dates: keep only those before May 11
UPDATE public.doctor_requests
SET unavailable_dates = '[
  "2026-05-01", "2026-05-02", "2026-05-03", "2026-05-04", "2026-05-05",
  "2026-05-06", "2026-05-07", "2026-05-08", "2026-05-09", "2026-05-10"
]'::json
WHERE id = '288cc157-7c2b-4603-9088-7a35cab2ae92';

-- Also update LeBlanc - she has 2026-05-17 which is in week 7
-- Remove dates >= 2026-05-11
UPDATE public.doctor_requests
SET unavailable_dates = '[
  "2026-05-09", "2026-05-10", "2026-05-08",
  "2026-03-31", "2026-04-07", "2026-04-14", "2026-04-21", "2026-04-28",
  "2026-05-05", "2026-04-01"
]'::json
WHERE id = '0c7e2082-b95c-498b-bfa3-7b8340bede9b';

-- Shrink the block from 7 weeks to 6 weeks (end May 10 instead of May 17)
UPDATE public.blocks 
SET end_sunday_date = '2026-05-10'
WHERE id = '45f3513f-6fd1-4b74-8005-7b1e82aab17e';