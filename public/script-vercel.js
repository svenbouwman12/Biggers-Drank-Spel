// ============================================================================
// DRANKSPEL MULTIPLAYER - Vercel-Compatible Frontend
// ============================================================================
// Alternative implementation using polling instead of WebSockets for Vercel compatibility

// Global variables
let currentRoom = null;
let currentPlayer = null;
let gameState = {
    players: [],
    currentGame: null,
    currentQuestion: null,
    scores: {},
    round: 1,
    maxRounds: 5
};

let pollingInterval = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🎉 Drankspel Multiplayer loaded (Vercel mode)!');
    
    // Setup event listeners
    setupEventListeners();
    
    // Check for room code in URL
    checkUrlForRoomCode();
    
    // Show home screen
    showScreen('homeScreen');
});

// ============================================================================
// POLLING-BASED REAL-TIME SYSTEM
// ============================================================================

function startPolling(roomCode) {
    console.log('🔄 Starting polling for room:', roomCode);
    
    if (pollingInterval) {
        clearInterval(pollingInterval);
    }
    
    pollingInterval = setInterval(async () => {
        try {
            const response = await fetch(`/api/room/${roomCode}`);
            if (response.ok) {
                const data = await response.json();
                handleRoomUpdate(data);
                reconnectAttempts = 0;
            } else {
                console.warn('⚠️ Polling failed, will retry...');
                handleConnectionError();
            }
        } catch (error) {
            console.error('❌ Polling error:', error);
            handleConnectionError();
        }
    }, 1000); // Poll every second
}

function stopPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
}

function handleConnectionError() {
    reconnectAttempts++;
    if (reconnectAttempts >= maxReconnectAttempts) {
        console.error('❌ Max reconnection attempts reached');
        showNotification('Connection lost. Please refresh the page.', 'error');
        stopPolling();
    }
}

// ============================================================================
// API COMMUNICATION
// ============================================================================

async function createRoom(roomData) {
    try {
        const response = await fetch('/api/room/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(roomData)
        });
        
        if (!response.ok) {
            throw new Error('Failed to create room');
        }
        
        const data = await response.json();
        console.log('🏠 Room created:', data);
        
        currentRoom = data.roomCode;
        currentPlayer = {
            id: generatePlayerId(),
            name: roomData.hostName,
            isHost: true
        };
        
        startPolling(data.roomCode);
        showLobby(data.room);
        generateQRCode(data.roomCode);
        
    } catch (error) {
        console.error('❌ Error creating room:', error);
        showNotification('Failed to create room', 'error');
    }
}

