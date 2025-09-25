// ============================================================================
// DRANKSPEL MULTIPLAYER - Frontend JavaScript (API Mode Only)
// ============================================================================

// Global variables
let currentRoom = null;
let currentPlayer = null;
let currentRoomData = null;
let pollingInterval = null;
let gameState = {
    players: [],
    currentGame: null,
    currentQuestion: null,
    scores: {},
    round: 1,
    maxRounds: 5
};

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🎉 Drankspel Multiplayer loaded!');
    console.log('📡 API Mode: Real-time updates via polling');
    
    hideLoading();
    setupEventListeners();
    
    // Check for room parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const roomCode = urlParams.get('room');
    if (roomCode) {
        document.getElementById('roomCode').value = roomCode;
    }
});

// ============================================================================
// EVENT LISTENERS
// ============================================================================

function setupEventListeners() {
    // Host form
    document.getElementById('hostGameForm').addEventListener('submit', handleHostSubmit);
    
    // Join form
    document.getElementById('joinGameForm').addEventListener('submit', handleJoinSubmit);
    
    // Game controls
    const startBtn = document.getElementById('startGameBtn');
    if (startBtn) {
        startBtn.addEventListener('click', startGame);
    }
    
    const leaveBtn = document.getElementById('leaveLobbyBtn');
    if (leaveBtn) {
        leaveBtn.addEventListener('click', leaveLobby);
    }
}

// ============================================================================
// FORM HANDLERS
// ============================================================================

async function handleHostSubmit(e) {
    e.preventDefault();
    
    const hostName = document.getElementById('hostName').value.trim();
    const gameType = document.getElementById('gameType').value;
    
    if (!hostName) {
        showNotification('Voer een naam in', 'error');
        return;
    }
    
    showLoading('Room aanmaken...');
    
    try {
        const response = await fetch('/api/room/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                hostName: hostName,
                gameType: gameType
            })
        });

        if (response.ok) {
            const data = await response.json();
            console.log('🏠 Room created via API:', data);
            handleRoomCreated(data);
        } else {
            const error = await response.json();
            console.error('❌ Failed to create room:', error);
            hideLoading();
            showNotification(error.error || 'Failed to create room', 'error');
        }
    } catch (error) {
        console.error('❌ Error creating room:', error);
        hideLoading();
        showNotification('Failed to create room', 'error');
    }
}

async function handleJoinSubmit(e) {
    e.preventDefault();
    
    const roomCode = document.getElementById('roomCode').value.trim().toUpperCase();
    const playerName = document.getElementById('playerName').value.trim();
    
    if (!roomCode || !playerName) {
        showNotification('Voer room code en naam in', 'error');
        return;
    }
    
    showLoading('Joining room...');
    
    try {
        const response = await fetch('/api/room/join', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                roomCode: roomCode,
                playerName: playerName
            })
        });

        if (response.ok) {
            const data = await response.json();
            console.log('👤 Player joined via API:', data);
            handlePlayerJoined(data);
        } else {
            const error = await response.json();
            console.error('❌ Failed to join room:', error);
            hideLoading();
            showNotification(error.error || 'Failed to join room', 'error');
        }
    } catch (error) {
        console.error('❌ Error joining room:', error);
        hideLoading();
        showNotification('Failed to join room', 'error');
    }
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

function handleRoomCreated(data) {
    console.log('🏠 Room created data:', data);
    
    currentRoom = data.roomCode;
    
    // Find the host player in the players array
    const hostPlayer = data.room.players.find(player => player.isHost);
    if (hostPlayer) {
        currentPlayer = {
            id: hostPlayer.id,
            name: hostPlayer.name,
            isHost: true
        };
        console.log('👑 Host player set:', currentPlayer);
    } else {
        console.log('⚠️ Host player not found in room data');
        // Fallback: use first player as host
        if (data.room.players && data.room.players.length > 0) {
            currentPlayer = {
                id: data.room.players[0].id,
                name: data.room.players[0].name,
                isHost: true
            };
        }
    }
    
    hideLoading();
    showLobby(data.room);
    generateQRCode(data.roomCode);
    startPolling(data.roomCode);
}

function handlePlayerJoined(data) {
    currentRoom = data.room.code;
    currentPlayer = {
        id: data.player.id,
        name: data.player.name,
        isHost: false
    };
    
    hideLoading();
    showLobby(data.room);
    startPolling(data.room.code);
}

// ============================================================================
// LOBBY FUNCTIONS
// ============================================================================

