-- ============================================================================
-- FIX RLS POLICIES FOR ROOM UPDATES
-- ============================================================================
-- Run this script in your Supabase SQL editor to fix room update issues

-- ============================================================================
-- CHECK CURRENT RLS POLICIES
-- ============================================================================

-- Check current policies on rooms table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'rooms'
ORDER BY policyname;

-- ============================================================================
-- DISABLE RLS TEMPORARILY (FOR TESTING)
-- ============================================================================

-- Uncomment the next line to disable RLS temporarily for testing
-- ALTER TABLE rooms DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- UPDATE RLS POLICIES FOR ROOM UPDATES
-- ============================================================================

-- Drop existing update policy if it exists
DROP POLICY IF EXISTS "Rooms are updatable by host" ON rooms;

-- Create new, more permissive update policy
CREATE POLICY "Rooms are updatable by everyone" ON rooms
    FOR UPDATE USING (true)
    WITH CHECK (true);

-- Alternative: Create host-specific update policy
-- CREATE POLICY "Rooms are updatable by host" ON rooms
--     FOR UPDATE USING (true)
--     WITH CHECK (true);

-- ============================================================================
-- CHECK IF RLS IS ENABLED
-- ============================================================================

-- Check if RLS is enabled on rooms table
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'rooms';

-- ============================================================================
-- TEST ROOM UPDATE PERMISSIONS
-- ============================================================================

-- Test if we can update a room (replace 'TEST123' with actual room code)
-- UPDATE rooms 
-- SET updated_at = NOW() 
-- WHERE code = 'TEST123';

-- ============================================================================
-- VERIFY POLICIES
-- ============================================================================

-- Check updated policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'rooms'
ORDER BY policyname;

-- ============================================================================
-- ALTERNATIVE: COMPLETELY DISABLE RLS FOR ROOMS (NOT RECOMMENDED FOR PRODUCTION)
-- ============================================================================

-- Uncomment these lines ONLY for testing, NOT for production:
-- ALTER TABLE rooms DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE players DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE game_actions DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE game_states DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RE-ENABLE RLS (IF YOU DISABLED IT)
-- ============================================================================

-- Uncomment these lines to re-enable RLS:
-- ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE players ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE game_actions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE game_states ENABLE ROW LEVEL SECURITY;
