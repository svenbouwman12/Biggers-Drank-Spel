// ============================================================================
// DRANKSPEL MULTIPLAYER - Node.js + Express + Socket.IO Backend
// ============================================================================

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const QRCode = require('qrcode');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
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
    socket.on('createRoom', (data) => {
        const { hostName, gameType } = data;
        const roomCode = generateRoomCode();
        
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
    });

    // Join existing room
    socket.on('joinRoom', (data) => {
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
    });

    // Start game
    socket.on('startGame', (data) => {
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
        
        room.gameState = 'playing';
        room.currentGame = data.gameType || 'mostLikelyTo';
        
        console.log(`🎮 Game started in room ${roomCode}: ${room.currentGame}`);
        
        io.to(roomCode).emit('gameStarted', {
            gameType: room.currentGame,
            players: Array.from(room.players.values())
        });
        
        // Start the specific game
        startGame(roomCode, room.currentGame);
    });

    // Submit vote/answer
    socket.on('submitVote', (data) => {
        const roomCode = players.get(socket.id);
        const room = rooms.get(roomCode);
        
        if (!room || room.gameState !== 'playing') {
            return;
        }
        
        const player = room.players.get(socket.id);
        if (!player) return;
        
        // Store the vote
        if (!room.votes) room.votes = new Map();
        room.votes.set(socket.id, data);
        
        console.log(`🗳️ Vote submitted by ${player.name}:`, data);
        
        // Check if all players have voted
        if (room.votes.size === room.players.size) {
            processVotes(roomCode);
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
    socket.on('disconnect', () => {
        const roomCode = players.get(socket.id);
        const room = rooms.get(roomCode);
        
        if (room) {
            const player = room.players.get(socket.id);
            
            if (player) {
                console.log(`👋 Player left: ${player.name} from room ${roomCode}`);
                
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

// Generate QR code for room
app.get('/qr/:roomCode', async (req, res) => {
    try {
        const roomCode = req.params.roomCode;
        const qrCode = await QRCode.toDataURL(`http://localhost:3000?room=${roomCode}`);
        res.json({ qrCode });
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate QR code' });
    }
});

// Get room info
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
