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
    currentRoom = data.roomCode;
    currentPlayer = {
        id: data.room.players[0].id,
        name: data.room.players[0].name,
        isHost: true
    };
    
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
    
    // Update lobby display
    document.getElementById('lobbyRoomCode').textContent = room.code;
    document.getElementById('lobbyHostName').textContent = room.hostName;
    document.getElementById('lobbyPlayerCount').textContent = `${room.playerCount}/8`;
    
    // Update players list
    const playersList = document.getElementById('playersList');
    playersList.innerHTML = '';
    
    room.players.forEach(player => {
        const playerElement = document.createElement('div');
        playerElement.className = 'player-item';
        playerElement.innerHTML = `
            <span class="player-avatar">${player.avatar}</span>
            <span class="player-name">${player.name}</span>
            ${player.isHost ? '<span class="host-badge">Host</span>' : ''}
        `;
        playersList.appendChild(playerElement);
    });
    
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
    
    const gameType = gameState.currentGame || 'mostLikelyTo';
    startGameAPI(gameType);
}

async function startGameAPI(gameType) {
    try {
        console.log('🎮 Starting game via API:', gameType);
        
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
            handleGameStarted(data);
        } else {
            const error = await response.json();
            console.error('❌ Failed to start game:', error);
            showNotification(error.error || 'Failed to start game', 'error');
        }
    } catch (error) {
        console.error('❌ Error starting game:', error);
        showNotification('Failed to start game', 'error');
    }
}

function handleGameStarted(data) {
    console.log('🎮 Game started:', data);
    showNotification('Game started!', 'success');
    // TODO: Implement game screen
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
                    updateLobby(data);
                    currentRoomData = data;
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
        showLobby(data);
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
    showNotification('Next round functionality coming soon!', 'info');
}

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
            const qrImage = document.getElementById('qrCode');
            if (qrImage) {
                qrImage.src = data.qrCode;
                qrImage.style.display = 'block';
            }
        }
    } catch (error) {
        console.error('❌ Error generating QR code:', error);
    }
}

// ============================================================================
// END OF FILE
// ============================================================================
