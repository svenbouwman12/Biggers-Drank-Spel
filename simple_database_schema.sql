-- ============================================================================
-- SIMPLE DATABASE SCHEMA VOOR DRANKSPEL PARTY (OPTIMIZED VERSION)
-- ============================================================================
-- This is a simplified, reliable version without RLS complications

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- SIMPLIFIED ROOMS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS rooms (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    code VARCHAR(6) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    game_type VARCHAR(20) NOT NULL CHECK (game_type IN ('paardenrace', 'mexico', 'bussen')),
    max_players INTEGER NOT NULL CHECK (max_players >= 2 AND max_players <= 8),
    host_id VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================================
-- SIMPLIFIED PLAYERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS players (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    room_code VARCHAR(6) NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
    is_host BOOLEAN DEFAULT FALSE,
    is_ready BOOLEAN DEFAULT TRUE, -- Players are ready by default
    score INTEGER DEFAULT 0,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- GAME EVENTS TABLE (Simplified)
-- ============================================================================

CREATE TABLE IF NOT EXISTS game_events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    room_code VARCHAR(6) NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- 'game_start', 'game_action', etc.
    event_data JSONB NOT NULL DEFAULT '{}',
    player_id VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Rooms indexes
CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(code);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_rooms_created_at ON rooms(created_at);

-- Players indexes
CREATE INDEX IF NOT EXISTS idx_players_room_code ON players(room_code);
CREATE INDEX IF NOT EXISTS idx_players_host ON players(is_host);
CREATE INDEX IF NOT EXISTS idx_players_last_seen ON players(last_seen);

-- Game events indexes
CREATE INDEX IF NOT EXISTS idx_game_events_room_code ON game_events(room_code);
CREATE INDEX IF NOT EXISTS idx_game_events_type ON game_events(event_type);
CREATE INDEX IF NOT EXISTS idx_game_events_created_at ON game_events(created_at);

-- ============================================================================
-- SIMPLE FUNCTIONS
-- ============================================================================

-- Function to update updated_at automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for automatic updated_at
CREATE TRIGGER update_rooms_updated_at 
    BEFORE UPDATE ON rooms 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- DISABLE RLS FOR SIMPLICITY (Development/Testing only)
-- ============================================================================
-- For production, you might want to enable RLS with proper policies

-- Disable RLS on all tables for simplicity
ALTER TABLE rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE players DISABLE ROW LEVEL SECURITY;
ALTER TABLE game_events DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CLEANUP FUNCTIONS
-- ============================================================================

-- Function to clean up old data
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
    -- Delete rooms older than 24 hours with no players
    DELETE FROM rooms 
    WHERE created_at < NOW() - INTERVAL '24 hours'
    AND id NOT IN (
        SELECT DISTINCT room_code FROM players WHERE room_code IS NOT NULL
    );
    
    -- Delete players who haven't been seen for more than 30 minutes
    DELETE FROM players 
    WHERE last_seen < NOW() - INTERVAL '30 minutes';
    
    -- Delete old game events (older than 7 days)
    DELETE FROM game_events 
    WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VIEWS FOR EASY QUERIES
-- ============================================================================

-- View for rooms with player count
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
-- SAMPLE DATA FOR TESTING (Optional)
-- ============================================================================

-- Uncomment to add sample data for testing
/*
INSERT INTO rooms (code, name, game_type, max_players, host_id) VALUES
('TEST01', 'Test Lobby', 'paardenrace', 4, 'test_host_1');

INSERT INTO players (id, name, room_code, is_host, is_ready) VALUES
('test_host_1', 'Host Player', 'TEST01', true, true),
('test_player_1', 'Player One', 'TEST01', false, true);
*/

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE rooms IS 'Game lobby information - simplified version';
COMMENT ON TABLE players IS 'Player information and room membership - simplified version';
COMMENT ON TABLE game_events IS 'Game events for multiplayer synchronization - simplified version';

COMMENT ON COLUMN rooms.code IS 'Unique 6-character room code for joining';
COMMENT ON COLUMN rooms.status IS 'Current room status: waiting, playing, finished';
COMMENT ON COLUMN players.is_host IS 'Whether this player is the room host';
COMMENT ON COLUMN players.is_ready IS 'Whether this player is ready (default true)';
COMMENT ON COLUMN game_events.event_type IS 'Type of game event: game_start, game_action, etc.';

-- ============================================================================
-- END OF SIMPLIFIED SCHEMA
-- ============================================================================
