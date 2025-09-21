-- Add started_at column to existing rooms table
-- Run this in Supabase SQL Editor if you already have the database set up

ALTER TABLE rooms ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE;
