// ============================================================================
// DRANKSPEL MULTIPLAYER - Node.js + Express + Socket.IO Backend
// ============================================================================

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
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
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ['polling'],
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================================
// GAME STATE MANAGEMENT
// ============================================================================

// Store active rooms and games
const rooms = new Map();
const players = new Map();

// Game data
const gameData = {
    // Most Likely To questions
    mostLikelyTo: [
        "Wie zou het eerst dronken worden?",
        "Wie zou het eerst een tattoo laten zetten?",
        "Wie zou het eerst trouwen?",
        "Wie zou het eerst een miljoen verdienen?",
        "Wie zou het eerst een boek schrijven?",
        "Wie zou het eerst een wereldreis maken?",
        "Wie zou het eerst een eigen bedrijf starten?",
        "Wie zou het eerst een huis kopen?",
        "Wie zou het eerst een kind krijgen?",
        "Wie zou het eerst een beroemdheid ontmoeten?"
    ],
    
    // Truth or Drink questions
    truthOrDrink: [
        "Wat is je grootste geheim?",
        "Wat is het domste dat je ooit hebt gedaan?",
        "Wie is je celebrity crush?",
        "Wat is je grootste angst?",
        "Wat is het ergste dat je ooit hebt gelogen?",
        "Wie zou je willen zijn voor een dag?",
        "Wat is je grootste spijt?",
        "Wat is het gekste dat je ooit hebt gedaan?",
        "Wie is je grootste rivaal?",
        "Wat is je grootste droom?"
    ],
    
    // Speed Tap challenges
    speedTap: [
        "Klik zo snel mogelijk!",
        "Wie is de snelste?",
        "Race tegen de tijd!",
        "Snelle vingers test!",
        "Reactie test!"
    ],
    
    // Quiz questions
    quiz: [
        {
            question: "Wat is de hoofdstad van Nederland?",
            options: ["Amsterdam", "Rotterdam", "Den Haag", "Utrecht"],
            correct: 0
        },
        {
            question: "Hoeveel dagen heeft februari in een schrikkeljaar?",
            options: ["28", "29", "30", "31"],
            correct: 1
        },
        {
            question: "Wat is de snelste dier ter wereld?",
            options: ["Cheetah", "Luipaard", "Jachtluipaard", "Tijger"],
            correct: 2
        }
    ]
};

// ============================================================================
// SUPABASE DATABASE FUNCTIONS
// ============================================================================

// Create room in database
async function createRoomInDB(roomData) {
    try {
        const { data, error } = await supabase
            .from('rooms')
            .insert([{
                code: roomData.code,
                host_name: roomData.hostName,
                host_id: roomData.hostId,
                game_type: roomData.gameType,
                status: 'lobby',
                max_players: roomData.maxPlayers || 8,
                current_players: 1,
                settings: roomData.settings || {}
            }])
            .select()
            .single();

        if (error) throw error;
        console.log('🏠 Room created in database:', data);
        return data;
    } catch (error) {
        console.error('❌ Error creating room in database:', error);
        throw error;
    }
}

// Add player to database
async function addPlayerToDB(roomCode, playerData) {
    try {
        // Get room ID
        const { data: room, error: roomError } = await supabase
            .from('rooms')
            .select('id, current_players')
            .eq('code', roomCode)
            .single();

        if (roomError) throw roomError;

        // Add player
        const { data, error } = await supabase
            .from('players')
            .insert([{
                room_id: room.id,
                socket_id: playerData.socketId,
                player_name: playerData.name,
                avatar: playerData.avatar,
                is_host: playerData.isHost || false,
                is_ready: false,
                score: 0
            }])
            .select()
            .single();

        if (error) throw error;

        // Update room player count
        await supabase
            .from('rooms')
            .update({ current_players: room.current_players + 1 })
            .eq('code', roomCode);

        console.log('👤 Player added to database:', data);
        return data;
    } catch (error) {
        console.error('❌ Error adding player to database:', error);
        throw error;
    }
}

