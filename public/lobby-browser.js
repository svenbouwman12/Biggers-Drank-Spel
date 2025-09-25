// ============================================================================
// LOBBY BROWSER - Real-time lobby listing and joining
// ============================================================================

// Global variables
let lobbiesData = [];
let refreshInterval = null;
let selectedLobbyCode = null;

// Initialize the lobby browser
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎮 Lobby Browser loaded!');
    
    // Show lobby browser by default
    showLobbyBrowser();
    
    // Start auto-refresh
    startAutoRefresh();
    
    // Load initial lobbies
    refreshLobbies();
});

// Show lobby browser screen
function showLobbyBrowser() {
    hideAllScreens();
    document.getElementById('lobbyBrowser').classList.add('active');
    document.title = '🎮 Lobby Browser - Biggers Drankspel';
}

// Show join form screen
function showJoinForm() {
    hideAllScreens();
    document.getElementById('joinForm').classList.add('active');
    document.title = '🎯 Join Lobby - Biggers Drankgame';
    
    // Focus on player name input
    setTimeout(() => {
        const playerNameInput = document.getElementById('playerName');
        if (playerNameInput) {
            playerNameInput.focus();
        }
    }, 100);
}

// Hide all screens
function hideAllScreens() {
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => screen.classList.remove('active'));
}

// Start auto-refresh every 3 seconds
function startAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
    
    refreshInterval = setInterval(() => {
        refreshLobbies();
    }, 3000); // 3 seconds
    
    console.log('🔄 Auto-refresh started (every 3 seconds)');
}

// Stop auto-refresh
function stopAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
        console.log('⏹️ Auto-refresh stopped');
    }
}

// Refresh lobbies from server
async function refreshLobbies() {
    try {
        console.log('🔄 Refreshing lobbies...');
        
        // First test the API
        try {
            const testResponse = await fetch('/api/lobbies/test');
            const testData = await testResponse.json();
            console.log('🧪 API test result:', testData);
        } catch (testError) {
            console.error('❌ API test failed:', testError);
            showNotification('API niet bereikbaar', 'error');
            return;
        }
        
        const response = await fetch('/api/lobbies');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('📡 Lobbies API response:', data);
        
        if (data.success) {
            lobbiesData = data.lobbies || [];
            updateLobbiesDisplay();
            console.log(`📋 Loaded ${data.count} lobbies`);
        } else {
            console.error('❌ Failed to load lobbies:', data.error);
            showNotification(`Kon lobbies niet laden: ${data.error}`, 'error');
            
            // Show error details if available
            if (data.details) {
                console.error('Error details:', data.details);
            }
        }
        
    } catch (error) {
        console.error('❌ Error refreshing lobbies:', error);
        showNotification(`Verbindingsfout: ${error.message}`, 'error');
    }
}

// Update the lobbies display
function updateLobbiesDisplay() {
    const loadingState = document.getElementById('lobbiesLoading');
    const noLobbiesState = document.getElementById('noLobbies');
    const lobbiesList = document.getElementById('lobbiesList');
    
    // Hide loading state
    loadingState.classList.add('hidden');
    
    if (lobbiesData.length === 0) {
        // Show no lobbies state
        noLobbiesState.classList.remove('hidden');
        lobbiesList.classList.add('hidden');
    } else {
        // Show lobbies list
        noLobbiesState.classList.add('hidden');
        lobbiesList.classList.remove('hidden');
        
        // Render lobbies
        renderLobbies();
    }
}

