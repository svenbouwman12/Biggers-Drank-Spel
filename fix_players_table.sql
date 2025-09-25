-- Fix players table to accept room codes instead of UUIDs
-- Run this in Supabase SQL Editor

-- First, let's check what's in the tables
-- SELECT * FROM rooms LIMIT 5;
-- SELECT * FROM players LIMIT 5;

-- Drop the foreign key constraint temporarily
ALTER TABLE players DROP CONSTRAINT IF EXISTS players_room_id_fkey;

-- Change room_id to VARCHAR to accept room codes
ALTER TABLE players ALTER COLUMN room_id TYPE VARCHAR(10);

-- Add a new foreign key constraint that references rooms.code instead of rooms.id
-- First create a unique constraint on rooms.code if it doesn't exist
ALTER TABLE rooms ADD CONSTRAINT rooms_code_unique UNIQUE (code);

-- Now add the foreign key constraint
ALTER TABLE players ADD CONSTRAINT players_room_code_fkey 
FOREIGN KEY (room_id) REFERENCES rooms(code) ON DELETE CASCADE;