function showLobby(room) {
    currentRoomData = room;
    
    console.log('🏠 Showing lobby for room:', room);
    console.log('👥 Players in room:', room.players);
    
    // Update lobby display
    const roomCodeElement = document.getElementById('currentRoomCode');
    const playerCountElement = document.getElementById('playerCount');
    
    if (roomCodeElement) {
        roomCodeElement.textContent = room.code;
    }
    
    if (playerCountElement) {
        playerCountElement.textContent = room.playerCount || room.players.length;
    }
    
    // Update players grid
    const playersGrid = document.getElementById('playersGrid');
    if (playersGrid) {
        playersGrid.innerHTML = '';
        
        if (room.players && room.players.length > 0) {
            // Sort players to show host first
            const sortedPlayers = [...room.players].sort((a, b) => {
                if (a.isHost && !b.isHost) return -1;
                if (!a.isHost && b.isHost) return 1;
                return 0;
            });
            
            sortedPlayers.forEach(player => {
                console.log('👤 Adding player to lobby:', player);
                const playerElement = document.createElement('div');
                playerElement.className = `player-item ${player.isHost ? 'host-player' : ''}`;
                playerElement.innerHTML = `
                    <span class="player-avatar">${player.avatar}</span>
                    <span class="player-name">${player.name}</span>
                    ${player.isHost ? '<span class="host-badge">👑 Host</span>' : ''}
                `;
                playersGrid.appendChild(playerElement);
            });
        } else {
            console.log('⚠️ No players found in room.players array');
            playersGrid.innerHTML = '<p class="no-players">No players yet...</p>';
        }
    }
    
    // Update start button
    updateStartButton(room);
    
    showScreen('lobbyScreen');
}

function updateStartButton(room) {
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
    
    const gameType = gameState.currentGame || 'simpleTest';
    startGameAPI(gameType);
}

async function startGameAPI(gameType) {
    const startBtn = document.getElementById('startGameBtn');
    
    // Prevent multiple simultaneous calls
    if (startBtn && startBtn.disabled) {
        console.log('⚠️ Game start already in progress, ignoring duplicate call');
        return;
    }
    
    try {
        console.log('🎮 Starting game via API:', gameType);
        
        // Disable button to prevent double clicks
        if (startBtn) {
            startBtn.disabled = true;
            startBtn.innerHTML = '<span class="button-icon">⏳</span><span class="button-text">Starting...</span>';
        }
        
        const response = await fetch('/api/game/start', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                roomCode: currentRoom,
                gameType: gameType
            })
        });

        if (response.ok) {
            const data = await response.json();
            console.log('✅ Game started via API:', data);
            data.skipNotification = true; // Skip notification since we'll show it in polling
            handleGameStarted(data);
        } else {
            const error = await response.json();
            console.error('❌ Failed to start game:', error);
            showNotification(error.error || 'Failed to start game', 'error');
            
            // Re-enable button on error
            if (startBtn) {
                startBtn.disabled = false;
                startBtn.innerHTML = '<span class="button-icon">🚀</span><span class="button-text">Start Game</span>';
            }
        }
    } catch (error) {
        console.error('❌ Error starting game:', error);
        showNotification('Failed to start game', 'error');
        
        // Re-enable button on error
        if (startBtn) {
            startBtn.disabled = false;
            startBtn.innerHTML = '<span class="button-icon">🚀</span><span class="button-text">Start Game</span>';
        }
    }
}

function handleGameStarted(data) {
    console.log('🎮 Game started:', data);
    
    // Don't show duplicate notification if we already showed one
    if (!data.skipNotification) {
        showNotification('Game started!', 'success');
    }
    
    // Switch to game screen
    showScreen('gameScreen');
    
    // Update game screen with current state
    updateGameScreen(data);
}