// Render the lobbies list
function renderLobbies() {
    const lobbiesList = document.getElementById('lobbiesList');
    
    lobbiesList.innerHTML = lobbiesData.map(lobby => {
        const statusIcon = lobby.status === 'playing' ? '🎮' : '⏳';
        const statusText = lobby.status === 'playing' ? 'Spel bezig' : 'Wachten';
        const timeAgo = getTimeAgo(lobby.createdAt);
        
        return `
            <div class="lobby-item ${!lobby.canJoin ? 'disabled' : ''}" 
                 onclick="${lobby.canJoin ? `selectLobby('${lobby.code}')` : ''}">
                <div class="lobby-header">
                    <div class="lobby-code">${lobby.code}</div>
                    <div class="lobby-status ${lobby.status}">
                        <span class="status-icon">${statusIcon}</span>
                        <span class="status-text">${statusText}</span>
                    </div>
                </div>
                
                <div class="lobby-info">
                    <div class="lobby-host">
                        <span class="host-label">Host:</span>
                        <span class="host-name">${lobby.hostName}</span>
                    </div>
                    
                    <div class="lobby-game">
                        <span class="game-label">Game:</span>
                        <span class="game-type">${getGameTypeDisplay(lobby.gameType)}</span>
                    </div>
                </div>
                
                <div class="lobby-players">
                    <div class="players-count">
                        <span class="players-icon">👥</span>
                        <span class="players-text">${lobby.currentPlayers}/${lobby.maxPlayers}</span>
                    </div>
                    
                    <div class="players-list">
                        ${lobby.players.map(player => `
                            <span class="player-avatar">${player.avatar}</span>
                        `).join('')}
                        ${Array.from({length: lobby.maxPlayers - lobby.currentPlayers}, () => 
                            '<span class="player-avatar empty">➕</span>'
                        ).join('')}
                    </div>
                </div>
                
                <div class="lobby-meta">
                    <span class="lobby-time">${timeAgo}</span>
                    ${lobby.canJoin ? '<span class="join-hint">Klik om te joinen</span>' : '<span class="join-hint disabled">Vol of gestart</span>'}
                </div>
                
                ${lobby.canJoin ? `
                    <div class="lobby-actions">
                        <button class="glass-button primary small" onclick="event.stopPropagation(); selectLobby('${lobby.code}')">
                            <span class="button-icon">🚀</span>
                            <span class="button-text">Join</span>
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

// Select a lobby and show join form
function selectLobby(roomCode) {
    selectedLobbyCode = roomCode;
    showJoinForm();
    
    // Pre-fill room code in join form (if there's an input for it)
    const roomCodeInput = document.getElementById('roomCode');
    if (roomCodeInput) {
        roomCodeInput.value = roomCode;
    }
    
    showNotification(`Lobby ${roomCode} geselecteerd!`, 'success');
}

// Join room from browser
async function joinRoomFromBrowser() {
    const playerName = document.getElementById('playerName').value.trim();
    
    if (!playerName) {
        showNotification('Voer je naam in!', 'error');
        return;
    }
    
    if (!selectedLobbyCode) {
        showNotification('Geen lobby geselecteerd!', 'error');
        return;
    }
    
    showLoading('Joinen...');
    
    try {
        const response = await fetch('/api/room/join', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                roomCode: selectedLobbyCode,
                playerName: playerName
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification(`Welkom ${playerName}!`, 'success');
            
            // Store player info
            localStorage.setItem('currentPlayer', JSON.stringify({
                id: data.playerId,
                name: playerName,
                avatar: data.avatar,
                isHost: false
            }));
            
            localStorage.setItem('currentRoom', selectedLobbyCode);
            
            // Redirect to main game page
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1500);
            
        } else {
            showNotification(data.error || 'Kon niet joinen', 'error');
        }
        
    } catch (error) {
        console.error('❌ Error joining room:', error);
        showNotification('Verbindingsfout bij joinen', 'error');
    } finally {
        hideLoading();
    }
}

// Get time ago string
function getTimeAgo(timestamp) {
    const now = new Date();
    const created = new Date(timestamp);
    const diffMs = now - created;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Net aangemaakt';
    if (diffMins < 60) return `${diffMins} min geleden`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} uur geleden`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} dag${diffDays > 1 ? 'en' : ''} geleden`;
}

// Get game type display name
function getGameTypeDisplay(gameType) {
    const gameTypes = {
        'balletjeBalletje': '🎯 Balletje Balletje',
        'mixed': '🎮 Mixed Games',
        'mostLikelyTo': '🎭 Most Likely To',
        'truthOrDrink': '🍺 Truth or Drink',
        'speedTap': '⚡ Speed Tap',
        'quiz': '🧠 Quiz',
        'simpleTest': '🧪 Test Game'
    };
    
    return gameTypes[gameType] || '🎮 Unknown Game';
}

// Navigation functions
function goHome() {
    window.location.href = 'index.html';
}

function createRoom() {
    window.location.href = 'index.html#create';
}

// Utility functions
function showLoading(message = 'Laden...') {
    const overlay = document.getElementById('loadingOverlay');
    const text = overlay.querySelector('.loading-text');
    if (text) text.textContent = message;
    overlay.classList.remove('hidden');
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    overlay.classList.add('hidden');
}

function showNotification(message, type = 'info') {
    const container = document.getElementById('notificationContainer');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <span class="notification-icon">${getNotificationIcon(type)}</span>
        <span class="notification-text">${message}</span>
    `;
    
    container.appendChild(notification);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        notification.remove();
    }, 3000);
    
    // Add click to dismiss
    notification.addEventListener('click', () => {
        notification.remove();
    });
}

function getNotificationIcon(type) {
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    return icons[type] || 'ℹ️';
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    stopAutoRefresh();
});

console.log('📋 Lobby Browser script loaded!');
