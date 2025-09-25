// ============================================================================
// DRANKSPEL MULTIPLAYER - Frontend JavaScript
// ============================================================================

// Global variables
let socket;
let currentRoom = null;
let currentPlayer = null;
let currentRoomData = null;
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
    
    // Initialize socket connection
    initializeSocket();
    
    // Setup event listeners
    setupEventListeners();
    
    // Check for room code in URL
    checkUrlForRoomCode();
    
    // Show home screen
    showScreen('homeScreen');
});

// ============================================================================
// SOCKET CONNECTION
// ============================================================================

function initializeSocket() {
    try {
        console.log('🔌 Initializing Socket.IO connection...');
        
        socket = io({
            transports: ['polling'],
            timeout: 15000,
            forceNew: true,
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5
        });
        
        // Connection events
        socket.on('connect', () => {
            console.log('🔌 Connected to server successfully');
            hideLoading();
        });
        
        socket.on('disconnect', (reason) => {
            console.log('🔌 Disconnected from server:', reason);
            if (reason === 'io server disconnect') {
                // Server disconnected, try to reconnect
                showNotification('Server disconnected. Reconnecting...', 'error');
            } else {
                showNotification('Connection lost. Reconnecting...', 'error');
            }
        });
        
        // connect_error handler moved below
        
        socket.on('reconnect', (attemptNumber) => {
            console.log('🔄 Reconnected after', attemptNumber, 'attempts');
            showNotification('Reconnected successfully!', 'success');
        });
        
        socket.on('reconnect_error', (error) => {
            console.error('❌ Reconnection error:', error);
        });
        
        socket.on('reconnect_failed', () => {
            console.error('❌ Reconnection failed, switching to API mode');
            showNotification('Connection failed. Using API mode...', 'error');
            initializeAPIFallback();
        });
        
        // Add immediate fallback on connection error
        socket.on('connect_error', (error) => {
            console.error('❌ Connection error:', error);
            showNotification('Socket.IO failed. Switching to API mode...', 'error');
            // Immediately switch to API mode if Socket.IO fails
            setTimeout(() => {
                if (!socket || !socket.connected) {
                    console.log('🔄 Switching to API mode due to connection failure');
                    initializeAPIFallback();
                }
            }, 2000);
        });
        
        // Add a timeout to hide loading if connection takes too long
        setTimeout(() => {
            if (!socket || !socket.connected) {
                console.log('⏰ Connection timeout, hiding loading');
                hideLoading();
            }
        }, 5000);
        
        // Room events
        socket.on('roomCreated', handleRoomCreated);
        socket.on('playerJoined', handlePlayerJoined);
        socket.on('playerLeft', handlePlayerLeft);
        socket.on('hostChanged', handleHostChanged);
        socket.on('roomUpdate', handleRoomUpdate);
        socket.on('error', handleError);
        
        // Game events
        socket.on('gameStarted', handleGameStarted);
        socket.on('gameQuestion', handleGameQuestion);
        socket.on('gameResults', handleGameResults);
        socket.on('countdown', handleCountdown);
        socket.on('gameStart', handleGameStart);
        
    } catch (error) {
        console.error('❌ Failed to initialize socket:', error);
        showNotification('Socket connection failed. Using API mode...', 'error');
        hideLoading();
        initializeAPIFallback();
    }
}

// ============================================================================
// EVENT LISTENERS
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