// Remove player from database
async function removePlayerFromDB(socketId) {
    try {
        // Get player info
        const { data: player, error: playerError } = await supabase
            .from('players')
            .select('*, rooms!inner(code)')
            .eq('socket_id', socketId)
            .single();

        if (playerError) throw playerError;

        // Update player as left
        await supabase
            .from('players')
            .update({ left_at: new Date().toISOString() })
            .eq('socket_id', socketId);

        // Update room player count
        const { data: room, error: roomError } = await supabase
            .from('rooms')
            .select('current_players')
            .eq('code', player.rooms.code)
            .single();

        if (roomError) throw roomError;

        await supabase
            .from('rooms')
            .update({ current_players: Math.max(0, room.current_players - 1) })
            .eq('code', player.rooms.code);

        console.log('👋 Player removed from database');
        return { roomCode: player.rooms.code };
    } catch (error) {
        console.error('❌ Error removing player from database:', error);
        throw error;
    }
}

// Log game event
async function logGameEvent(roomCode, socketId, eventType, eventData) {
    try {
        // Get room and player IDs
        const { data: room, error: roomError } = await supabase
            .from('rooms')
            .select('id')
            .eq('code', roomCode)
            .single();

        if (roomError) throw roomError;

        const { data: player, error: playerError } = await supabase
            .from('players')
            .select('id')
            .eq('socket_id', socketId)
            .single();

        if (playerError) throw playerError;

        const { data, error } = await supabase
            .from('game_events')
            .insert([{
                room_id: room.id,
                player_id: player.id,
                event_type: eventType,
                event_data: eventData,
                round_number: eventData.roundNumber || 1,
                game_phase: eventData.gamePhase || 'playing'
            }])
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('❌ Error logging game event:', error);
        throw error;
    }
}

