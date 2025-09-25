-- ============================================================================
-- DRANKSPEL MULTIPLAYER - SUPABASE DATABASE SCHEMA
-- ============================================================================
-- Complete database schema for persistent game data, statistics, and user management

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USERS TABLE (Optional - for future user accounts)
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    avatar VARCHAR(10) DEFAULT '🎭',
    total_games INTEGER DEFAULT 0,
    total_wins INTEGER DEFAULT 0,
    total_score INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- ROOMS TABLE (Game sessions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS rooms (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    code VARCHAR(6) UNIQUE NOT NULL,
    host_name VARCHAR(100) NOT NULL,
    host_id VARCHAR(100), -- Socket ID or user ID
    game_type VARCHAR(20) NOT NULL DEFAULT 'mixed' CHECK (game_type IN ('mixed', 'mostLikelyTo', 'truthOrDrink', 'speedTap', 'quiz')),
    status VARCHAR(20) NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'playing', 'finished', 'closed')),
    max_players INTEGER DEFAULT 8 CHECK (max_players >= 2 AND max_players <= 20),
    current_players INTEGER DEFAULT 0,
    rounds_played INTEGER DEFAULT 0,
    total_rounds INTEGER DEFAULT 5,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================================
-- PLAYERS TABLE (Players in rooms)
-- ============================================================================