async function joinRoom(roomData) {
    try {
        const response = await fetch('/api/room/join', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(roomData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to join room');
        }
        
        const data = await response.json();
        console.log('👤 Player joined:', data);
        
        currentRoom = roomData.roomCode;
        currentPlayer = {
            id: generatePlayerId(),
            name: roomData.playerName,
            isHost: false
        };
        
        startPolling(roomData.roomCode);
        showLobby(data.room);
        
    } catch (error) {
        console.error('❌ Error joining room:', error);
        showNotification(error.message || 'Failed to join room', 'error');
    }
}

async function submitVote(voteData) {
    try {
        const response = await fetch('/api/game/vote', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                roomCode: currentRoom,
                playerId: currentPlayer.id,
                ...voteData
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to submit vote');
        }
        
        console.log('🗳️ Vote submitted:', voteData);
        showNotification('Vote submitted!', 'success');
        
    } catch (error) {
        console.error('❌ Error submitting vote:', error);
        showNotification('Failed to submit vote', 'error');
    }
}

async function startGame(gameType) {
    try {
        const response = await fetch('/api/game/start', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                roomCode: currentRoom,
                gameType: gameType
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to start game');
        }
        
        console.log('🎮 Game started:', gameType);
        
    } catch (error) {
        console.error('❌ Error starting game:', error);
        showNotification('Failed to start game', 'error');
    }
}

// ============================================================================
// ROOM UPDATE HANDLER
// ============================================================================

function handleRoomUpdate(data) {
    console.log('📡 Room update received:', data);
    
    // Update game state
    if (data.gameState) {
        gameState = { ...gameState, ...data.gameState };
    }
    
    // Handle different update types
    switch (data.type) {
        case 'playerJoined':
            handlePlayerJoined(data);
            break;
        case 'playerLeft':
            handlePlayerLeft(data);
            break;
        case 'gameStarted':
            handleGameStarted(data);
            break;
        case 'gameQuestion':
            handleGameQuestion(data);
            break;
        case 'gameResults':
            handleGameResults(data);
            break;
        case 'hostChanged':
            handleHostChanged(data);
            break;
        default:
            // General room update
            updateLobby(data.room);
            break;
    }
}

function handlePlayerJoined(data) {
    console.log('👤 Player joined:', data.player);
    updateLobby(data.room);
    showNotification(`${data.player.name} joined the game!`, 'success');
}

function handlePlayerLeft(data) {
    console.log('👋 Player left:', data.playerName);
    updateLobby(data.room);
    showNotification(`${data.playerName} left the game`, 'info');
}

function handleGameStarted(data) {
    console.log('🎮 Game started:', data);
    gameState.currentGame = data.gameType;
    gameState.players = data.players;
    showScreen('gameScreen');
    updateGameHeader();
}

function handleGameQuestion(data) {
    console.log('❓ Game question:', data);
    gameState.currentQuestion = data;
    displayGameQuestion(data);
}

function handleGameResults(data) {
    console.log('🏆 Game results:', data);
    showScreen('resultsScreen');
    displayResults(data);
}

function handleHostChanged(data) {
    console.log('👑 Host changed:', data.newHost);
    if (data.newHost.id === currentPlayer.id) {
        currentPlayer.isHost = true;
        showNotification('You are now the host!', 'success');
    }
    updateLobby();
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function generatePlayerId() {
    return 'player_' + Math.random().toString(36).substr(2, 9);
}

// ============================================================================
// EXISTING FUNCTIONS (from script.js)
// ============================================================================

// Copy all existing functions from script.js here...
// (All the screen navigation, form handlers, game functions, etc.)

// ============================================================================
// SCREEN NAVIGATION
// ============================================================================

function showScreen(screenId) {
    console.log(`📱 Switching to screen: ${screenId}`);
    
    // Hide all screens
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => screen.classList.remove('active'));
    
    // Show target screen
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
        console.log(`📱 Screen switched to: ${screenId}`);
    } else {
        console.error(`❌ Screen not found: ${screenId}`);
    }
}

function showHome() {
    showScreen('homeScreen');
}

function showHostForm() {
    showScreen('hostForm');
}

function showJoinForm() {
    showScreen('joinForm');
}

// ============================================================================
// FORM HANDLERS
// ============================================================================

function setupEventListeners() {
    // Host form
    document.getElementById('hostGameForm').addEventListener('submit', handleHostSubmit);
    
    // Join form
    document.getElementById('joinGameForm').addEventListener('submit', handleJoinSubmit);
    
    // Room code input - auto uppercase
    document.getElementById('roomCode').addEventListener('input', function(e) {
        e.target.value = e.target.value.toUpperCase();
    });
}

function handleHostSubmit(e) {
    e.preventDefault();
    
    const hostName = document.getElementById('hostName').value.trim();
    const gameType = document.getElementById('gameType').value;
    
    if (!hostName) {
        showNotification('Please enter your name', 'error');
        return;
    }
    
    showLoading('Creating room...');
    
    createRoom({
        hostName: hostName,
        gameType: gameType
    });
}

function handleJoinSubmit(e) {
    e.preventDefault();
    
    const playerName = document.getElementById('playerName').value.trim();
    const roomCode = document.getElementById('roomCode').value.trim().toUpperCase();
    
    if (!playerName || !roomCode) {
        showNotification('Please enter your name and room code', 'error');
        return;
    }
    
    showLoading('Joining room...');
    
    joinRoom({
        playerName: playerName,
        roomCode: roomCode
    });
}

// ============================================================================
// LOBBY FUNCTIONS
// ============================================================================

function showLobby(room) {
    console.log('🏠 Showing lobby:', room);
    
    currentRoom = room.code;
    updateLobby(room);
    showScreen('lobbyScreen');
}

