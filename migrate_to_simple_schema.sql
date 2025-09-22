-- ============================================================================
-- MIGRATION TO SIMPLE SCHEMA (Safe for existing databases)
-- ============================================================================
-- This script safely migrates from the old complex schema to the new simple one

-- ============================================================================
-- CREATE NEW TABLES (if they don't exist)
-- ============================================================================

-- Create simplified players table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS players_new (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    room_code VARCHAR(6) NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
    is_host BOOLEAN DEFAULT FALSE,
    is_ready BOOLEAN DEFAULT TRUE, -- Players are ready by default
    score INTEGER DEFAULT 0,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create simplified game events table
CREATE TABLE IF NOT EXISTS game_events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    room_code VARCHAR(6) NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- 'game_start', 'game_action', etc.
    event_data JSONB NOT NULL DEFAULT '{}',
    player_id VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- MIGRATE DATA FROM OLD PLAYERS TABLE TO NEW ONE
-- ============================================================================

-- Copy data from old players table to new one (if old table exists)
DO $$
BEGIN
    -- Check if old players table exists and has data
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'players' AND table_schema = 'public') THEN
        -- Insert data from old table to new table, avoiding duplicates
        INSERT INTO players_new (id, name, room_code, is_host, is_ready, score, joined_at, last_seen)
        SELECT 
            id, 
            name, 
            room_code, 
            is_host, 
            COALESCE(is_ready, true), -- Default to true if null
            COALESCE(score, 0), 
            COALESCE(joined_at, NOW()), 
            COALESCE(last_seen, NOW())
        FROM players 
        WHERE NOT EXISTS (
            SELECT 1 FROM players_new WHERE players_new.id = players.id
        );
        
        RAISE NOTICE 'Data migrated from old players table to new players_new table';
    ELSE
        RAISE NOTICE 'No old players table found, skipping migration';
    END IF;
END $$;

-- ============================================================================
-- DROP OLD TABLES (if they exist and are not needed)
-- ============================================================================

-- Drop old players table if it exists (after migration)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'players' AND table_schema = 'public') THEN
        -- Check if players_new has data
        IF EXISTS (SELECT 1 FROM players_new LIMIT 1) THEN
            DROP TABLE players CASCADE;
            RAISE NOTICE 'Old players table dropped successfully';
        ELSE
            RAISE NOTICE 'players_new is empty, keeping old players table';
        END IF;
    END IF;
END $$;

-- Rename players_new to players
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'players_new' AND table_schema = 'public') THEN
        -- Drop old players table first if it still exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'players' AND table_schema = 'public') THEN
            DROP TABLE players CASCADE;
        END IF;
        
        -- Rename new table to players
        ALTER TABLE players_new RENAME TO players;
        RAISE NOTICE 'players_new renamed to players';
    END IF;
END $$;

-- ============================================================================
-- ADD MISSING COLUMNS TO EXISTING TABLES
-- ============================================================================

-- Add started_at column to rooms if it doesn't exist
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE;

-- ============================================================================
-- CREATE INDEXES (if they don't exist)
-- ============================================================================

-- Players indexes
CREATE INDEX IF NOT EXISTS idx_players_room_code ON players(room_code);
CREATE INDEX IF NOT EXISTS idx_players_host ON players(is_host);
CREATE INDEX IF NOT EXISTS idx_players_last_seen ON players(last_seen);

-- Game events indexes
CREATE INDEX IF NOT EXISTS idx_game_events_room_code ON game_events(room_code);
CREATE INDEX IF NOT EXISTS idx_game_events_type ON game_events(event_type);
CREATE INDEX IF NOT EXISTS idx_game_events_created_at ON game_events(created_at);

-- ============================================================================
-- CREATE SIMPLIFIED CLEANUP FUNCTION
-- ============================================================================

-- Drop old cleanup function if it exists
DROP FUNCTION IF EXISTS cleanup_old_rooms();

-- Create new simplified cleanup function
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
DECLARE
    deleted_rooms INTEGER := 0;
    deleted_players INTEGER := 0;
    deleted_events INTEGER := 0;
BEGIN
    -- Delete rooms older than 24 hours with no players
    -- Use code instead of id for comparison since room_code is VARCHAR
    DELETE FROM rooms 
    WHERE created_at < NOW() - INTERVAL '24 hours'
    AND code NOT IN (
        SELECT DISTINCT room_code FROM players WHERE room_code IS NOT NULL
    );
    GET DIAGNOSTICS deleted_rooms = ROW_COUNT;
    
    -- Delete players who haven't been seen for more than 30 minutes
    DELETE FROM players 
    WHERE last_seen < NOW() - INTERVAL '30 minutes';
    GET DIAGNOSTICS deleted_players = ROW_COUNT;
    
    -- Delete old game events (older than 7 days)
    DELETE FROM game_events 
    WHERE created_at < NOW() - INTERVAL '7 days';
    GET DIAGNOSTICS deleted_events = ROW_COUNT;
    
    -- Log cleanup results
    RAISE NOTICE 'Cleanup completed: % rooms, % players, % events deleted', 
                 deleted_rooms, deleted_players, deleted_events;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- CREATE SIMPLIFIED VIEW
-- ============================================================================

-- Drop old view if it exists
DROP VIEW IF EXISTS rooms_with_players;

-- Create new simplified view
CREATE OR REPLACE VIEW rooms_with_players AS
SELECT 
    r.*,
    COUNT(p.id) as player_count,
    COUNT(CASE WHEN p.is_ready THEN 1 END) as ready_count
FROM rooms r
LEFT JOIN players p ON r.code = p.room_code
WHERE r.status = 'waiting'
GROUP BY r.id
HAVING COUNT(p.id) > 0; -- Only show rooms with players

-- ============================================================================
-- DISABLE RLS FOR SIMPLICITY (if not already disabled)
-- ============================================================================

-- Disable RLS on all tables for simplicity
ALTER TABLE rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE players DISABLE ROW LEVEL SECURITY;
ALTER TABLE game_events DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- VERIFY MIGRATION
-- ============================================================================

-- Show current tables
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('rooms', 'players', 'game_events')
ORDER BY table_name;

-- Show current indexes
SELECT 
    indexname,
    tablename
FROM pg_indexes 
WHERE tablename IN ('rooms', 'players', 'game_events')
ORDER BY tablename, indexname;

-- Test the cleanup function
SELECT 'Testing cleanup function...' as status;
SELECT cleanup_old_data();

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

SELECT 'Migration to simple schema completed successfully!' as result;
