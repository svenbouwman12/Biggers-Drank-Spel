-- Fix RLS policies for rooms table
-- Run this in Supabase SQL Editor

-- Check current RLS status
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'rooms';

-- Temporarily disable RLS for testing
ALTER TABLE rooms DISABLE ROW LEVEL SECURITY;

-- Or create a permissive policy that allows all operations
-- (Alternative approach - keep RLS enabled but make it permissive)
-- DROP POLICY IF EXISTS "Allow all operations on rooms" ON rooms;
-- CREATE POLICY "Allow all operations on rooms" ON rooms
--     FOR ALL
--     USING (true)
--     WITH CHECK (true);

-- Check if RLS is disabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'rooms';
