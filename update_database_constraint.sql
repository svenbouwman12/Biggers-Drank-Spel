-- Update database constraint to allow 'simpleTest' game type
-- Run this in Supabase SQL Editor

-- Drop the existing constraint
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_game_type_check;

-- Add the updated constraint
ALTER TABLE rooms ADD CONSTRAINT rooms_game_type_check 
CHECK (game_type IN ('mixed', 'mostLikelyTo', 'truthOrDrink', 'speedTap', 'quiz', 'simpleTest'));

-- Update default value
ALTER TABLE rooms ALTER COLUMN game_type SET DEFAULT 'simpleTest';
