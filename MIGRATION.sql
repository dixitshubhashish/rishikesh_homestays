-- Add missing columns to enquiries table
-- Run this in Supabase SQL Editor: https://app.supabase.com/project/[project-id]/sql/new

ALTER TABLE enquiries ADD COLUMN IF NOT EXISTS area TEXT;
ALTER TABLE enquiries ADD COLUMN IF NOT EXISTS coming_from_city TEXT;
ALTER TABLE enquiries ADD COLUMN IF NOT EXISTS pets TEXT;
ALTER TABLE enquiries ADD COLUMN IF NOT EXISTS pet_count INTEGER DEFAULT 0;

-- Verify columns were added
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'enquiries' 
AND column_name IN ('area', 'coming_from_city', 'pets', 'pet_count')
ORDER BY ordinal_position;