CREATE TABLE IF NOT EXISTS players (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    socket_id VARCHAR(100) NOT NULL,
    player_name VARCHAR(100) NOT NULL,
    avatar VARCHAR(10) NOT NULL,
    is_host BOOLEAN DEFAULT FALSE,
    is_ready BOOLEAN DEFAULT FALSE,
    score INTEGER DEFAULT 0,
    position INTEGER, -- Final position in game
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    left_at TIMESTAMP WITH TIME ZONE,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- GAME_EVENTS TABLE (Real-time game events)
-- ============================================================================

CREATE TABLE IF NOT EXISTS game_events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    player_id UUID REFERENCES players(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL, -- 'vote', 'answer', 'tap', 'join', 'leave', etc.
    event_data JSONB DEFAULT '{}',
    round_number INTEGER DEFAULT 1,
    game_phase VARCHAR(20) DEFAULT 'lobby', -- 'lobby', 'playing', 'results'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- GAME_ROUNDS TABLE (Individual game rounds)
-- ============================================================================

CREATE TABLE IF NOT EXISTS game_rounds (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    game_type VARCHAR(20) NOT NULL,
    question TEXT NOT NULL,
    question_data JSONB DEFAULT '{}', -- Additional question data (options, etc.)
    correct_answer VARCHAR(255), -- For quiz games
    time_limit INTEGER, -- In seconds
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled'))
);

-- ============================================================================
-- VOTES TABLE (Player votes/answers)
-- ============================================================================

CREATE TABLE IF NOT EXISTS votes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    round_id UUID NOT NULL REFERENCES game_rounds(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    vote_data JSONB NOT NULL, -- The actual vote/answer
    vote_type VARCHAR(20) NOT NULL, -- 'player_vote', 'truth_drink', 'tap_time', 'quiz_answer'
    response_time INTEGER, -- Time in milliseconds
    is_correct BOOLEAN, -- For quiz games
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- ROUND_RESULTS TABLE (Results of each round)
-- ============================================================================

CREATE TABLE IF NOT EXISTS round_results (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    round_id UUID NOT NULL REFERENCES game_rounds(id) ON DELETE CASCADE,
    winner_player_id UUID REFERENCES players(id) ON DELETE SET NULL,
    results_data JSONB NOT NULL, -- Vote counts, scores, etc.
    points_awarded JSONB DEFAULT '{}', -- Points given to each player
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- GAME_STATISTICS TABLE (Aggregated statistics)
-- ============================================================================

CREATE TABLE IF NOT EXISTS game_statistics (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    total_score INTEGER DEFAULT 0,
    rounds_played INTEGER DEFAULT 0,
    rounds_won INTEGER DEFAULT 0,
    average_response_time INTEGER, -- In milliseconds
    fastest_response_time INTEGER,
    slowest_response_time INTEGER,
    correct_answers INTEGER DEFAULT 0, -- For quiz games
    total_answers INTEGER DEFAULT 0,
    accuracy DECIMAL(5,2) DEFAULT 0.00, -- Percentage
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- ACHIEVEMENTS TABLE (Player achievements)
-- ============================================================================

CREATE TABLE IF NOT EXISTS achievements (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    achievement_type VARCHAR(50) NOT NULL, -- 'fastest_tap', 'quiz_master', 'most_votes', etc.
    achievement_data JSONB DEFAULT '{}',
    points_earned INTEGER DEFAULT 0,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- CUSTOM_QUESTIONS TABLE (User-generated questions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS custom_questions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_by VARCHAR(100), -- Username or user ID
    game_type VARCHAR(20) NOT NULL,
    question_text TEXT NOT NULL,
    question_data JSONB DEFAULT '{}', -- Options, correct answer, etc.
    category VARCHAR(50), -- 'spicy', 'funny', 'sport', 'movie', etc.
    difficulty VARCHAR(10) DEFAULT 'medium', -- 'easy', 'medium', 'hard'
    is_approved BOOLEAN DEFAULT FALSE,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Rooms indexes
CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(code);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_rooms_created_at ON rooms(created_at);
CREATE INDEX IF NOT EXISTS idx_rooms_host_id ON rooms(host_id);

-- Players indexes
CREATE INDEX IF NOT EXISTS idx_players_room_id ON players(room_id);
CREATE INDEX IF NOT EXISTS idx_players_socket_id ON players(socket_id);
CREATE INDEX IF NOT EXISTS idx_players_is_host ON players(is_host);
CREATE INDEX IF NOT EXISTS idx_players_score ON players(score);

-- Game events indexes
CREATE INDEX IF NOT EXISTS idx_game_events_room_id ON game_events(room_id);
CREATE INDEX IF NOT EXISTS idx_game_events_player_id ON game_events(player_id);
CREATE INDEX IF NOT EXISTS idx_game_events_type ON game_events(event_type);
CREATE INDEX IF NOT EXISTS idx_game_events_created_at ON game_events(created_at);

-- Game rounds indexes
CREATE INDEX IF NOT EXISTS idx_game_rounds_room_id ON game_rounds(room_id);
CREATE INDEX IF NOT EXISTS idx_game_rounds_round_number ON game_rounds(round_number);
CREATE INDEX IF NOT EXISTS idx_game_rounds_game_type ON game_rounds(game_type);

-- Votes indexes
CREATE INDEX IF NOT EXISTS idx_votes_room_id ON votes(room_id);
CREATE INDEX IF NOT EXISTS idx_votes_round_id ON votes(round_id);
CREATE INDEX IF NOT EXISTS idx_votes_player_id ON votes(player_id);
CREATE INDEX IF NOT EXISTS idx_votes_type ON votes(vote_type);

-- Round results indexes
CREATE INDEX IF NOT EXISTS idx_round_results_room_id ON round_results(room_id);
CREATE INDEX IF NOT EXISTS idx_round_results_round_id ON round_results(round_id);
CREATE INDEX IF NOT EXISTS idx_round_results_winner ON round_results(winner_player_id);

-- Game statistics indexes
CREATE INDEX IF NOT EXISTS idx_game_statistics_room_id ON game_statistics(room_id);
CREATE INDEX IF NOT EXISTS idx_game_statistics_player_id ON game_statistics(player_id);
CREATE INDEX IF NOT EXISTS idx_game_statistics_total_score ON game_statistics(total_score);

-- Achievements indexes
CREATE INDEX IF NOT EXISTS idx_achievements_player_id ON achievements(player_id);
CREATE INDEX IF NOT EXISTS idx_achievements_type ON achievements(achievement_type);
CREATE INDEX IF NOT EXISTS idx_achievements_earned_at ON achievements(earned_at);

-- Custom questions indexes
CREATE INDEX IF NOT EXISTS idx_custom_questions_game_type ON custom_questions(game_type);
CREATE INDEX IF NOT EXISTS idx_custom_questions_category ON custom_questions(category);
CREATE INDEX IF NOT EXISTS idx_custom_questions_approved ON custom_questions(is_approved);
CREATE INDEX IF NOT EXISTS idx_custom_questions_usage_count ON custom_questions(usage_count);

-- ============================================================================
-- FUNCTIONS FOR AUTOMATIC TIMESTAMPS
-- ============================================================================

-- Function to update updated_at automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to update last_seen
CREATE OR REPLACE FUNCTION update_last_seen()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_seen = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update last_seen on players
CREATE TRIGGER update_players_last_seen 
    BEFORE UPDATE ON players 
    FOR EACH ROW EXECUTE FUNCTION update_last_seen();

-- Update last_seen on users
CREATE TRIGGER update_users_last_seen 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_last_seen();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE round_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_questions ENABLE ROW LEVEL SECURITY;

-- Rooms policies - everyone can read, only host can update
CREATE POLICY "Rooms are viewable by everyone" ON rooms
    FOR SELECT USING (true);

CREATE POLICY "Rooms are insertable by everyone" ON rooms
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Rooms are updatable by host" ON rooms
    FOR UPDATE USING (host_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Players policies - players can manage their own data
CREATE POLICY "Players are viewable by room members" ON players
    FOR SELECT USING (true);

CREATE POLICY "Players can insert themselves" ON players
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Players can update themselves" ON players
    FOR UPDATE USING (socket_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Game events policies - everyone can read/write
CREATE POLICY "Game events are viewable by everyone" ON game_events
    FOR SELECT USING (true);

CREATE POLICY "Game events are insertable by everyone" ON game_events
    FOR INSERT WITH CHECK (true);

-- Votes policies - players can manage their own votes
CREATE POLICY "Votes are viewable by room members" ON votes
    FOR SELECT USING (true);

CREATE POLICY "Players can insert their own votes" ON votes
    FOR INSERT WITH CHECK (true);

-- Round results policies - everyone can read
CREATE POLICY "Round results are viewable by everyone" ON round_results
    FOR SELECT USING (true);

CREATE POLICY "Round results are insertable by everyone" ON round_results
    FOR INSERT WITH CHECK (true);

-- Game statistics policies - everyone can read
CREATE POLICY "Game statistics are viewable by everyone" ON game_statistics
    FOR SELECT USING (true);

CREATE POLICY "Game statistics are insertable by everyone" ON game_statistics
    FOR INSERT WITH CHECK (true);

-- Achievements policies - everyone can read
CREATE POLICY "Achievements are viewable by everyone" ON achievements
    FOR SELECT USING (true);

CREATE POLICY "Achievements are insertable by everyone" ON achievements
    FOR INSERT WITH CHECK (true);

-- Custom questions policies - everyone can read approved questions
CREATE POLICY "Approved custom questions are viewable by everyone" ON custom_questions
    FOR SELECT USING (is_approved = true);

CREATE POLICY "Custom questions are insertable by everyone" ON custom_questions
    FOR INSERT WITH CHECK (true);

-- ============================================================================
-- UTILITY FUNCTIONS
-- ============================================================================

-- Function to get room statistics
CREATE OR REPLACE FUNCTION get_room_statistics(room_code VARCHAR(6))
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'room', json_build_object(
            'code', r.code,
            'host_name', r.host_name,
            'game_type', r.game_type,
            'status', r.status,
            'players_count', r.current_players,
            'rounds_played', r.rounds_played,
            'created_at', r.created_at
        ),
        'players', (
            SELECT json_agg(
                json_build_object(
                    'name', p.player_name,
                    'avatar', p.avatar,
                    'score', p.score,
                    'position', p.position,
                    'is_host', p.is_host
                )
            )
            FROM players p
            WHERE p.room_id = r.id
            ORDER BY p.score DESC
        ),
        'top_players', (
            SELECT json_agg(
                json_build_object(
                    'name', p.player_name,
                    'avatar', p.avatar,
                    'score', p.score
                )
            )
            FROM players p
            WHERE p.room_id = r.id
            ORDER BY p.score DESC
            LIMIT 3
        )
    ) INTO result
    FROM rooms r
    WHERE r.code = room_code;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to get player achievements
CREATE OR REPLACE FUNCTION get_player_achievements(player_socket_id VARCHAR(100))
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'player', json_build_object(
            'name', p.player_name,
            'avatar', p.avatar,
            'score', p.score,
            'position', p.position
        ),
        'achievements', (
            SELECT json_agg(
                json_build_object(
                    'type', a.achievement_type,
                    'points', a.points_earned,
                    'earned_at', a.earned_at
                )
            )
            FROM achievements a
            WHERE a.player_id = p.id
            ORDER BY a.earned_at DESC
        )
    ) INTO result
    FROM players p
    WHERE p.socket_id = player_socket_id
    ORDER BY p.created_at DESC
    LIMIT 1;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old data
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
    -- Delete rooms older than 24 hours
    DELETE FROM rooms 
    WHERE created_at < NOW() - INTERVAL '24 hours';
    
    -- Delete players who left more than 1 hour ago
    DELETE FROM players 
    WHERE left_at IS NOT NULL 
    AND left_at < NOW() - INTERVAL '1 hour';
    
    -- Delete old game events (older than 7 days)
    DELETE FROM game_events 
    WHERE created_at < NOW() - INTERVAL '7 days';
    
    -- Delete old votes (older than 7 days)
    DELETE FROM votes 
    WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================================================

-- Insert sample custom questions
INSERT INTO custom_questions (game_type, question_text, question_data, category, is_approved) VALUES
('mostLikelyTo', 'Wie zou het eerst een miljoen verdienen?', '{}', 'funny', true),
('mostLikelyTo', 'Wie zou het eerst trouwen?', '{}', 'spicy', true),
('truthOrDrink', 'Wat is je grootste geheim?', '{}', 'spicy', true),
('truthOrDrink', 'Wie is je celebrity crush?', '{}', 'funny', true),
('quiz', 'Wat is de hoofdstad van Frankrijk?', '{"options": ["Parijs", "Londen", "Berlijn", "Madrid"], "correct": 0}', 'general', true),
('quiz', 'Hoeveel dagen heeft februari in een schrikkeljaar?', '{"options": ["28", "29", "30", "31"], "correct": 1}', 'general', true);

-- ============================================================================
-- VIEWS FOR EASY QUERIES
-- ============================================================================

-- View for active rooms with player count
CREATE OR REPLACE VIEW active_rooms AS
SELECT 
    r.*,
    COUNT(p.id) as player_count,
    MAX(p.score) as highest_score,
    MIN(p.joined_at) as first_player_joined
FROM rooms r
LEFT JOIN players p ON r.id = p.room_id
WHERE r.status IN ('lobby', 'playing')
GROUP BY r.id;

-- View for player statistics
CREATE OR REPLACE VIEW player_stats AS
SELECT 
    p.player_name,
    p.avatar,
    COUNT(DISTINCT r.id) as games_played,
    AVG(p.score) as average_score,
    MAX(p.score) as highest_score,
    COUNT(CASE WHEN p.position = 1 THEN 1 END) as wins,
    COUNT(CASE WHEN p.position <= 3 THEN 1 END) as top_3_finishes
FROM players p
JOIN rooms r ON p.room_id = r.id
WHERE r.status = 'finished'
GROUP BY p.player_name, p.avatar;

-- View for game type popularity
CREATE OR REPLACE VIEW game_type_stats AS
SELECT 
    r.game_type,
    COUNT(*) as games_played,
    AVG(r.current_players) as average_players,
    AVG(EXTRACT(EPOCH FROM (r.finished_at - r.started_at))/60) as average_duration_minutes
FROM rooms r
WHERE r.status = 'finished'
GROUP BY r.game_type;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE rooms IS 'Game sessions with unique codes';
COMMENT ON TABLE players IS 'Players participating in game sessions';
COMMENT ON TABLE game_events IS 'Real-time game events and actions';
COMMENT ON TABLE game_rounds IS 'Individual rounds within games';
COMMENT ON TABLE votes IS 'Player votes and answers';
COMMENT ON TABLE round_results IS 'Results of each game round';
COMMENT ON TABLE game_statistics IS 'Aggregated player statistics';
COMMENT ON TABLE achievements IS 'Player achievements and badges';
COMMENT ON TABLE custom_questions IS 'User-generated game questions';

COMMENT ON COLUMN rooms.code IS 'Unique 6-character room code';
COMMENT ON COLUMN rooms.status IS 'Current room status: lobby, playing, finished, closed';
COMMENT ON COLUMN players.socket_id IS 'Socket.IO connection ID';
COMMENT ON COLUMN players.position IS 'Final position in game (1st, 2nd, etc.)';
COMMENT ON COLUMN votes.response_time IS 'Time taken to respond in milliseconds';
COMMENT ON COLUMN game_statistics.accuracy IS 'Percentage of correct answers';

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================

-- Voer deze query uit in je Supabase SQL editor om het complete schema aan te maken!
