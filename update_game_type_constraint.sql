-- Update database constraint to allow 'balletjeBalletje' game type
-- Run this in Supabase SQL Editor

-- Drop the existing constraint
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_game_type_check;

-- Add the updated constraint with balletjeBalletje
ALTER TABLE rooms ADD CONSTRAINT rooms_game_type_check 
CHECK (game_type IN ('mixed', 'mostLikelyTo', 'truthOrDrink', 'speedTap', 'quiz', 'simpleTest', 'balletjeBalletje'));

-- Update default value to balletjeBalletje
ALTER TABLE rooms ALTER COLUMN game_type SET DEFAULT 'balletjeBalletje';

-- Check the constraint
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'rooms'::regclass 
AND conname = 'rooms_game_type_check';
