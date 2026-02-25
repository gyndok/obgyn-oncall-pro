
-- =============================================
-- 1. RESTORE current block (45f3...) to original 7-week state
-- =============================================

-- Restore block end date back to May 17
UPDATE public.blocks 
SET end_sunday_date = '2026-05-17'
WHERE id = '45f3513f-6fd1-4b74-8005-7b1e82aab17e';

-- Restore Klein's preferred_weekends on current block (was [3,5,7], wrongly changed to [3,5])
UPDATE public.doctor_requests 
SET preferred_weekends = '[3, 5, 7]'::json
WHERE id = '9db0ed37-f108-420b-b259-8af97d761918';

-- Restore Johnson's preferred_weekends on current block (was [7,4], wrongly changed to [4])
UPDATE public.doctor_requests 
SET preferred_weekends = '[7, 4]'::json
WHERE id = 'bfca3ade-2e47-4087-b23a-d3dbb0afaa12';

-- Restore LaBerge's unavailable_dates on current block (add back May 11-17)
UPDATE public.doctor_requests
SET unavailable_dates = '[
  "2026-05-01", "2026-05-02", "2026-05-03", "2026-05-04", "2026-05-05",
  "2026-05-06", "2026-05-07", "2026-05-08", "2026-05-09", "2026-05-10",
  "2026-05-11", "2026-05-12", "2026-05-13", "2026-05-14", "2026-05-15",
  "2026-05-16", "2026-05-17"
]'::json
WHERE id = '288cc157-7c2b-4603-9088-7a35cab2ae92';

-- Restore LeBlanc's unavailable_dates on current block (add back May 17)
UPDATE public.doctor_requests
SET unavailable_dates = '[
  "2026-05-09", "2026-05-10", "2026-05-08",
  "2026-03-31", "2026-04-07", "2026-04-14", "2026-04-21", "2026-04-28",
  "2026-05-05", "2026-04-01", "2026-05-17"
]'::json
WHERE id = '0c7e2082-b95c-498b-bfa3-7b8340bede9b';

-- =============================================
-- 2. FIX next block (3b55...) - shrink to 6 weeks
-- =============================================

-- Change end date from Jul 5 to Jun 28
UPDATE public.blocks 
SET end_sunday_date = '2026-06-28'
WHERE id = '3b55375a-28d5-4ef1-88cc-8b752df15b29';

-- Delete Clinger's request from next block
DELETE FROM public.doctor_requests 
WHERE id = 'a9ea8b44-0615-4e09-bbed-0affc994d065';

-- LaBerge next block: remove dates after Jun 28 (Jul 2-5), keep only May 18
UPDATE public.doctor_requests
SET unavailable_dates = '["2026-05-18"]'::json,
    preferred_weekends = '[1, 2, 3, 4, 5]'::json
WHERE id = 'd3c0db19-0a1e-49d0-a4a3-8b9ed5b73080';

-- Klein next block: remove dates after Jun 28 (Jul 3-5)
UPDATE public.doctor_requests
SET unavailable_dates = '[
  "2026-06-02", "2026-06-03", "2026-06-04", "2026-06-05", "2026-06-06", "2026-06-07",
  "2026-05-30", "2026-05-31", "2026-06-01"
]'::json
WHERE id = '3d3441c7-7ec6-4375-be3f-b9574f788f5e';

-- LeBlanc next block: remove dates after Jun 28 (Jun 29-Jul 5)
UPDATE public.doctor_requests
SET unavailable_dates = '[
  "2026-05-28", "2026-05-29", "2026-05-30", "2026-05-31", "2026-06-01",
  "2026-06-27", "2026-06-28", "2026-05-26", "2026-05-19",
  "2026-06-02", "2026-06-09", "2026-06-16", "2026-06-23"
]'::json
WHERE id = 'e2f9fb40-b5cb-435f-bd77-6213ad8b9166';
