// ============================================================================
// DRANKSPEL MULTIPLAYER - Debug Version for Vercel
// ============================================================================
// This version uses API calls instead of Socket.IO for better Vercel compatibility

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

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🎉 Drankspel Multiplayer loaded (Debug mode)!');
    
    // Setup event listeners
    setupEventListeners();
    
    // Check for room code in URL
    checkUrlForRoomCode();
    
    // Show home screen
    showScreen('homeScreen');
    
    // Hide loading immediately
    hideLoading();
});

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
    
    console.log('🏠 Creating room:', { hostName, gameType });
    showLoading('Creating room...');
    
    // Simulate room creation for testing
    setTimeout(() => {
        const roomCode = generateRoomCode();
        console.log('🏠 Room created:', roomCode);
        
        currentRoom = roomCode;
        currentPlayer = {
            id: 'player_' + Date.now(),
            name: hostName,
            isHost: true
        };
        
        hideLoading();
        
        // Show lobby with mock data
        const mockRoom = {
            code: roomCode,
            hostName: hostName,
            gameType: gameType,
            playerCount: 1,
            players: [{
                id: currentPlayer.id,
                name: hostName,
                avatar: '🎭',
                isHost: true
            }]
        };
        
        showLobby(mockRoom);
        generateQRCode(roomCode);
        
    }, 1000);
}

function handleJoinSubmit(e) {
    e.preventDefault();
    
    const playerName = document.getElementById('playerName').value.trim();
    const roomCode = document.getElementById('roomCode').value.trim().toUpperCase();
    
    if (!playerName || !roomCode) {
        showNotification('Please enter your name and room code', 'error');
        return;
    }
    
    console.log('🚪 Joining room:', { playerName, roomCode });
    showLoading('Joining room...');
    
    // Simulate joining room for testing
    setTimeout(() => {
        console.log('👤 Player joined:', playerName);
        
        currentRoom = roomCode;
        currentPlayer = {
            id: 'player_' + Date.now(),
            name: playerName,
            isHost: false
        };
        
        hideLoading();
        
        // Show lobby with mock data
        const mockRoom = {
            code: roomCode,
            hostName: 'Host Player',
            gameType: 'mixed',
            playerCount: 2,
            players: [
                {
                    id: 'host_id',
                    name: 'Host Player',
                    avatar: '🎭',
                    isHost: true
                },
                {
                    id: currentPlayer.id,
                    name: playerName,
                    avatar: '🎪',
                    isHost: false
                }
            ]
        };
        
        showLobby(mockRoom);
        
    }, 1000);
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
    if (!room) return;
    
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
    
    console.log('🎮 Starting game...');
    showNotification('Game starting...', 'success');
    
    // Show game screen with mock data
    setTimeout(() => {
        showScreen('gameScreen');
        updateGameHeader();
        displayMockGame();
    }, 1000);
}

function leaveLobby() {
    console.log('🚪 Leaving lobby');
    
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
        gameTitle.textContent = '🗳️ Most Likely To';
    }
    
    if (currentRound) {
        currentRound.textContent = gameState.round;
    }
}

function displayMockGame() {
    const gameContent = document.getElementById('gameContent');
    const gameActions = document.getElementById('gameActions');
    
    if (!gameContent || !gameActions) return;
    
    gameContent.innerHTML = `
        <div class="game-question">
            <h3>Wie zou het eerst een miljoen verdienen?</h3>
            <p>Wie denk je dat het meest waarschijnlijk is?</p>
        </div>
    `;
    
    gameActions.innerHTML = `
        <div class="game-options">
            <div class="game-option" onclick="submitMockVote('player1')">
                <div class="player-avatar">🎭</div>
                <div class="player-name">Host Player</div>
            </div>
            <div class="game-option" onclick="submitMockVote('player2')">
                <div class="player-avatar">🎪</div>
                <div class="player-name">${currentPlayer.name}</div>
            </div>
        </div>
    `;
}

function submitMockVote(playerId) {
    console.log('🗳️ Mock vote submitted:', playerId);
    showNotification('Vote submitted!', 'success');
    
    // Show results after 3 seconds
    setTimeout(() => {
        showScreen('resultsScreen');
        displayMockResults();
    }, 3000);
}

function displayMockResults() {
    const resultsContent = document.getElementById('resultsContent');
    
    if (!resultsContent) return;
    
    resultsContent.innerHTML = `
        <div class="winner-display">
            <h3>🏆 Results</h3>
            <p>Question: Wie zou het eerst een miljoen verdienen?</p>
        </div>
        <div class="vote-results">
            <div class="vote-item">
                <span class="player-name">Host Player</span>
                <span class="vote-count">2 votes</span>
            </div>
            <div class="vote-item">
                <span class="player-name">${currentPlayer.name}</span>
                <span class="vote-count">1 vote</span>
            </div>
        </div>
        <div class="scores-board">
            <h3>📊 Scores</h3>
            <div class="score-item">
                <div class="player-info">
                    <span class="player-avatar">🎭</span>
                    <span class="player-name">Host Player</span>
                </div>
                <div class="player-score">20</div>
            </div>
            <div class="score-item">
                <div class="player-info">
                    <span class="player-avatar">🎪</span>
                    <span class="player-name">${currentPlayer.name}</span>
                </div>
                <div class="player-score">10</div>
            </div>
        </div>
    `;
}

function nextRound() {
    console.log('➡️ Next round');
    gameState.round++;
    
    if (gameState.round > gameState.maxRounds) {
        showGameFinished();
    } else {
        showScreen('gameScreen');
        updateGameHeader();
        displayMockGame();
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

function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 4; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    console.log('🏠 Generated room code (debug):', result, '(length:', result.length + ')');
    return result;
}

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
            <div style="width: 200px; height: 200px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; border-radius: 10px;">
                <div style="text-align: center;">
                    <div style="font-size: 48px;">📱</div>
                    <div style="font-size: 14px; margin-top: 10px;">QR Code</div>
                    <div style="font-size: 12px; color: #666;">Room: ${roomCode}</div>
                </div>
            </div>
            <p>Mock QR code for room ${roomCode}</p>
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
