-- Fix players table to accept room codes instead of UUIDs
-- This script handles the views that depend on the room_id column

-- Step 1: Drop the views that depend on room_id
DROP VIEW IF EXISTS active_rooms CASCADE;
DROP VIEW IF EXISTS player_stats CASCADE;
DROP VIEW IF EXISTS game_type_stats CASCADE;

-- Step 2: Drop the foreign key constraint
ALTER TABLE players DROP CONSTRAINT IF EXISTS players_room_id_fkey;

-- Step 3: Change room_id to VARCHAR to accept room codes
ALTER TABLE players ALTER COLUMN room_id TYPE VARCHAR(10);

-- Step 4: Add a unique constraint on rooms.code if it doesn't exist
ALTER TABLE rooms ADD CONSTRAINT IF NOT EXISTS rooms_code_unique UNIQUE (code);

-- Step 5: Add the new foreign key constraint that references rooms.code
ALTER TABLE players ADD CONSTRAINT players_room_code_fkey 
FOREIGN KEY (room_id) REFERENCES rooms(code) ON DELETE CASCADE;

-- Step 6: Recreate the views with updated JOIN logic
-- View for active rooms with player count
CREATE OR REPLACE VIEW active_rooms AS
SELECT 
    r.*,
    COUNT(p.id) as player_count,
    MAX(p.score) as highest_score,
    MIN(p.joined_at) as first_player_joined
FROM rooms r
LEFT JOIN players p ON r.code = p.room_id  -- Changed from r.id = p.room_id
WHERE r.status IN ('lobby', 'playing')
GROUP BY r.id;

-- View for player statistics
CREATE OR REPLACE VIEW player_stats AS
SELECT 
    p.player_name,
    p.avatar,
    COUNT(DISTINCT r.id) as games_played,
    AVG(p.score) as average_score,
    MAX(p.score) as best_score,
    COUNT(*) as total_games
FROM players p
JOIN rooms r ON r.code = p.room_id  -- Changed from r.id = p.room_id
WHERE p.left_at IS NULL
GROUP BY p.player_name, p.avatar;

-- View for game type popularity
CREATE OR REPLACE VIEW game_type_stats AS
SELECT 
    r.game_type,
    COUNT(*) as games_played,
    AVG(r.current_players) as average_players,
    AVG(EXTRACT(EPOCH FROM (r.finished_at - r.started_at))/60) as average_duration_minutes
FROM rooms r
WHERE r.finished_at IS NOT NULL
GROUP BY r.game_type;