function updateLobby(room = null) {
    if (!room) {
        // Get room info from server
        fetch(`/api/room/${currentRoom}`)
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    showNotification('Room not found', 'error');
                    showHome();
                    return;
                }
                updateLobby(data);
            })
            .catch(error => {
                console.error('Error fetching room info:', error);
            });
        return;
    }
    
    // Update room info
    document.getElementById('currentRoomCode').textContent = room.code;
    document.getElementById('playerCount').textContent = room.playerCount;
    
    // Update players grid
    const playersGrid = document.getElementById('playersGrid');
    playersGrid.innerHTML = '';
    
    room.players.forEach(player => {
        const playerCard = document.createElement('div');
        playerCard.className = `player-card ${player.isHost ? 'host' : ''}`;
        playerCard.innerHTML = `
            <div class="player-avatar">${player.avatar}</div>
            <div class="player-name">${player.name}</div>
            <div class="player-status">${player.isHost ? 'Host' : 'Player'}</div>
        `;
        playersGrid.appendChild(playerCard);
    });
    
    // Update start button
    const startBtn = document.getElementById('startGameBtn');
    if (startBtn) {
        startBtn.disabled = !currentPlayer?.isHost || room.playerCount < 2;
        startBtn.style.opacity = startBtn.disabled ? '0.5' : '1';
    }
}

function startGame() {
    if (!currentPlayer?.isHost) {
        showNotification('Only the host can start the game', 'error');
        return;
    }
    
    const gameType = gameState.currentGame || 'mostLikelyTo';
    
    startGame(gameType);
}

function leaveLobby() {
    stopPolling();
    
    currentRoom = null;
    currentPlayer = null;
    gameState = {
        players: [],
        currentGame: null,
        currentQuestion: null,
        scores: {},
        round: 1,
        maxRounds: 5
    };
    
    showHome();
}

// ============================================================================
// GAME FUNCTIONS
// ============================================================================

function updateGameHeader() {
    const gameTitle = document.getElementById('gameTitle');
    const currentRound = document.getElementById('currentRound');
    
    if (gameTitle) {
        const gameNames = {
            'mostLikelyTo': '🗳️ Most Likely To',
            'truthOrDrink': '🍺 Truth or Drink',
            'speedTap': '⚡ Speed Tap',
            'quiz': '🧠 Quiz'
        };
        gameTitle.textContent = gameNames[gameState.currentGame] || '🎮 Game';
    }
    
    if (currentRound) {
        currentRound.textContent = gameState.round;
    }
}

function displayGameQuestion(data) {
    const gameContent = document.getElementById('gameContent');
    const gameActions = document.getElementById('gameActions');
    
    if (!gameContent || !gameActions) return;
    
    switch (data.gameType) {
        case 'mostLikelyTo':
            displayMostLikelyTo(data);
            break;
        case 'truthOrDrink':
            displayTruthOrDrink(data);
            break;
        case 'speedTap':
            displaySpeedTap(data);
            break;
        case 'quiz':
            displayQuiz(data);
            break;
    }
}

function displayMostLikelyTo(data) {
    const gameContent = document.getElementById('gameContent');
    const gameActions = document.getElementById('gameActions');
    
    gameContent.innerHTML = `
        <div class="game-question">
            <h3>${data.question}</h3>
            <p>Wie denk je dat het meest waarschijnlijk is?</p>
        </div>
    `;
    
    gameActions.innerHTML = `
        <div class="game-options">
            ${data.players.map(player => `
                <div class="game-option" onclick="submitVote({vote: '${player.id}', voteType: 'player_vote'})">
                    <div class="player-avatar">${player.avatar}</div>
                    <div class="player-name">${player.name}</div>
                </div>
            `).join('')}
        </div>
    `;
}

function displayTruthOrDrink(data) {
    const gameContent = document.getElementById('gameContent');
    const gameActions = document.getElementById('gameActions');
    
    gameContent.innerHTML = `
        <div class="game-question">
            <h3>${data.question}</h3>
            <p>Kies je antwoord:</p>
        </div>
    `;
    
    gameActions.innerHTML = `
        <div class="game-options">
            <div class="game-option" onclick="submitVote({vote: 'truth', voteType: 'truth_drink'})">
                <span class="button-icon">💬</span>
                <span class="button-text">Waarheid</span>
            </div>
            <div class="game-option" onclick="submitVote({vote: 'drink', voteType: 'truth_drink'})">
                <span class="button-icon">🍺</span>
                <span class="button-text">Drink</span>
            </div>
        </div>
    `;
}

