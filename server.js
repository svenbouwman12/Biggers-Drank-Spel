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
    balletjeBalletje: {
        name: "Balletje Balletje",
        description: "Waar zit het balletje onder?",
        rounds: [
            {
                question: "Waar zit het balletje onder?",
                options: ["Beker 1", "Beker 2", "Beker 3"],
                correctAnswer: 0, // Index of correct answer
                explanation: "Het balletje zat onder beker 1!"
            },
            {
                question: "En nu? Waar zit het balletje?",
                options: ["Beker 1", "Beker 2", "Beker 3"],
                correctAnswer: 1,
                explanation: "Het balletje zat onder beker 2!"
            },
            {
                question: "Laatste kans! Waar zit het balletje?",
                options: ["Beker 1", "Beker 2", "Beker 3"],
                correctAnswer: 2,
                explanation: "Het balletje zat onder beker 3!"
            }
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
async function startGame(roomCode, gameType) {
    const room = rooms.get(roomCode);
    if (!room) return;

    console.log(`🎮 Starting ${gameType} game in room ${roomCode}`);

    if (gameType === 'balletjeBalletje') {
        room.currentGame = {
            id: Date.now(),
            type: 'balletjeBalletje',
            name: gameData.balletjeBalletje.name,
            description: gameData.balletjeBalletje.description,
            currentRound: 0,
            totalRounds: gameData.balletjeBalletje.rounds.length,
            rounds: gameData.balletjeBalletje.rounds,
            scores: new Map(),
            startTime: Date.now(),
            currentQuestion: null,
            roundStartTime: null,
            isActive: true,
            phase: 'question', // 'question', 'results', 'finished'
            playerVotes: new Map(), // Store player votes
            roundResults: new Map() // Store round results
        };
        
        // Store game state in room settings for database persistence
        room.settings = {
            ...room.settings,
            currentGame: {
                id: room.currentGame.id,
                type: room.currentGame.type,
                name: room.currentGame.name,
                currentRound: room.currentGame.currentRound,
                totalRounds: room.currentGame.totalRounds,
                rounds: room.currentGame.rounds,
                startTime: room.currentGame.startTime,
                isActive: room.currentGame.isActive,
                phase: room.currentGame.phase,
                playerVotes: [],
                roundResults: []
            }
        };
        
        // Start the first round automatically
        await startNextRound(roomCode);
        
        console.log(`🎯 Balletje Balletje game started with ${room.currentGame.totalRounds} rounds`);
    }
}

// Update game state in database
async function updateGameStateInDatabase(roomCode) {
    try {
        const room = rooms.get(roomCode);
        if (!room || !room.currentGame) return;

        const gameStateData = {
            id: room.currentGame.id,
            type: room.currentGame.type,
            name: room.currentGame.name,
            currentRound: room.currentGame.currentRound,
            totalRounds: room.currentGame.totalRounds,
            currentQuestion: room.currentGame.currentQuestion,
            phase: room.currentGame.phase,
            roundStartTime: room.currentGame.roundStartTime,
            isActive: room.currentGame.isActive,
            playerVotes: Array.from(room.currentGame.playerVotes.entries()),
            roundResults: Array.from(room.currentGame.roundResults.entries())
        };

        // Update room settings with current game state
        room.settings = {
            ...room.settings,
            currentGame: gameStateData
        };

        // Update database
        const { data: updateData, error: updateError } = await supabase
            .from('rooms')
            .update({ 
                settings: JSON.stringify(room.settings)
            })
            .eq('code', roomCode)
            .select();

        if (updateError) {
            console.error('❌ Error updating game state in database:', updateError);
        } else {
            console.log(`✅ Game state updated in database for room ${roomCode}`);
        }
    } catch (error) {
        console.error('❌ Error in updateGameStateInDatabase:', error);
    }
}

async function startNextRound(roomCode) {
    const room = rooms.get(roomCode);
    if (!room || !room.currentGame) return;

    room.currentGame.currentRound++;
    
    if (room.currentGame.currentRound > room.currentGame.totalRounds) {
        // Game finished
        room.currentGame.phase = 'finished';
        room.gameState = 'finished';
        console.log(`🏁 Game finished in room ${roomCode}`);
        
        // Update database
        await updateGameStateInDatabase(roomCode);
        return;
    }

    // Get current question
    const currentQuestion = room.currentGame.rounds[room.currentGame.currentRound - 1];
    room.currentGame.currentQuestion = currentQuestion;
    room.currentGame.roundStartTime = Date.now();
    room.currentGame.phase = 'question';
    
    // Clear previous round votes
    room.currentGame.playerVotes.clear();

    console.log(`🎯 Round ${room.currentGame.currentRound}/${room.currentGame.totalRounds} started: ${currentQuestion.question}`);

    // Update database with current game state
    await updateGameStateInDatabase(roomCode);

    // Auto-advance after 10 seconds
    setTimeout(() => {
        advanceToResults(roomCode);
    }, 10000); // 10 seconds per question
}

async function advanceToResults(roomCode) {
    const room = rooms.get(roomCode);
    if (!room || !room.currentGame) return;

    room.currentGame.phase = 'results';
    
    // Calculate results
    const currentQuestion = room.currentGame.currentQuestion;
    const correctAnswer = currentQuestion.correctAnswer;
    const votes = room.currentGame.playerVotes;
    
    // Count votes for each option
    const voteCounts = [0, 0, 0]; // For 3 options
    votes.forEach((vote, playerId) => {
        if (vote >= 0 && vote < 3) {
            voteCounts[vote]++;
        }
    });
    
    // Store round results
    room.currentGame.roundResults.set(room.currentGame.currentRound, {
        correctAnswer: correctAnswer,
        voteCounts: voteCounts,
        playerVotes: Array.from(votes.entries()),
        explanation: currentQuestion.explanation
    });
    
    console.log(`📊 Round ${room.currentGame.currentRound} results phase - Correct: ${correctAnswer}, Votes: [${voteCounts.join(', ')}]`);

    // Update database with results
    await updateGameStateInDatabase(roomCode);

    // Auto-advance to next round after 8 seconds
    setTimeout(() => {
        startNextRound(roomCode);
    }, 8000); // 8 seconds for results
}

// Vote for an option in the current game
app.post('/api/game/vote', async (req, res) => {
    try {
        const { roomCode, playerId, vote } = req.body;
        
        console.log(`🗳️ Vote received: Room ${roomCode}, Player ${playerId}, Vote ${vote}`);
        
        // Get room from memory or database
        let room = rooms.get(roomCode);
        
        if (!room) {
            // Try to get from database
            const { data: roomData, error: roomError } = await supabase
                .from('rooms')
                .select('*')
                .eq('code', roomCode)
                .single();
                
            if (roomError || !roomData) {
                return res.status(404).json({ error: 'Room not found' });
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
                settings: roomData.settings || {}
            };
            
            // Try to get game state from database settings
            if (roomData.settings && roomData.settings.currentGame) {
                room.currentGame = roomData.settings.currentGame;
            }
            
            rooms.set(roomCode, room);
        }
        
        if (!room.currentGame || !room.currentGame.isActive) {
            return res.status(400).json({ error: 'No active game in this room' });
        }
        
        if (room.currentGame.phase !== 'question') {
            return res.status(400).json({ error: 'Voting is only allowed during question phase' });
        }
        
        // Validate vote
        if (vote < 0 || vote >= room.currentGame.currentQuestion.options.length) {
            return res.status(400).json({ error: 'Invalid vote option' });
        }
        
        // Store the vote
        room.currentGame.playerVotes.set(playerId, vote);
        
        console.log(`✅ Vote stored: Player ${playerId} voted for option ${vote}`);
        
        res.json({ 
            success: true, 
            message: 'Vote recorded',
            currentVotes: Array.from(room.currentGame.playerVotes.entries())
        });
        
    } catch (error) {
        console.error('❌ Error recording vote:', error);
        res.status(500).json({ error: 'Failed to record vote' });
    }
});

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

// Debug database room status
app.get('/api/debug/db-room/:roomCode', async (req, res) => {
    try {
        const roomCode = req.params.roomCode;
        
        const { data: roomData, error: roomError } = await supabase
            .from('rooms')
            .select('*')
            .eq('code', roomCode)
            .single();
            
        if (roomError || !roomData) {
            return res.status(404).json({ error: 'Room not found in database' });
        }
        
        res.json({
            code: roomCode,
            status: roomData.status,
            game_type: roomData.game_type,
            started_at: roomData.started_at,
            created_at: roomData.created_at,
            fullData: roomData
        });
    } catch (error) {
        console.error('❌ Debug database room error:', error);
        res.status(500).json({ error: 'Failed to fetch database room' });
    }
});

// Force update game state in database
app.post('/api/debug/force-game-start/:roomCode', async (req, res) => {
    try {
        const roomCode = req.params.roomCode;
        
        console.log(`🔥 Force updating game state for room ${roomCode}...`);
        
        // Create game state data
        const gameStateData = {
            id: Date.now(),
            type: 'simpleTest',
            name: 'Simple Test Game',
            currentRound: 1,
            totalRounds: 5,
            phase: 'question',
            roundStartTime: Date.now(),
            isActive: true,
            currentQuestion: {
                question: "What is your favorite color?",
                options: ["Red", "Blue", "Green", "Yellow"]
            }
        };
        
        // Force update database
        const { data: updateData, error: updateError } = await supabase
            .from('rooms')
            .update({ 
                status: 'playing',
                started_at: new Date().toISOString(),
                game_type: 'balletjeBalletje',
                settings: JSON.stringify({
                    categories: ['spicy', 'funny', 'sport', 'movie'],
                    gameDuration: 30,
                    currentGame: gameStateData
                })
            })
            .eq('code', roomCode)
            .select();
            
        if (updateError) {
            console.error('❌ Force update failed:', updateError);
            return res.status(500).json({ 
                error: 'Force update failed',
                details: updateError.message
            });
        }
        
        console.log(`✅ Force update successful:`, updateData);
        
        res.json({
            success: true,
            message: 'Game state force updated',
            updateData: updateData
        });
    } catch (error) {
        console.error('❌ Force update error:', error);
        res.status(500).json({ error: 'Force update failed', details: error.message });
    }
});

// Debug current game state
app.get('/api/debug/game-state/:roomCode', (req, res) => {
    try {
        const roomCode = req.params.roomCode;
        const room = rooms.get(roomCode);
        
        if (!room) {
            return res.status(404).json({ error: 'Room not found in memory' });
        }
        
        res.json({
            roomCode: roomCode,
            gameState: room.gameState,
            currentGame: room.currentGame,
            players: Array.from(room.players.values()),
            memoryRoom: room
        });
    } catch (error) {
        console.error('❌ Debug game state error:', error);
        res.status(500).json({ error: 'Failed to get game state' });
    }
});

// Test database update directly (GET version for easier testing)
app.get('/api/debug/test-update/:roomCode', async (req, res) => {
    try {
        const roomCode = req.params.roomCode;
        
        console.log(`🧪 Testing database update for room ${roomCode}...`);
        
        // Try to update the room status
        console.log(`📝 Attempting update with data:`, { 
            status: 'playing',
            started_at: new Date().toISOString(),
            game_type: 'simpleTest'
        });
        
        const { data: updateData, error: updateError } = await supabase
            .from('rooms')
            .update({ 
                status: 'playing',
                started_at: new Date().toISOString(),
                game_type: 'simpleTest'
            })
            .eq('code', roomCode)
            .select();
            
        console.log(`📊 Update result:`, { updateData, updateError });
            
        if (updateError) {
            console.error('❌ Test update failed:', updateError);
            return res.status(500).json({ 
                error: 'Database update failed',
                details: updateError.message,
                hint: updateError.hint,
                code: updateError.code
            });
        }
        
        console.log(`✅ Test update successful:`, updateData);
        
        // Get updated room data
        const { data: roomData, error: roomError } = await supabase
            .from('rooms')
            .select('*')
            .eq('code', roomCode)
            .single();
            
        res.json({
            success: true,
            updateResult: updateData,
            currentRoomData: roomData,
            message: 'Database update test completed'
        });
    } catch (error) {
        console.error('❌ Test update error:', error);
        res.status(500).json({ error: 'Test update failed', details: error.message });
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
        
        // Get in-memory room for current game state
        const memoryRoom = rooms.get(roomCode);
        
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
        
        // Add current game state from database or memory
        console.log(`🎮 Game state check:`, {
            databaseStatus: roomData.status,
            hasMemoryRoom: !!memoryRoom,
            hasDatabaseSettings: !!roomData.settings,
            databaseGameState: roomData.settings?.currentGame
        });
        
        // Try to get game state from database first (more reliable in serverless)
        let currentGame = null;
        
        if (roomData.status === 'playing' && roomData.settings && roomData.settings.currentGame) {
            currentGame = roomData.settings.currentGame;
            console.log(`🎮 Found game state in database:`, currentGame);
        } else if (memoryRoom && memoryRoom.currentGame && memoryRoom.currentGame.isActive) {
            currentGame = memoryRoom.currentGame;
            console.log(`🎮 Found game state in memory:`, currentGame);
        }
        
        if (currentGame && currentGame.isActive) {
            const timeRemaining = currentGame.phase === 'question' ? 
                Math.max(0, 10000 - (Date.now() - currentGame.roundStartTime)) : 
                Math.max(0, 8000 - (Date.now() - currentGame.roundStartTime));
                
            roomResponse.currentGame = {
                id: currentGame.id,
                type: currentGame.type,
                name: currentGame.name,
                currentRound: currentGame.currentRound,
                totalRounds: currentGame.totalRounds,
                currentQuestion: currentGame.currentQuestion,
                phase: currentGame.phase,
                roundStartTime: currentGame.roundStartTime,
                timeRemaining: timeRemaining,
                isActive: true,
                playerVotes: currentGame.playerVotes ? Array.from(currentGame.playerVotes.entries()) : [],
                roundResults: currentGame.roundResults ? Array.from(currentGame.roundResults.entries()) : []
            };
            
            console.log(`🎮 Added currentGame to response:`, roomResponse.currentGame);
        } else {
            console.log(`❌ No currentGame data available for room ${roomCode}`);
        }
        
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

        // Update current_players count in rooms table
        await supabase
            .from('rooms')
            .update({ current_players: room.players.size + 1 })
            .eq('code', roomCode);

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
        
        // Update room status in database with game state
        console.log(`🔄 Attempting to update room ${roomCode} status to 'playing'...`);
        
        // Create game state data with actual game data
        const gameStateData = {
            id: Date.now(),
            type: gameType || 'balletjeBalletje',
            name: 'Balletje Balletje',
            currentRound: 1,
            totalRounds: 3,
            phase: 'question',
            roundStartTime: Date.now(),
            isActive: true,
            currentQuestion: {
                question: "Waar zit het balletje onder?",
                options: ["Beker 1", "Beker 2", "Beker 3"],
                correctAnswer: 0,
                explanation: "Het balletje zat onder beker 1!"
            },
            playerVotes: [],
            roundResults: []
        };
        
        console.log(`📝 Update data:`, { 
            status: 'playing',
            started_at: new Date().toISOString(),
            game_type: gameType || 'balletjeBalletje',
            settings: JSON.stringify({
                ...room.settings,
                currentGame: gameStateData
            })
        });
        
        const { data: updateData, error: updateError } = await supabase
            .from('rooms')
            .update({ 
                status: 'playing',
                started_at: new Date().toISOString(),
                game_type: gameType || 'balletjeBalletje',
                settings: JSON.stringify({
                    ...room.settings,
                    currentGame: gameStateData
                })
            })
            .eq('code', roomCode)
            .select();
            
        if (updateError) {
            console.error('❌ Error updating room status:', updateError);
            console.error('❌ Update error details:', updateError.message, updateError.details, updateError.hint);
            
            // Try fallback: update only status without game_type
            console.log(`🔄 Trying fallback: update only status to 'playing'...`);
            const { data: fallbackData, error: fallbackError } = await supabase
                .from('rooms')
                .update({ 
                    status: 'playing',
                    started_at: new Date().toISOString(),
                    game_type: 'balletjeBalletje'
                })
                .eq('code', roomCode)
                .select();
                
            if (fallbackError) {
                console.error('❌ Fallback update also failed:', fallbackError);
                return res.status(500).json({ 
                    error: 'Failed to update room status',
                    details: updateError.message,
                    hint: updateError.hint,
                    fallbackError: fallbackError.message
                });
            }
            
            console.log(`✅ Fallback update successful:`, fallbackData);
        }
        
        console.log(`✅ Database update result:`, updateData);
        console.log(`🔄 Updated room ${roomCode} status to 'playing' in database`);

        // Verify the database update was successful
        const { data: verifyData, error: verifyError } = await supabase
            .from('rooms')
            .select('status, game_type')
            .eq('code', roomCode)
            .single();
            
        if (verifyError || !verifyData) {
            console.error('❌ Error verifying room status update:', verifyError);
            return res.status(500).json({ error: 'Failed to verify room status update' });
        }
        
        console.log(`✅ Verified room status: ${verifyData.status}, game_type: ${verifyData.game_type}`);

        room.gameState = 'playing';
        room.currentGame = gameType || 'simpleTest';
        
        console.log(`🎮 Game started via API in room ${roomCode}: ${room.currentGame}`);
        console.log(`👥 Players in room before game start: ${room.players.size}`);
        
        // Start the specific game
        await startGame(roomCode, room.currentGame);
        
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

// Test endpoint for debugging
app.get('/api/lobbies/test', async (req, res) => {
    try {
        console.log('🧪 Testing lobby API...');
        
        // Simple test - just return some data
        res.json({ 
            success: true, 
            message: 'API is working',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Test error:', error);
        res.status(500).json({ error: 'Test failed' });
    }
});

// Get all active lobbies
app.get('/api/lobbies', async (req, res) => {
    try {
        console.log('📋 Fetching active lobbies...');
        
        // First test database connection
        const { data: testData, error: testError } = await supabase
            .from('rooms')
            .select('code')
            .limit(1);

        if (testError) {
            console.error('❌ Database connection test failed:', testError);
            return res.status(500).json({ 
                error: 'Database connection failed', 
                details: testError.message 
            });
        }

        console.log('✅ Database connection test passed');
        
        // Get all rooms from database where status is 'lobby' or 'playing'
        const { data: roomsData, error } = await supabase
            .from('rooms')
            .select(`
                code,
                host_name,
                game_type,
                status,
                current_players,
                max_players,
                created_at,
                started_at
            `)
            .in('status', ['lobby', 'playing'])
            .order('created_at', { ascending: false });

        if (error) {
            console.error('❌ Error fetching lobbies:', error);
            return res.status(500).json({ 
                error: 'Failed to fetch lobbies', 
                details: error.message 
            });
        }

        console.log(`📋 Found ${roomsData?.length || 0} rooms in database`);

        // Get player count for each room
        const lobbiesWithPlayers = await Promise.all(
            (roomsData || []).map(async (room) => {
                try {
                    // Get players for this room by room code (since we don't have room ID)
                    const { data: playersData } = await supabase
                        .from('players')
                        .select('player_name, avatar')
                        .eq('room_id', room.code);

                    return {
                        code: room.code,
                        hostName: room.host_name,
                        gameType: room.game_type,
                        status: room.status,
                        currentPlayers: playersData?.length || 0,
                        maxPlayers: room.max_players || 8,
                        players: playersData || [],
                        createdAt: room.created_at,
                        startedAt: room.started_at,
                        canJoin: room.status === 'lobby' && (playersData?.length || 0) < (room.max_players || 8)
                    };
                } catch (playerError) {
                    console.error(`❌ Error fetching players for room ${room.code}:`, playerError);
                    return {
                        code: room.code,
                        hostName: room.host_name,
                        gameType: room.game_type,
                        status: room.status,
                        currentPlayers: 0,
                        maxPlayers: room.max_players || 8,
                        players: [],
                        createdAt: room.created_at,
                        startedAt: room.started_at,
                        canJoin: room.status === 'lobby'
                    };
                }
            })
        );

        console.log(`📋 Returning ${lobbiesWithPlayers.length} lobbies`);
        res.json({ 
            success: true, 
            lobbies: lobbiesWithPlayers,
            count: lobbiesWithPlayers.length
        });

    } catch (error) {
        console.error('❌ Error in /api/lobbies:', error);
        res.status(500).json({ 
            error: 'Failed to fetch lobbies',
            details: error.message,
            stack: error.stack
        });
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