function handleHostSubmit(e) {
    e.preventDefault();
    
    const hostName = document.getElementById('hostName').value.trim();
    const gameType = document.getElementById('gameType').value;
    
    if (!hostName) {
        showNotification('Please enter your name', 'error');
        return;
    }
    
    showLoading('Creating room...');
    
    socket.emit('createRoom', {
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
    
    socket.emit('joinRoom', {
        playerName: playerName,
        roomCode: roomCode
    });
}

// ============================================================================
// SOCKET EVENT HANDLERS
// ============================================================================

function handleRoomCreated(data) {
    console.log('🏠 Room created:', data);
    
    currentRoom = data.roomCode;
    currentPlayer = {
        id: socket.id,
        name: document.getElementById('hostName').value,
        isHost: true
    };
    
    hideLoading();
    showLobby(data.room);
    generateQRCode(data.roomCode);
}

function handlePlayerJoined(data) {
    console.log('👤 Player joined:', data);
    
    if (currentRoom && currentRoom === data.room.code) {
        updateLobby(data.room);
        showNotification(`${data.player.name} joined the game!`, 'success');
    }
}

function handlePlayerLeft(data) {
    console.log('👋 Player left:', data);
    
    if (currentRoom && currentRoom === data.room.code) {
        updateLobby(data.room);
        showNotification(`${data.playerName} left the game`, 'info');
    }
}

function handleHostChanged(data) {
    console.log('👑 Host changed:', data);
    
    if (currentPlayer && data.newHost.id === socket.id) {
        currentPlayer.isHost = true;
        showNotification('You are now the host!', 'success');
    }
    
    updateLobby();
}

function handleRoomUpdate(data) {
    console.log('🏠 Room update received:', data);
    
    if (currentRoom === data.code) {
        updateLobby(data);
    }
}

function handleError(data) {
    console.error('❌ Error:', data);
    hideLoading();
    showNotification(data.message, 'error');
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

function handleCountdown(data) {
    console.log('⏰ Countdown:', data.count);
    
    const timerElement = document.getElementById('gameTimer');
    if (timerElement) {
        timerElement.textContent = data.count;
        timerElement.style.background = data.count <= 1 ? 'linear-gradient(135deg, #e74c3c, #c0392b)' : 'linear-gradient(135deg, #f39c12, #e67e22)';
    }
}

function handleGameStart() {
    console.log('🚀 Game start!');
    
    const timerElement = document.getElementById('gameTimer');
    if (timerElement) {
        timerElement.textContent = 'GO!';
        timerElement.style.background = 'linear-gradient(135deg, #00b894, #00a085)';
    }
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
        fetch(`/room/${currentRoom}`)
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
    
    socket.emit('startGame', {
        gameType: gameType
    });
}

function leaveLobby() {
    if (socket) {
        socket.disconnect();
    }
    
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
                <div class="game-option" onclick="submitVote('${player.id}')">
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
            <div class="game-option" onclick="submitVote('truth')">
                <span class="button-icon">💬</span>
                <span class="button-text">Waarheid</span>
            </div>
            <div class="game-option" onclick="submitVote('drink')">
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
            <div class="game-option" id="speedTapButton" onclick="submitVote('tap')" style="display: none;">
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
                <div class="game-option" onclick="submitVote(${index})">
                    <span class="button-text">${option}</span>
                </div>
            `).join('')}
        </div>
    `;
}

function submitVote(vote) {
    if (!socket || !currentRoom) return;
    
    console.log('🗳️ Submitting vote:', vote);
    
    socket.emit('submitVote', {
        vote: vote,
        timestamp: Date.now()
    });
    
    // Disable all options
    const options = document.querySelectorAll('.game-option');
    options.forEach(option => {
        option.style.pointerEvents = 'none';
        option.style.opacity = '0.5';
    });
    
    // Highlight selected option
    event.target.closest('.game-option').classList.add('selected');
    
    showNotification('Vote submitted!', 'success');
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
        socket.emit('nextRound');
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
            <img src="/qr/${roomCode}" alt="QR Code for room ${roomCode}" style="max-width: 200px;">
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
// GAME SPECIFIC FUNCTIONS
// ============================================================================

// Speed Tap specific
function handleGameStart() {
    const speedTapButton = document.getElementById('speedTapButton');
    if (speedTapButton) {
        speedTapButton.style.display = 'block';
        speedTapButton.style.background = 'linear-gradient(135deg, #e74c3c, #c0392b)';
        speedTapButton.style.animation = 'pulse 0.5s infinite';
    }
}

// Confetti effect
function createConfetti() {
    const colors = ['#f39c12', '#e74c3c', '#9b59b6', '#3498db', '#2ecc71'];
    
    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDelay = Math.random() * 2 + 's';
        confetti.style.animationDuration = (Math.random() * 3 + 2) + 's';
        
        document.body.appendChild(confetti);
        
        setTimeout(() => {
            confetti.remove();
        }, 5000);
    }
}

// ============================================================================
// API FALLBACK SYSTEM
// ============================================================================

let apiMode = false;
let pollingInterval = null;

function initializeAPIFallback() {
    console.log('🔄 Initializing API fallback system');
    apiMode = true;
    hideLoading();
    showNotification('Using API mode for better compatibility', 'info');
    
    // Update form handlers to use API
    setupAPIFormHandlers();
}

function setupAPIFormHandlers() {
    // Override form handlers to use API instead of Socket.IO
    document.getElementById('hostGameForm').removeEventListener('submit', handleHostSubmit);
    document.getElementById('joinGameForm').removeEventListener('submit', handleJoinSubmit);
    
    document.getElementById('hostGameForm').addEventListener('submit', handleHostSubmitAPI);
    document.getElementById('joinGameForm').addEventListener('submit', handleJoinSubmitAPI);
}

async function handleHostSubmitAPI(e) {
    e.preventDefault();
    
    const hostName = document.getElementById('hostName').value.trim();
    const gameType = document.getElementById('gameType').value;
    
    if (!hostName) {
        showNotification('Please enter your name', 'error');
        return;
    }
    
    showLoading('Creating room...');
    
    try {
        const response = await fetch('/api/room/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ hostName, gameType })
        });
        
        if (!response.ok) {
            throw new Error('Failed to create room');
        }
        
        const data = await response.json();
        console.log('🏠 Room created via API:', data);
        
        currentRoom = data.roomCode;
        currentPlayer = {
            id: 'api_' + Date.now(),
            name: hostName,
            isHost: true
        };
        
        hideLoading();
        showLobby(data.room);
        generateQRCode(data.roomCode);
        
        // Start polling for updates
        startPolling(data.roomCode);
        
    } catch (error) {
        console.error('❌ Error creating room:', error);
        hideLoading();
        showNotification('Failed to create room', 'error');
    }
}

async function handleJoinSubmitAPI(e) {
    e.preventDefault();
    
    const playerName = document.getElementById('playerName').value.trim();
    const roomCode = document.getElementById('roomCode').value.trim().toUpperCase();
    
    if (!playerName || !roomCode) {
        showNotification('Please enter your name and room code', 'error');
        return;
    }
    
    showLoading('Joining room...');
    
    try {
        const response = await fetch('/api/room/join', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ roomCode, playerName })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to join room');
        }
        
        const data = await response.json();
        console.log('👤 Player joined via API:', data);
        
        currentRoom = roomCode;
        currentPlayer = {
            id: 'api_' + Date.now(),
            name: playerName,
            isHost: false
        };
        
        hideLoading();
        showLobby(data.room);
        
        // Start polling for updates
        startPolling(roomCode);
        
    } catch (error) {
        console.error('❌ Error joining room:', error);
        hideLoading();
        showNotification(error.message || 'Failed to join room', 'error');
    }
}

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
                
                updateLobby(data);
                currentRoomData = data;
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

// Override leaveLobby to stop polling
const originalLeaveLobby = leaveLobby;
function leaveLobby() {
    stopPolling();
    originalLeaveLobby();
}

// ============================================================================
// END OF FILE
// ============================================================================