function updateGameScreen(data) {
    // Check if we have current game data from polling
    const roomData = currentRoomData;
    const currentGame = roomData && roomData.currentGame;
    
    // Update game title
    const gameTitle = document.getElementById('gameTitle');
    if (gameTitle) {
        gameTitle.textContent = `🎮 Simple Test Game - Room ${currentRoom}`;
    }
    
    // Show the game interface
    const gameContent = document.getElementById('gameContent');
    if (!gameContent) return;
    
    if (currentGame && currentGame.isActive) {
        // Show active game with current round
        gameContent.innerHTML = `
            <div class="game-header">
                <div class="round-info">
                    <span class="round-counter">Round ${currentGame.currentRound}/${currentGame.totalRounds}</span>
                    <span class="game-phase">${currentGame.phase === 'question' ? 'Question Time' : 'Results'}</span>
                </div>
                <div class="timer" id="gameTimer">
                    <span id="timeRemaining">${Math.ceil((currentGame.timeRemaining || 0) / 1000)}s</span>
                </div>
            </div>
            
            ${currentGame.phase === 'question' ? `
                <div class="question-container">
                    <h3 class="question">${currentGame.currentQuestion ? currentGame.currentQuestion.question : 'Loading...'}</h3>
                    <div class="options">
                        ${currentGame.currentQuestion ? currentGame.currentQuestion.options.map((option, index) => `
                            <button class="glass-button option-btn" onclick="selectAnswer(${index})">
                                <span class="button-text">${option}</span>
                            </button>
                        `).join('') : ''}
                    </div>
                </div>
            ` : `
                <div class="results-container">
                    <h3>Round ${currentGame.currentRound} Results</h3>
                    <p>Calculating results...</p>
                </div>
            `}
            
            <div class="game-actions">
                <button class="glass-button secondary" onclick="backToLobby()">
                    <span class="button-icon">🏠</span>
                    <span class="button-text">Back to Lobby</span>
                </button>
            </div>
        `;
        
        // Start timer if question phase
        if (currentGame.phase === 'question') {
            startGameTimer(currentGame.timeRemaining || 30000);
        }
    } else {
        // Show basic game screen (fallback)
        gameContent.innerHTML = `
            <div class="game-question">
                <h3>🎯 Simple Test Game</h3>
                <p>Room: <strong>${currentRoom}</strong></p>
                <p>Players: <strong>${data.players.length}</strong></p>
                <p>This is a simple multiplayer test game!</p>
                
                <div class="game-round">
                    <h4>Current Round: 1</h4>
                    <p class="round-instruction">Say your name</p>
                </div>
                
                <div class="game-actions">
                    <button class="glass-button primary" onclick="nextRound()">
                        <span class="button-icon">▶️</span>
                        <span class="button-text">Next Round</span>
                    </button>
                    
                    <button class="glass-button secondary" onclick="backToLobby()">
                        <span class="button-icon">🏠</span>
                        <span class="button-text">Back to Lobby</span>
                    </button>
                </div>
            </div>
        `;
    }
}

function startGameTimer(duration) {
    const timerElement = document.getElementById('timeRemaining');
    if (!timerElement) return;
    
    let timeLeft = Math.ceil(duration / 1000);
    
    const timer = setInterval(() => {
        timerElement.textContent = `${timeLeft}s`;
        timeLeft--;
        
        if (timeLeft < 0) {
            clearInterval(timer);
            timerElement.textContent = '0s';
        }
    }, 1000);
}

function selectAnswer(answerIndex) {
    console.log(`Selected answer: ${answerIndex}`);
    // TODO: Send answer to server
    showNotification('Answer submitted!', 'success');
}

function leaveLobby() {
    // Stop polling
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
// POLLING SYSTEM
// ============================================================================

function startPolling(roomCode) {
    if (pollingInterval) {
        clearInterval(pollingInterval);
    }
    
    pollingInterval = setInterval(async () => {
        try {
            console.log('🔄 Polling for room updates...');
            const response = await fetch(`/api/room/${roomCode}`);
            if (response.ok) {
                const data = await response.json();
                console.log('📡 Polling response:', data);
                
                // Check if new players joined
                if (data.playerCount > (currentRoomData ? currentRoomData.playerCount : 0)) {
                    const newPlayers = data.players.filter(p => 
                        !currentRoomData || !currentRoomData.players.find(cp => cp.id === p.id)
                    );
                    newPlayers.forEach(player => {
                        showNotification(`${player.name} joined the game!`, 'success');
                    });
                }
                
                // Update lobby if we're in lobby screen
                if (currentRoom === data.code) {
                    // Add small delay after game start to allow database sync
                    if (data.gameState === 'playing' && currentRoomData && currentRoomData.gameState === 'lobby') {
                        console.log('🎮 Game state changed to playing, waiting for database sync...');
                        setTimeout(() => {
                            updateLobby(data);
                            currentRoomData = data;
                        }, 1000); // 1 second delay
                    } else {
                        updateLobby(data);
                        currentRoomData = data;
                    }
                    
                    // Check if we're in game screen and update game state
                    const currentScreen = document.querySelector('.screen.active');
                    if (currentScreen && currentScreen.id === 'gameScreen' && data.currentGame) {
                        console.log('🎮 Updating game screen with new data');
                        updateGameScreen(data);
                    }
                }
            }
        } catch (error) {
            console.error('❌ Polling error:', error);
        }
    }, 2000); // Poll every 2 seconds for better real-time feel
}

function stopPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
}

