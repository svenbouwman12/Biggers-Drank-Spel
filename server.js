// ============================================================================
// DRANKSPEL MULTIPLAYER - Node.js + Express + API Backend
// ============================================================================

const express = require('express');
const cors = require('cors');
const QRCode = require('qrcode');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const SUPABASE_URL = 'https://tmqnpdtbldewusevrgxc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtcW5wZHRibGRld3VzZXZyZ3hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0NTYzNDMsImV4cCI6MjA3NDAzMjM0M30.0YsgPSlp-_Egj72t7e5wZRIWxQWXIouvGY_jXHLS1Ys';

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================================
// GAME STATE MANAGEMENT
// ============================================================================

// Store active rooms and games
const rooms = new Map();

// Simple test game data
const gameData = {
    simpleTest: {
        name: "Simple Test Game",
        description: "A basic multiplayer test game",
        rounds: [
            "Round 1: Say your name",
            "Round 2: Count to 5",
            "Round 3: Say 'Hello World'",
            "Round 4: Wave your hand",
            "Round 5: Smile!"
        ]
    }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Generate unique room code
function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 4; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    console.log('🏠 Generated room code:', result, '(length:', result.length + ')');
    return result;
}

// Generate random avatar
function generateAvatar() {
    const avatars = ['🎭', '🎪', '🎨', '🎯', '🎲', '🎸', '🎺', '🎻', '🎹', '🎤', '🎧', '🎬', '🎮', '🕹️', '🎯', '🎲'];
    return avatars[Math.floor(Math.random() * avatars.length)];
}

// Start game logic
function startGame(roomCode, gameType) {
    const room = rooms.get(roomCode);
    if (!room) return;

    console.log(`🎮 Starting ${gameType} game in room ${roomCode}`);

    if (gameType === 'simpleTest') {
        room.currentGame = {
            id: Date.now(),
            type: 'simpleTest',
            name: gameData.simpleTest.name,
            description: gameData.simpleTest.description,
            currentRound: 0,
            totalRounds: gameData.simpleTest.rounds.length,
            rounds: gameData.simpleTest.rounds,
            scores: new Map(),
            startTime: Date.now()
        };
        
        console.log(`🎯 Simple test game started with ${room.currentGame.totalRounds} rounds`);
    }
}

// ============================================================================
// API ROUTES
// ============================================================================

// Test room code generation
app.get('/api/test-room-code', (req, res) => {
    const roomCode = generateRoomCode();
    res.json({
        roomCode: roomCode,
        length: roomCode.length,
        timestamp: new Date().toISOString()
    });
});

