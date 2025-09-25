-- Update views to work with the current database structure
-- The server code already uses UUID relationships correctly

-- Drop and recreate views with correct JOIN logic
DROP VIEW IF EXISTS active_rooms CASCADE;
DROP VIEW IF EXISTS player_stats CASCADE;
DROP VIEW IF EXISTS game_type_stats CASCADE;

-- View for active rooms with player count (using UUID relationships)
CREATE OR REPLACE VIEW active_rooms AS
SELECT 
    r.*,
    COUNT(p.id) as player_count,
    MAX(p.score) as highest_score,
    MIN(p.joined_at) as first_player_joined
FROM rooms r
LEFT JOIN players p ON r.id = p.room_id  -- This should work now with UUID
WHERE r.status IN ('lobby', 'playing')
GROUP BY r.id;

-- View for player statistics (using UUID relationships)
CREATE OR REPLACE VIEW player_stats AS
SELECT 
    p.player_name,
    p.avatar,
    COUNT(DISTINCT r.id) as games_played,
    AVG(p.score) as average_score,
    MAX(p.score) as best_score,
    COUNT(*) as total_games
FROM players p
JOIN rooms r ON r.id = p.room_id  -- This should work now with UUID
WHERE p.left_at IS NULL
GROUP BY p.player_name, p.avatar;

-- View for game type popularity (no changes needed)
CREATE OR REPLACE VIEW game_type_stats AS
SELECT 
    r.game_type,
    COUNT(*) as games_played,
    AVG(r.current_players) as average_players,
    AVG(EXTRACT(EPOCH FROM (r.finished_at - r.started_at))/60) as average_duration_minutes
FROM rooms r
WHERE r.finished_at IS NOT NULL
GROUP BY r.game_type;
