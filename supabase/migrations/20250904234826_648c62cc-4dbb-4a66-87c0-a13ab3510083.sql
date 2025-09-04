-- Add missing columns to blocks table for calendar publishing
ALTER TABLE public.blocks 
ADD COLUMN published_at timestamp with time zone,
ADD COLUMN calendar_events jsonb;