// Debug endpoint to check database
app.get('/api/debug/rooms', async (req, res) => {
    try {
        const { data: rooms, error } = await supabase
            .from('rooms')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10);
            
        if (error) {
            console.error('❌ Database error:', error);
            return res.status(500).json({ error: error.message });
        }
        
        res.json({
            rooms: rooms,
            count: rooms.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Debug error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Debug endpoint to check players
app.get('/api/debug/players', async (req, res) => {
    try {
        const { data: players, error } = await supabase
            .from('players')
            .select('*')
            .order('joined_at', { ascending: false })
            .limit(20);
            
        if (error) {
            console.error('❌ Database error:', error);
            return res.status(500).json({ error: error.message });
        }
        
        res.json({
            players: players,
            count: players.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Debug error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get room info - Database first approach
app.get('/api/room/:roomCode', async (req, res) => {
    const roomCode = req.params.roomCode;
    
    try {
        console.log(`🔍 Fetching room ${roomCode} from database...`);
        
        // Always get from database first (more reliable in serverless)
        const { data: roomData, error: roomError } = await supabase
            .from('rooms')
            .select('*')
            .eq('code', roomCode)
            .single();
            
        if (roomError || !roomData) {
            console.log(`❌ Room ${roomCode} not found in database:`, roomError);
            return res.status(404).json({ error: 'Room not found' });
        }
        
        console.log(`✅ Found room ${roomCode} in database:`, roomData);
        
        // Get players from database using room UUID
        const { data: playersData, error: playersError } = await supabase
            .from('players')
            .select('*')
            .eq('room_id', roomData.id) // Using room UUID
            .is('left_at', null);
            
        if (playersError) {
            console.error('❌ Error fetching players:', playersError);
            return res.status(500).json({ error: 'Failed to fetch players' });
        }
        
        console.log(`👥 Found ${playersData.length} players for room ${roomCode}`);
        
        // Create room object for response
        const roomResponse = {
            code: roomCode,
            hostName: roomData.host_name,
            gameType: roomData.game_type,
            playerCount: playersData.length,
            players: playersData.map(playerData => ({
                id: playerData.socket_id,
                name: playerData.player_name,
                avatar: playerData.avatar,
                isHost: playerData.is_host,
                score: playerData.score || 0,
                joinedAt: playerData.joined_at
            })),
            gameState: roomData.status,
            type: 'roomUpdate'
        };
        
        console.log(`📡 Returning room data:`, roomResponse);
        
        res.json(roomResponse);
    } catch (error) {
        console.error('❌ Error fetching room:', error);
        res.status(500).json({ error: 'Failed to fetch room' });
    }
});

// Create room API
app.post('/api/room/create', async (req, res) => {
    try {
        const { hostName, gameType } = req.body;
        const roomCode = generateRoomCode();
        const hostId = 'api_' + Date.now();
        
        // Create room in database
        const { error: roomError } = await supabase
            .from('rooms')
            .insert([{
                code: roomCode,
                host_name: hostName,
                host_id: hostId,
                game_type: 'mixed', // Fallback to 'mixed' until database is updated
                status: 'lobby',
                max_players: 8,
                current_players: 1,
                settings: {
                    gameDuration: 30,
                    categories: ['spicy', 'funny', 'sport', 'movie']
                }
            }]);
            
        if (roomError) {
            console.error('❌ Error creating room in database:', roomError);
            return res.status(500).json({ error: 'Failed to create room in database' });
        }
        
        console.log(`✅ Room ${roomCode} created in database successfully`);

        // Get the room ID from database for foreign key reference
        const { data: roomData, error: roomFetchError } = await supabase
            .from('rooms')
            .select('id')
            .eq('code', roomCode)
            .single();
            
        if (roomFetchError || !roomData) {
            console.error('❌ Error fetching room ID:', roomFetchError);
            return res.status(500).json({ error: 'Failed to fetch room ID' });
        }
        
        console.log(`✅ Retrieved room ID: ${roomData.id}`);

        // Create room in memory
        const room = {
            code: roomCode,
            host: hostId,
            hostName: hostName,
            gameType: gameType || 'simpleTest',
            players: new Map(),
            gameState: 'lobby',
            currentGame: null,
            scores: new Map(),
            settings: {
                maxPlayers: 8,
                gameDuration: 30,
                categories: ['spicy', 'funny', 'sport', 'movie']
            }
        };
        
        // Add host as first player
        const hostAvatar = generateAvatar();
        const hostPlayer = {
            id: hostId,
            name: hostName,
            avatar: hostAvatar,
            isHost: true,
            score: 0,
            joinedAt: new Date().toISOString()
        };
        
        // Add host to database using room UUID
        const { error: playerError } = await supabase
            .from('players')
            .insert([{
                room_id: roomData.id, // Use UUID instead of room code
                socket_id: hostId,
                player_name: hostName,
                avatar: hostAvatar,
                is_host: true,
                score: 0,
                joined_at: new Date().toISOString()
            }]);
            
        if (playerError) {
            console.error('❌ Error adding host player to database:', playerError);
            return res.status(500).json({ error: 'Failed to add host player to database' });
        }
        
        console.log(`✅ Host player added to database successfully`);
        
        room.players.set(hostId, hostPlayer);
        rooms.set(roomCode, room);
        
        console.log(`🏠 Room created via API: ${roomCode} by ${hostName} (host added to DB)`);
        
        res.json({
            roomCode: roomCode,
            room: {
                code: roomCode,
                hostName: hostName,
                gameType: gameType || 'simpleTest',
                playerCount: 1,
                players: Array.from(room.players.values())
            }
        });
    } catch (error) {
        console.error('❌ Error creating room:', error);
        res.status(500).json({ error: 'Failed to create room' });
    }
});

// Join room API
app.post('/api/room/join', async (req, res) => {
    try {
        const { roomCode, playerName } = req.body;
        
        // Try to get room from memory first, then from database
        let room = rooms.get(roomCode);
        
        if (!room) {
            console.log(`🔄 Room ${roomCode} not in memory for join, checking database...`);
            
            const { data: roomData, error: roomError } = await supabase
                .from('rooms')
                .select('*')
                .eq('code', roomCode)
                .single();
                
            if (roomError || !roomData) {
                return res.status(404).json({ error: 'Room not found' });
            }
            
            // Get existing players from database
            const { data: playersData, error: playersError } = await supabase
                .from('players')
                .select('*')
                .eq('room_id', roomData.id)
                .is('left_at', null);
                
            if (playersError) {
                console.error('❌ Error fetching players:', playersError);
                return res.status(500).json({ error: 'Failed to fetch players' });
            }
            
            // Recreate room in memory
            room = {
                code: roomCode,
                host: roomData.host_id,
                hostName: roomData.host_name,
                gameType: roomData.game_type,
                players: new Map(),
                gameState: roomData.status,
                currentGame: null,
                scores: new Map(),
                settings: roomData.settings || {
                    maxPlayers: 8,
                    gameDuration: 30,
                    categories: ['spicy', 'funny', 'sport', 'movie']
                }
            };
            
            // Add existing players to room
            playersData.forEach(playerData => {
                const player = {
                    id: playerData.socket_id,
                    name: playerData.player_name,
                    avatar: playerData.avatar,
                    isHost: playerData.is_host,
                    score: playerData.score || 0,
                    joinedAt: playerData.joined_at
                };
                room.players.set(player.id, player);
                console.log(`👤 Restored player: ${player.name} (${player.isHost ? 'Host' : 'Player'})`);
            });
            
            // Store in memory
            rooms.set(roomCode, room);
            console.log(`🔄 Room ${roomCode} restored from database with ${room.players.size} players`);
        }
        
        if (room.players.size >= room.settings.maxPlayers) {
            return res.status(400).json({ error: 'Room is full' });
        }
        
        if (room.gameState !== 'lobby') {
            return res.status(400).json({ error: 'Game already started' });
        }
        
        // Add player to database
        await supabase
            .from('players')
            .insert([{
                room_id: (await supabase.from('rooms').select('id').eq('code', roomCode).single()).data.id,
                socket_id: 'api_' + Date.now(),
                player_name: playerName,
                avatar: generateAvatar(),
                is_host: false,
                is_ready: false,
                score: 0
            }]);

        // Add player to room
        const player = {
            id: 'api_' + Date.now(),
            name: playerName,
            avatar: generateAvatar(),
            isHost: false,
            score: 0,
            isReady: false
        };
        
        room.players.set(player.id, player);
        room.scores.set(player.id, 0);
        
        console.log(`👤 Player joined via API: ${playerName} to room ${roomCode}`);
        
        res.json({
            player: player,
            room: {
                code: roomCode,
                hostName: room.hostName,
                gameType: room.gameType,
                playerCount: room.players.size,
                players: Array.from(room.players.values())
            }
        });
    } catch (error) {
        console.error('❌ Error joining room:', error);
        res.status(500).json({ error: 'Failed to join room' });
    }
});

// Start game API
app.post('/api/game/start', async (req, res) => {
    try {
        const { roomCode, gameType } = req.body;
        
        // Try to get room from memory first, then from database
        let room = rooms.get(roomCode);
        
        if (!room) {
            console.log(`🔄 Room ${roomCode} not in memory for game start, checking database...`);
            
            const { data: roomData, error: roomError } = await supabase
                .from('rooms')
                .select('*')
                .eq('code', roomCode)
                .single();
                
            if (roomError || !roomData) {
                return res.status(404).json({ error: 'Room not found' });
            }
            
            // Get existing players from database
            const { data: playersData, error: playersError } = await supabase
                .from('players')
                .select('*')
                .eq('room_id', roomData.id)
                .is('left_at', null);
                
            if (playersError) {
                console.error('❌ Error fetching players:', playersError);
                return res.status(500).json({ error: 'Failed to fetch players' });
            }
            
            // Recreate room in memory
            room = {
                code: roomCode,
                host: roomData.host_id,
                hostName: roomData.host_name,
                gameType: roomData.game_type,
                players: new Map(),
                gameState: roomData.status,
                currentGame: null,
                scores: new Map(),
                settings: roomData.settings || {
                    maxPlayers: 8,
                    gameDuration: 30,
                    categories: ['spicy', 'funny', 'sport', 'movie']
                }
            };
            
            // Add existing players to room
            playersData.forEach(playerData => {
                const player = {
                    id: playerData.socket_id,
                    name: playerData.player_name,
                    avatar: playerData.avatar,
                    isHost: playerData.is_host,
                    score: playerData.score || 0,
                    joinedAt: playerData.joined_at
                };
                room.players.set(player.id, player);
                console.log(`👤 Restored player: ${player.name} (${player.isHost ? 'Host' : 'Player'})`);
            });
            
            // Store in memory
            rooms.set(roomCode, room);
            console.log(`🔄 Room ${roomCode} restored from database with ${room.players.size} players`);
        }
        
        if (room.players.size < 2) {
            return res.status(400).json({ error: 'Need at least 2 players' });
        }
        
        // Update room status in database
        await supabase
            .from('rooms')
            .update({ 
                status: 'playing',
                started_at: new Date().toISOString(),
                game_type: gameType || 'mostLikelyTo'
            })
            .eq('code', roomCode);
            
        console.log(`🔄 Updated room ${roomCode} status to 'playing' in database`);

        room.gameState = 'playing';
        room.currentGame = gameType || 'simpleTest';
        
        console.log(`🎮 Game started via API in room ${roomCode}: ${room.currentGame}`);
        console.log(`👥 Players in room before game start: ${room.players.size}`);
        
        // Start the specific game
        startGame(roomCode, room.currentGame);
        
        // Ensure room is stored in memory after game start
        rooms.set(roomCode, room);
        
        res.json({ 
            success: true,
            gameType: room.currentGame,
            players: Array.from(room.players.values()),
            playerCount: room.players.size
        });
    } catch (error) {
        console.error('❌ Error starting game:', error);
        res.status(500).json({ error: 'Failed to start game' });
    }
});

// Game vote API
app.post('/api/game/vote', async (req, res) => {
    try {
        const { roomCode, playerId, questionId, answer } = req.body;
        
        // Try to get room from memory first, then from database
        let room = rooms.get(roomCode);
        
        if (!room) {
            console.log(`🔄 Room ${roomCode} not in memory for vote, checking database...`);
            
            const { data: roomData, error: roomError } = await supabase
                .from('rooms')
                .select('*')
                .eq('code', roomCode)
                .single();
                
            if (roomError || !roomData) {
                return res.status(404).json({ error: 'Game not found' });
            }
            
            // Get existing players from database
            const { data: playersData, error: playersError } = await supabase
                .from('players')
                .select('*')
                .eq('room_id', roomData.id)
                .is('left_at', null);
                
            if (playersError) {
                console.error('❌ Error fetching players:', playersError);
                return res.status(500).json({ error: 'Failed to fetch players' });
            }
            
            // Recreate room in memory
            room = {
                code: roomCode,
                host: roomData.host_id,
                hostName: roomData.host_name,
                gameType: roomData.game_type,
                players: new Map(),
                gameState: roomData.status,
                currentGame: null,
                scores: new Map(),
                settings: roomData.settings || {
                    maxPlayers: 8,
                    gameDuration: 30,
                    categories: ['spicy', 'funny', 'sport', 'movie']
                }
            };
            
            // Add existing players to room
            playersData.forEach(playerData => {
                const player = {
                    id: playerData.socket_id,
                    name: playerData.player_name,
                    avatar: playerData.avatar,
                    isHost: playerData.is_host,
                    score: playerData.score || 0,
                    joinedAt: playerData.joined_at
                };
                room.players.set(player.id, player);
                console.log(`👤 Restored player: ${player.name} (${player.isHost ? 'Host' : 'Player'})`);
            });
            
            // Store in memory
            rooms.set(roomCode, room);
            console.log(`🔄 Room ${roomCode} restored from database with ${room.players.size} players`);
        }
        
        if (!room.currentQuestion) {
            return res.status(404).json({ error: 'No active game found' });
        }
        
        room.currentQuestion.answers.set(playerId, answer);
        
        console.log(`🗳️ Vote received from ${playerId} in room ${roomCode}: ${answer}`);
        
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Error processing vote:', error);
        res.status(500).json({ error: 'Failed to process vote' });
    }
});

// Generate QR code for room
app.get('/api/qr/:roomCode', async (req, res) => {
    try {
        const roomCode = req.params.roomCode;
        const qrCode = await QRCode.toDataURL(`${req.protocol}://${req.get('host')}?room=${roomCode}`);
        res.json({ qrCode });
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate QR code' });
    }
});

// Legacy routes for backward compatibility
app.get('/qr/:roomCode', async (req, res) => {
    try {
        const roomCode = req.params.roomCode;
        const qrCode = await QRCode.toDataURL(`${req.protocol}://${req.get('host')}?room=${roomCode}`);
        res.json({ qrCode });
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate QR code' });
    }
});

app.get('/room/:roomCode', (req, res) => {
    const roomCode = req.params.roomCode;
    const room = rooms.get(roomCode);
    
    if (!room) {
        return res.status(404).json({ error: 'Room not found' });
    }
    
    res.json({
        code: roomCode,
        hostName: room.hostName,
        gameType: room.gameType,
        playerCount: room.players.size,
        players: Array.from(room.players.values()),
        gameState: room.gameState
    });
});

// ============================================================================
// SERVER START
// ============================================================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Drankspel Multiplayer Server running on port ${PORT}`);
    console.log(`🌐 Open http://localhost:${PORT} to start playing!`);
    console.log(`📡 API Mode: Real-time updates via polling`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Server shutting down...');
    process.exit(0);
});

// ============================================================================
// END OF FILE
// ============================================================================