function updateLobby(data) {
    if (currentRoomData) {
        // Check if game state changed from lobby to playing
        const gameStateChanged = currentRoomData.gameState !== data.gameState;
        
        // Only show lobby if we're not in a game
        if (data.gameState === 'lobby' || data.gameState === 'waiting') {
            showLobby(data);
        } else if (data.gameState === 'playing') {
            // If game state changed to playing, switch to game screen
            if (gameStateChanged && currentRoomData.gameState === 'lobby') {
                console.log('🎮 Game started! Switching to game screen for all players');
                showNotification('🎮 Game started!', 'success');
                handleGameStarted({
                    success: true,
                    gameType: data.gameType || 'mostLikelyTo',
                    players: data.players,
                    playerCount: data.playerCount
                });
            } else {
                // Update current room data but don't switch to lobby
                currentRoomData = data;
                console.log('🎮 Game is active, staying on current screen');
            }
        } else {
            // Fallback: show lobby for unknown states
            showLobby(data);
        }
    }
}

// ============================================================================
// UI FUNCTIONS
// ============================================================================

function showScreen(screenId) {
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => {
        if (screen) {
            screen.style.display = 'none';
        }
    });
    
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.style.display = 'block';
        console.log(`📱 Switching to screen: ${screenId}`);
    } else {
        console.warn(`⚠️ Screen not found: ${screenId}`);
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

function nextRound() {
    console.log('🎮 Next round requested');
    
    // Simple test game rounds
    const rounds = [
        "Say your name",
        "Count to 5",
        "Say 'Hello World'",
        "Wave your hand",
        "Smile!"
    ];
    
    // Get current round (simple counter for now)
    const currentRound = Math.floor(Math.random() * rounds.length) + 1;
    const roundInstruction = rounds[currentRound - 1];
    
    const gameContent = document.getElementById('gameContent');
    if (gameContent) {
        gameContent.innerHTML = `
            <div class="game-question">
                <h3>🎯 Simple Test Game</h3>
                <p>Room: <strong>${currentRoom}</strong></p>
                <p>Players: <strong>${currentRoomData ? currentRoomData.players.length : 0}</strong></p>
                
                <div class="game-round">
                    <h4>Current Round: ${currentRound}</h4>
                    <p class="round-instruction">${roundInstruction}</p>
                </div>
                
                <div class="players-list">
                    <h4>Players in this round:</h4>
                    ${currentRoomData ? currentRoomData.players.map(player => `
                        <div class="player-in-round">
                            <span class="player-avatar">${player.avatar}</span>
                            <span class="player-name">${player.name}</span>
                        </div>
                    `).join('') : ''}
                </div>
                
                <div class="game-actions">
                    <button class="glass-button primary" onclick="nextRound()">
                        <span class="button-icon">▶️</span>
                        <span class="button-text">Next Round</span>
                    </button>
                    
                    <button class="glass-button secondary" onclick="backToLobby()">
                        <span class="button-icon">🏠</span>
                        <span class="button-text">Back to Lobby</span>
                    </button>
                </div>
            </div>
        `;
    }
    
    showNotification(`Round ${currentRound}: ${roundInstruction}`, 'info');
}

// Simple test game - no voting needed

function backToLobby() {
    console.log('🏠 Back to lobby requested');
    if (currentRoom) {
        showScreen('lobbyScreen');
    } else {
        showHome();
    }
}

function showLoading(message = 'Loading...') {
    const loading = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('loadingText');
    
    if (loadingText) {
        loadingText.textContent = message;
    }
    
    if (loading) {
        loading.style.display = 'flex';
    }
}

function hideLoading() {
    const loading = document.getElementById('loadingOverlay');
    if (loading) {
        loading.style.display = 'none';
    }
}

function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    const notificationText = document.getElementById('notificationText');
    
    if (!notification) {
        console.warn('⚠️ Notification element not found');
        return;
    }
    
    if (notificationText) {
        notificationText.textContent = message;
    }
    
    // Remove existing classes
    notification.classList.remove('success', 'error', 'info');
    // Add new class
    notification.classList.add(type);
    
    // Show notification
    notification.style.display = 'block';
    notification.style.opacity = '1';
    
    // Hide after 3 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
            notification.style.display = 'none';
        }, 300);
    }, 3000);
}

async function generateQRCode(roomCode) {
    try {
        const response = await fetch(`/api/qr/${roomCode}`);
        if (response.ok) {
            const data = await response.json();
            const qrContainer = document.getElementById('lobbyQrCode');
            if (qrContainer) {
                qrContainer.innerHTML = `<img src="${data.qrCode}" alt="QR Code for room ${roomCode}" />`;
            }
        }
    } catch (error) {
        console.error('❌ Error generating QR code:', error);
    }
}

// ============================================================================
// END OF FILE
// ============================================================================
