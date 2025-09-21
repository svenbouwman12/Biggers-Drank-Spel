-- ============================================================================
-- SUPABASE DATABASE SCHEMA VOOR DRANKSPEL PARTY
-- ============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- ROOMS TABLE
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
-- PLAYERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS players (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    room_code VARCHAR(6) NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
    is_host BOOLEAN DEFAULT FALSE,
    is_ready BOOLEAN DEFAULT FALSE,
    score INTEGER DEFAULT 0,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- GAME ACTIONS TABLE (voor real-time multiplayer)
-- ============================================================================

CREATE TABLE IF NOT EXISTS game_actions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    room_code VARCHAR(6) NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
    player_id VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- GAME STATES TABLE (voor spel state opslag)
-- ============================================================================

CREATE TABLE IF NOT EXISTS game_states (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    room_code VARCHAR(6) NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
    game_type VARCHAR(20) NOT NULL,
    state_data JSONB NOT NULL DEFAULT '{}',
    current_turn INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- INDEXES VOOR PERFORMANCE
-- ============================================================================

-- Rooms indexes
CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(code);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_rooms_created_at ON rooms(created_at);

-- Players indexes
CREATE INDEX IF NOT EXISTS idx_players_room_code ON players(room_code);
CREATE INDEX IF NOT EXISTS idx_players_host ON players(is_host);
CREATE INDEX IF NOT EXISTS idx_players_ready ON players(is_ready);

-- Game actions indexes
CREATE INDEX IF NOT EXISTS idx_game_actions_room_code ON game_actions(room_code);
CREATE INDEX IF NOT EXISTS idx_game_actions_timestamp ON game_actions(timestamp);
CREATE INDEX IF NOT EXISTS idx_game_actions_action ON game_actions(action);

-- Game states indexes
CREATE INDEX IF NOT EXISTS idx_game_states_room_code ON game_states(room_code);
CREATE INDEX IF NOT EXISTS idx_game_states_game_type ON game_states(game_type);

-- ============================================================================
-- FUNCTIES VOOR AUTOMATISCHE TIMESTAMPS
-- ============================================================================

-- Functie om updated_at automatisch bij te werken
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers voor automatische updated_at
CREATE TRIGGER update_rooms_updated_at 
    BEFORE UPDATE ON rooms 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_game_states_updated_at 
    BEFORE UPDATE ON game_states 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS op alle tabellen
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_states ENABLE ROW LEVEL SECURITY;

-- Rooms policies - iedereen kan lezen, alleen host kan updaten
CREATE POLICY "Rooms are viewable by everyone" ON rooms
    FOR SELECT USING (true);

CREATE POLICY "Rooms are insertable by everyone" ON rooms
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Rooms are updatable by host" ON rooms
    FOR UPDATE USING (host_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Players policies - spelers kunnen hun eigen data beheren
CREATE POLICY "Players are viewable by room members" ON players
    FOR SELECT USING (true);

CREATE POLICY "Players can insert themselves" ON players
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Players can update themselves" ON players
    FOR UPDATE USING (id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Game actions policies - iedereen kan lezen/schrijven in rooms
CREATE POLICY "Game actions are viewable by room members" ON game_actions
    FOR SELECT USING (true);

CREATE POLICY "Game actions are insertable by room members" ON game_actions
    FOR INSERT WITH CHECK (true);

-- Game states policies
CREATE POLICY "Game states are viewable by room members" ON game_states
    FOR SELECT USING (true);

CREATE POLICY "Game states are insertable by room members" ON game_states
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Game states are updatable by room members" ON game_states
    FOR UPDATE USING (true);

-- ============================================================================
-- REAL-TIME SUBSCRIPTIONS (OPTIONEEL - VEREIST EARLY ACCESS)
-- ============================================================================

-- Uncomment de volgende regels als je toegang hebt tot Supabase Realtime Early Access:
-- ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
-- ALTER PUBLICATION supabase_realtime ADD TABLE players;
-- ALTER PUBLICATION supabase_realtime ADD TABLE game_actions;
-- ALTER PUBLICATION supabase_realtime ADD TABLE game_states;

-- Voor nu gebruiken we polling in plaats van real-time subscriptions

-- ============================================================================
-- CLEANUP FUNCTIE VOOR OUDE DATA
-- ============================================================================

-- Functie om oude, verlaten rooms op te ruimen
CREATE OR REPLACE FUNCTION cleanup_old_rooms()
RETURNS void AS $$
BEGIN
    -- Verwijder rooms die ouder zijn dan 24 uur en geen spelers hebben
    DELETE FROM rooms 
    WHERE created_at < NOW() - INTERVAL '24 hours'
    AND id NOT IN (
        SELECT DISTINCT room_code FROM players
    );
    
    -- Verwijder spelers die al meer dan 1 uur niet actief zijn
    DELETE FROM players 
    WHERE last_seen < NOW() - INTERVAL '1 hour';
    
    -- Verwijder oude game actions (ouder dan 7 dagen)
    DELETE FROM game_actions 
    WHERE timestamp < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SAMPLE DATA (optioneel voor testing)
-- ============================================================================

-- Uncomment de volgende regels om sample data toe te voegen voor testing

/*
INSERT INTO rooms (code, name, game_type, max_players, host_id) VALUES
('TEST01', 'Test Lobby', 'paardenrace', 4, 'test_host_1'),
('TEST02', 'Mexico Party', 'mexico', 6, 'test_host_2');

INSERT INTO players (id, name, room_code, is_host, is_ready) VALUES
('test_host_1', 'Host Player', 'TEST01', true, true),
('test_player_1', 'Player One', 'TEST01', false, true),
('test_player_2', 'Player Two', 'TEST01', false, false);
*/

-- ============================================================================
-- VIEWS VOOR EENVOUDIGE QUERIES
-- ============================================================================

-- View voor rooms met player count
CREATE OR REPLACE VIEW rooms_with_players AS
SELECT 
    r.*,
    COUNT(p.id) as player_count,
    COUNT(CASE WHEN p.is_ready THEN 1 END) as ready_count
FROM rooms r
LEFT JOIN players p ON r.code = p.room_code
GROUP BY r.id;

-- View voor active players
CREATE OR REPLACE VIEW active_players AS
SELECT 
    p.*,
    r.name as room_name,
    r.game_type,
    r.status as room_status
FROM players p
JOIN rooms r ON p.room_code = r.code
WHERE r.status = 'waiting' OR r.status = 'playing';

-- ============================================================================
-- COMMENTS VOOR DOCUMENTATIE
-- ============================================================================

COMMENT ON TABLE rooms IS 'Stores game lobby information';
COMMENT ON TABLE players IS 'Stores player information and room membership';
COMMENT ON TABLE game_actions IS 'Real-time game actions for multiplayer sync';
COMMENT ON TABLE game_states IS 'Persistent game state storage';

COMMENT ON COLUMN rooms.code IS 'Unique 6-character room code for joining';
COMMENT ON COLUMN rooms.status IS 'Current room status: waiting, playing, finished';
COMMENT ON COLUMN players.is_host IS 'Whether this player is the room host';
COMMENT ON COLUMN players.is_ready IS 'Whether this player is ready to start';
COMMENT ON COLUMN game_actions.data IS 'JSON data for the specific game action';

-- ============================================================================
-- EINDE VAN SCHEMA
-- ============================================================================

-- Voer deze query uit in je Supabase SQL editor om het complete schema aan te maken!
