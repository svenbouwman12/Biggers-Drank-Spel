-- ============================================================================
-- ADD PLAYER STATUS COLUMN FOR EXPLICIT LEAVE TRACKING
-- ============================================================================
-- Run this script in your Supabase SQL editor to add player status tracking

-- Add status column to players table
ALTER TABLE players ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'left'));

-- Add index for status column for faster queries
CREATE INDEX IF NOT EXISTS idx_players_status ON players(status);

-- Add composite index for room_code and status
CREATE INDEX IF NOT EXISTS idx_players_room_status ON players(room_code, status);

-- Update existing players to active status
UPDATE players SET status = 'active' WHERE status IS NULL;

-- ============================================================================
-- VERIFY THE CHANGES
-- ============================================================================

-- Check if column was added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'players' AND column_name = 'status';

-- Check if indexes were created
SELECT indexname, tablename, indexdef 
FROM pg_indexes 
WHERE tablename = 'players' 
AND (indexname LIKE '%status%' OR indexname LIKE '%room_status%')
ORDER BY indexname;

-- ============================================================================
-- TEST QUERY
-- ============================================================================

-- Test query to find rooms with only inactive players
SELECT 
    r.code,
    r.name,
    COUNT(p.id) as total_players,
    COUNT(CASE WHEN p.status = 'active' THEN 1 END) as active_players,
    COUNT(CASE WHEN p.status = 'inactive' THEN 1 END) as inactive_players
FROM rooms r
LEFT JOIN players p ON r.code = p.room_code
WHERE r.status = 'waiting'
GROUP BY r.code, r.name
HAVING COUNT(CASE WHEN p.status = 'active' THEN 1 END) = 0
ORDER BY r.created_at;
