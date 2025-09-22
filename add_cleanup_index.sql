-- ============================================================================
-- ADD CLEANUP INDEX FOR AGGRESSIVE CLEANUP PERFORMANCE
-- ============================================================================
-- Run this script in your Supabase SQL editor to add the missing index

-- Add index for last_seen column to improve cleanup performance
CREATE INDEX IF NOT EXISTS idx_players_last_seen ON players(last_seen);

-- Verify the index was created
SELECT 
    indexname, 
    tablename, 
    indexdef 
FROM pg_indexes 
WHERE indexname = 'idx_players_last_seen';

-- ============================================================================
-- OPTIONAL: Add more aggressive cleanup indexes
-- ============================================================================

-- Index for faster room status queries
CREATE INDEX IF NOT EXISTS idx_rooms_status_created ON rooms(status, created_at);

-- Index for faster player count queries
CREATE INDEX IF NOT EXISTS idx_players_room_code_active ON players(room_code, last_seen);

-- ============================================================================
-- VERIFY ALL INDEXES
-- ============================================================================

-- Show all indexes related to cleanup
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename IN ('rooms', 'players')
AND indexname LIKE '%last_seen%' 
OR indexname LIKE '%status%'
OR indexname LIKE '%created%'
ORDER BY tablename, indexname;