// Update room status
async function updateRoomStatus(roomCode, status, additionalData = {}) {
    try {
        const updateData = {
            status,
            ...additionalData
        };

        if (status === 'playing') {
            updateData.started_at = new Date().toISOString();
        } else if (status === 'finished') {
            updateData.finished_at = new Date().toISOString();
        }

        const { data, error } = await supabase
            .from('rooms')
            .update(updateData)
            .eq('code', roomCode)
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('❌ Error updating room status:', error);
        throw error;
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Generate unique room code
function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Generate random avatar
function generateAvatar() {
    const avatars = ['🎭', '🎪', '🎨', '🎯', '🎲', '🎸', '🎺', '🎻', '🎹', '🎤', '🎧', '🎬', '🎮', '🕹️', '🎯', '🎲'];
    return avatars[Math.floor(Math.random() * avatars.length)];
}

// ============================================================================
// SOCKET.IO EVENT HANDLERS
// ============================================================================

io.on('connection', (socket) => {
    console.log(`🔌 User connected: ${socket.id}`);

    // Create new room
    socket.on('createRoom', async (data) => {
        const { hostName, gameType } = data;
        const roomCode = generateRoomCode();
        
        try {
            // Create room in database
            await createRoomInDB({
                code: roomCode,
                hostName: hostName,
                hostId: socket.id,
                gameType: gameType || 'mixed',
                maxPlayers: 8,
                settings: {
                    gameDuration: 30,
                    categories: ['spicy', 'funny', 'sport', 'movie']
                }
            });

            // Add host to database
            await addPlayerToDB(roomCode, {
                socketId: socket.id,
                name: hostName,
                avatar: generateAvatar(),
                isHost: true
            });

            // Create room in memory
            const room = {
                code: roomCode,
                host: socket.id,
                hostName: hostName,
                gameType: gameType || 'mixed',
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
            
            // Add host to room
            const player = {
                id: socket.id,
                name: hostName,
                avatar: generateAvatar(),
                isHost: true,
                score: 0,
                isReady: false
            };
            
            room.players.set(socket.id, player);
            room.scores.set(socket.id, 0);
            rooms.set(roomCode, room);
            players.set(socket.id, roomCode);
            
            socket.join(roomCode);
            
            console.log(`🏠 Room created: ${roomCode} by ${hostName}`);
            
            socket.emit('roomCreated', {
                roomCode: roomCode,
                room: {
                    code: roomCode,
                    hostName: hostName,
                    gameType: gameType,
                    playerCount: 1,
                    players: Array.from(room.players.values())
                }
            });
        } catch (error) {
            console.error('❌ Error creating room:', error);
            socket.emit('error', { message: 'Failed to create room' });
        }
    });

    // Join existing room
    socket.on('joinRoom', async (data) => {
        const { roomCode, playerName } = data;
        const room = rooms.get(roomCode);
        
        if (!room) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }
        
        if (room.players.size >= room.settings.maxPlayers) {
            socket.emit('error', { message: 'Room is full' });
            return;
        }
        
        if (room.gameState !== 'lobby') {
            socket.emit('error', { message: 'Game already started' });
            return;
        }
        
        try {
            // Add player to database
            await addPlayerToDB(roomCode, {
                socketId: socket.id,
                name: playerName,
                avatar: generateAvatar(),
                isHost: false
            });

            // Add player to room
            const player = {
                id: socket.id,
                name: playerName,
                avatar: generateAvatar(),
                isHost: false,
                score: 0,
                isReady: false
            };
            
            room.players.set(socket.id, player);
            room.scores.set(socket.id, 0);
            players.set(socket.id, roomCode);
            
            socket.join(roomCode);
            
            console.log(`👤 Player joined: ${playerName} to room ${roomCode}`);
            
            // Notify all players in room
            io.to(roomCode).emit('playerJoined', {
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
            socket.emit('error', { message: 'Failed to join room' });
        }
    });

    // Start game
    socket.on('startGame', async (data) => {
        const roomCode = players.get(socket.id);
        const room = rooms.get(roomCode);
        
        if (!room || room.host !== socket.id) {
            socket.emit('error', { message: 'Not authorized' });
            return;
        }
        
        if (room.players.size < 2) {
            socket.emit('error', { message: 'Need at least 2 players' });
            return;
        }
        
        try {
            // Update room status in database
            await updateRoomStatus(roomCode, 'playing', {
                game_type: data.gameType || 'mostLikelyTo'
            });

            room.gameState = 'playing';
            room.currentGame = data.gameType || 'mostLikelyTo';
            
            console.log(`🎮 Game started in room ${roomCode}: ${room.currentGame}`);
            
            io.to(roomCode).emit('gameStarted', {
                gameType: room.currentGame,
                players: Array.from(room.players.values())
            });
            
            // Start the specific game
            startGame(roomCode, room.currentGame);
        } catch (error) {
            console.error('❌ Error starting game:', error);
            socket.emit('error', { message: 'Failed to start game' });
        }
    });

    // Submit vote/answer
    socket.on('submitVote', async (data) => {
        const roomCode = players.get(socket.id);
        const room = rooms.get(roomCode);
        
        if (!room || room.gameState !== 'playing') {
            return;
        }
        
        const player = room.players.get(socket.id);
        if (!player) return;
        
        try {
            // Log game event in database
            await logGameEvent(roomCode, socket.id, 'vote', {
                vote: data.vote,
                voteType: data.voteType || 'player_vote',
                roundNumber: room.currentRound || 1,
                gamePhase: 'playing',
                responseTime: data.responseTime || 0
            });

            // Store the vote
            if (!room.votes) room.votes = new Map();
            room.votes.set(socket.id, data);
            
            console.log(`🗳️ Vote submitted by ${player.name}:`, data);
            
            // Check if all players have voted
            if (room.votes.size === room.players.size) {
                processVotes(roomCode);
            }
        } catch (error) {
            console.error('❌ Error submitting vote:', error);
        }
    });

    // Player ready
    socket.on('playerReady', (data) => {
        const roomCode = players.get(socket.id);
        const room = rooms.get(roomCode);
        
        if (!room) return;
        
        const player = room.players.get(socket.id);
        if (player) {
            player.isReady = data.ready;
            
            io.to(roomCode).emit('playerReady', {
                playerId: socket.id,
                playerName: player.name,
                isReady: data.ready
            });
        }
    });

    // Disconnect
    socket.on('disconnect', async () => {
        const roomCode = players.get(socket.id);
        const room = rooms.get(roomCode);
        
        if (room) {
            const player = room.players.get(socket.id);
            
            if (player) {
                console.log(`👋 Player left: ${player.name} from room ${roomCode}`);
                
                try {
                    // Remove player from database
                    await removePlayerFromDB(socket.id);
                } catch (error) {
                    console.error('❌ Error removing player from database:', error);
                }
                
                // Remove player from room
                room.players.delete(socket.id);
                room.scores.delete(socket.id);
                
                // If host left, assign new host or close room
                if (room.host === socket.id) {
                    if (room.players.size > 0) {
                        const newHost = room.players.keys().next().value;
                        room.host = newHost;
                        room.players.get(newHost).isHost = true;
                        
                        io.to(roomCode).emit('hostChanged', {
                            newHost: room.players.get(newHost)
                        });
                    } else {
                        rooms.delete(roomCode);
                        console.log(`🏠 Room ${roomCode} closed - no players left`);
                        return;
                    }
                }
                
                // Notify remaining players
                io.to(roomCode).emit('playerLeft', {
                    playerId: socket.id,
                    playerName: player.name,
                    room: {
                        code: roomCode,
                        hostName: room.hostName,
                        gameType: room.gameType,
                        playerCount: room.players.size,
                        players: Array.from(room.players.values())
                    }
                });
            }
        }
        
        players.delete(socket.id);
    });
});

// ============================================================================
// GAME LOGIC FUNCTIONS
// ============================================================================

function startGame(roomCode, gameType) {
    const room = rooms.get(roomCode);
    if (!room) return;
    
    switch (gameType) {
        case 'mostLikelyTo':
            startMostLikelyTo(roomCode);
            break;
        case 'truthOrDrink':
            startTruthOrDrink(roomCode);
            break;
        case 'speedTap':
            startSpeedTap(roomCode);
            break;
        case 'quiz':
            startQuiz(roomCode);
            break;
        default:
            startMostLikelyTo(roomCode);
    }
}

function startMostLikelyTo(roomCode) {
    const room = rooms.get(roomCode);
    if (!room) return;
    
    const question = gameData.mostLikelyTo[Math.floor(Math.random() * gameData.mostLikelyTo.length)];
    room.currentQuestion = question;
    room.votes = new Map();
    
    console.log(`❓ Most Likely To question: ${question}`);
    
    io.to(roomCode).emit('gameQuestion', {
        gameType: 'mostLikelyTo',
        question: question,
        players: Array.from(room.players.values()).map(p => ({ id: p.id, name: p.name, avatar: p.avatar }))
    });
}

function startTruthOrDrink(roomCode) {
    const room = rooms.get(roomCode);
    if (!room) return;
    
    const question = gameData.truthOrDrink[Math.floor(Math.random() * gameData.truthOrDrink.length)];
    room.currentQuestion = question;
    
    console.log(`🍺 Truth or Drink question: ${question}`);
    
    io.to(roomCode).emit('gameQuestion', {
        gameType: 'truthOrDrink',
        question: question
    });
}

function startSpeedTap(roomCode) {
    const room = rooms.get(roomCode);
    if (!room) return;
    
    const challenge = gameData.speedTap[Math.floor(Math.random() * gameData.speedTap.length)];
    room.currentQuestion = challenge;
    room.votes = new Map();
    room.startTime = Date.now();
    
    console.log(`⚡ Speed Tap challenge: ${challenge}`);
    
    io.to(roomCode).emit('gameQuestion', {
        gameType: 'speedTap',
        question: challenge,
        countdown: 3
    });
    
    // Start countdown
    let countdown = 3;
    const countdownInterval = setInterval(() => {
        io.to(roomCode).emit('countdown', { count: countdown });
        countdown--;
        
        if (countdown < 0) {
            clearInterval(countdownInterval);
            io.to(roomCode).emit('gameStart');
        }
    }, 1000);
}

function startQuiz(roomCode) {
    const room = rooms.get(roomCode);
    if (!room) return;
    
    const question = gameData.quiz[Math.floor(Math.random() * gameData.quiz.length)];
    room.currentQuestion = question;
    room.votes = new Map();
    
    console.log(`🧠 Quiz question: ${question.question}`);
    
    io.to(roomCode).emit('gameQuestion', {
        gameType: 'quiz',
        question: question.question,
        options: question.options,
        timeLimit: 15
    });
}

function processVotes(roomCode) {
    const room = rooms.get(roomCode);
    if (!room) return;
    
    console.log(`📊 Processing votes for room ${roomCode}`);
    
    // Count votes
    const voteCounts = new Map();
    const playerVotes = new Map();
    
    for (const [playerId, vote] of room.votes) {
        const player = room.players.get(playerId);
        if (player) {
            playerVotes.set(playerId, { player: player, vote: vote });
            
            if (!voteCounts.has(vote)) {
                voteCounts.set(vote, 0);
            }
            voteCounts.set(vote, voteCounts.get(vote) + 1);
        }
    }
    
    // Find winner(s)
    let maxVotes = 0;
    let winners = [];
    
    for (const [playerId, count] of voteCounts) {
        if (count > maxVotes) {
            maxVotes = count;
            winners = [playerId];
        } else if (count === maxVotes) {
            winners.push(playerId);
        }
    }
    
    // Award points
    for (const winnerId of winners) {
        const currentScore = room.scores.get(winnerId) || 0;
        room.scores.set(winnerId, currentScore + 10);
        
        const player = room.players.get(winnerId);
        if (player) {
            player.score = room.scores.get(winnerId);
        }
    }
    
    // Send results
    io.to(roomCode).emit('gameResults', {
        question: room.currentQuestion,
        voteCounts: Object.fromEntries(voteCounts),
        playerVotes: Object.fromEntries(playerVotes),
        winners: winners,
        scores: Object.fromEntries(room.scores)
    });
    
    // Clear votes for next round
    room.votes.clear();
    
    // Auto-advance to next question after 5 seconds
    setTimeout(() => {
        if (room.gameState === 'playing') {
            startGame(roomCode, room.currentGame);
        }
    }, 5000);
}

// ============================================================================
// EXPRESS ROUTES
// ============================================================================

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API Routes for Vercel compatibility
app.get('/api/room/:roomCode', (req, res) => {
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
        gameState: room.gameState,
        type: 'roomUpdate'
    });
});

// Create room API
app.post('/api/room/create', async (req, res) => {
    try {
        const { hostName, gameType } = req.body;
        const roomCode = generateRoomCode();
        
        // Create room in database
        await createRoomInDB({
            code: roomCode,
            hostName: hostName,
            hostId: 'api_' + Date.now(),
            gameType: gameType || 'mixed',
            maxPlayers: 8,
            settings: {
                gameDuration: 30,
                categories: ['spicy', 'funny', 'sport', 'movie']
            }
        });

        // Create room in memory
        const room = {
            code: roomCode,
            host: 'api_' + Date.now(),
            hostName: hostName,
            gameType: gameType || 'mixed',
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
        
        rooms.set(roomCode, room);
        
        res.json({
            roomCode: roomCode,
            room: {
                code: roomCode,
                hostName: hostName,
                gameType: gameType,
                playerCount: 0,
                players: []
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
        const room = rooms.get(roomCode);
        
        if (!room) {
            return res.status(404).json({ error: 'Room not found' });
        }
        
        if (room.players.size >= room.settings.maxPlayers) {
            return res.status(400).json({ error: 'Room is full' });
        }
        
        if (room.gameState !== 'lobby') {
            return res.status(400).json({ error: 'Game already started' });
        }
        
        // Add player to database
        await addPlayerToDB(roomCode, {
            socketId: 'api_' + Date.now(),
            name: playerName,
            avatar: generateAvatar(),
            isHost: false
        });

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

// Submit vote API
app.post('/api/game/vote', async (req, res) => {
    try {
        const { roomCode, playerId, vote, voteType } = req.body;
        const room = rooms.get(roomCode);
        
        if (!room || room.gameState !== 'playing') {
            return res.status(400).json({ error: 'Game not active' });
        }
        
        // Log game event in database
        await logGameEvent(roomCode, playerId, 'vote', {
            vote: vote,
            voteType: voteType || 'player_vote',
            roundNumber: room.currentRound || 1,
            gamePhase: 'playing',
            responseTime: 0
        });

        // Store the vote
        if (!room.votes) room.votes = new Map();
        room.votes.set(playerId, { vote, voteType });
        
        console.log(`🗳️ Vote submitted by ${playerId}:`, { vote, voteType });
        
        // Check if all players have voted
        if (room.votes.size === room.players.size) {
            processVotes(roomCode);
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Error submitting vote:', error);
        res.status(500).json({ error: 'Failed to submit vote' });
    }
});

// Start game API
app.post('/api/game/start', async (req, res) => {
    try {
        const { roomCode, gameType } = req.body;
        const room = rooms.get(roomCode);
        
        if (!room) {
            return res.status(404).json({ error: 'Room not found' });
        }
        
        if (room.players.size < 2) {
            return res.status(400).json({ error: 'Need at least 2 players' });
        }
        
        // Update room status in database
        await updateRoomStatus(roomCode, 'playing', {
            game_type: gameType || 'mostLikelyTo'
        });

        room.gameState = 'playing';
        room.currentGame = gameType || 'mostLikelyTo';
        
        console.log(`🎮 Game started in room ${roomCode}: ${room.currentGame}`);
        
        // Start the specific game
        startGame(roomCode, room.currentGame);
        
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Error starting game:', error);
        res.status(500).json({ error: 'Failed to start game' });
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

server.listen(PORT, () => {
    console.log(`🚀 Drankspel Multiplayer Server running on port ${PORT}`);
    console.log(`🌐 Open http://localhost:${PORT} to start playing!`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Server shutting down...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});