function displaySpeedTap(data) {
    const gameContent = document.getElementById('gameContent');
    const gameActions = document.getElementById('gameActions');
    
    gameContent.innerHTML = `
        <div class="game-question">
            <h3>${data.question}</h3>
            <p>Wacht op het start signaal!</p>
        </div>
    `;
    
    gameActions.innerHTML = `
        <div class="game-options">
            <div class="game-option" id="speedTapButton" onclick="submitVote({vote: 'tap', voteType: 'speed_tap'})" style="display: none;">
                <span class="button-icon">👆</span>
                <span class="button-text">TAP!</span>
            </div>
        </div>
    `;
}

function displayQuiz(data) {
    const gameContent = document.getElementById('gameContent');
    const gameActions = document.getElementById('gameActions');
    
    gameContent.innerHTML = `
        <div class="game-question">
            <h3>${data.question}</h3>
            <p>Kies het juiste antwoord:</p>
        </div>
    `;
    
    gameActions.innerHTML = `
        <div class="game-options">
            ${data.options.map((option, index) => `
                <div class="game-option" onclick="submitVote({vote: ${index}, voteType: 'quiz_answer'})">
                    <span class="button-text">${option}</span>
                </div>
            `).join('')}
        </div>
    `;
}

function displayResults(data) {
    const resultsContent = document.getElementById('resultsContent');
    
    if (!resultsContent) return;
    
    let html = `
        <div class="winner-display">
            <h3>🏆 Results</h3>
            <p>Question: ${data.question}</p>
        </div>
    `;
    
    // Show vote counts
    if (data.voteCounts) {
        html += '<div class="vote-results">';
        for (const [playerId, count] of Object.entries(data.voteCounts)) {
            const player = gameState.players.find(p => p.id === playerId);
            if (player) {
                html += `
                    <div class="vote-item">
                        <span class="player-name">${player.name}</span>
                        <span class="vote-count">${count} votes</span>
                    </div>
                `;
            }
        }
        html += '</div>';
    }
    
    // Show scores
    if (data.scores) {
        html += '<div class="scores-board"><h3>📊 Scores</h3>';
        const sortedScores = Object.entries(data.scores).sort((a, b) => b[1] - a[1]);
        sortedScores.forEach(([playerId, score]) => {
            const player = gameState.players.find(p => p.id === playerId);
            if (player) {
                html += `
                    <div class="score-item">
                        <div class="player-info">
                            <span class="player-avatar">${player.avatar}</span>
                            <span class="player-name">${player.name}</span>
                        </div>
                        <div class="player-score">${score}</div>
                    </div>
                `;
            }
        });
        html += '</div>';
    }
    
    resultsContent.innerHTML = html;
}

function nextRound() {
    gameState.round++;
    
    if (gameState.round > gameState.maxRounds) {
        // Game finished
        showGameFinished();
    } else {
        // Continue to next round
        showScreen('gameScreen');
        updateGameHeader();
        
        // Request next question
        fetch('/api/game/next-round', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                roomCode: currentRoom
            })
        });
    }
}

function showGameFinished() {
    const resultsContent = document.getElementById('resultsContent');
    
    if (resultsContent) {
        resultsContent.innerHTML = `
            <div class="winner-display">
                <h3>🎉 Game Finished!</h3>
                <p>Thanks for playing!</p>
            </div>
        `;
    }
    
    showScreen('resultsScreen');
}

function backToLobby() {
    showScreen('lobbyScreen');
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function showLoading(message = 'Loading...') {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.querySelector('p').textContent = message;
        overlay.style.display = 'flex';
    }
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    const notificationText = document.getElementById('notificationText');
    
    if (notification && notificationText) {
        notificationText.textContent = message;
        notification.className = `notification ${type} show`;
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }
}

function generateQRCode(roomCode) {
    const qrContainer = document.getElementById('qrCode');
    if (qrContainer) {
        qrContainer.innerHTML = `
            <img src="/api/qr/${roomCode}" alt="QR Code for room ${roomCode}" style="max-width: 200px;">
            <p>Scan to join room ${roomCode}</p>
        `;
    }
}

function checkUrlForRoomCode() {
    const urlParams = new URLSearchParams(window.location.search);
    const roomCode = urlParams.get('room');
    
    if (roomCode) {
        document.getElementById('roomCode').value = roomCode;
        showJoinForm();
    }
}

// ============================================================================
// END OF FILE
// ============================================================================
