// ============================================================================
// LOBBY MANAGEMENT FUNCTIES
// ============================================================================

// Lobby management functies
async function createLobby() {
    const playerName = document.getElementById('playerName').value.trim();
    const roomName = document.getElementById('roomName').value.trim();
    const selectedGame = document.getElementById('selectedGame').value;
    const maxPlayers = parseInt(document.getElementById('maxPlayers').value);
    
    if (!playerName) {
        showNotification('Voer een naam in!', 'error');
        return;
    }
    
    if (!roomName) {
        showNotification('Voer een room naam in!', 'error');
        return;
    }
    
    // Show loading state
    const createBtn = document.getElementById('createLobbyBtn');
    setButtonLoading(createBtn, true);
    
    // Genereer room code en player ID
    const roomCode = generateRoomCode();
    const playerId = generatePlayerId();
    
    // Set player info
    gameState.playerName = playerName;
    gameState.playerId = playerId;
    gameState.isHost = true;
    gameState.roomCode = roomCode;
    gameState.isMultiplayer = true;
    
    // Create room in database
    const roomData = {
        code: roomCode,
        name: roomName,
        gameType: selectedGame,
        maxPlayers: maxPlayers,
        hostId: playerId
    };
    
    try {
        const room = await window.supabaseClient.createRoom(roomData);
        
        if (!room) {
            throw new Error('Fout bij aanmaken lobby');
        }
    } catch (error) {
        console.error('Error creating lobby:', error);
        showNotification('Fout bij aanmaken lobby. Probeer opnieuw.', 'error');
        setButtonLoading(createBtn, false);
        return;
    }
    
    try {
        // Add host to players in database
        const { data: player, error } = await supabase
            .from('players')
            .insert([{
                id: playerId,
                name: playerName,
                room_code: roomCode,
                is_host: true,
                is_ready: true,
                joined_at: new Date().toISOString()
            }])
            .select()
            .single();
            
        if (error) {
            throw error;
        }
    } catch (error) {
        console.error('Fout bij toevoegen host:', error);
        showNotification('Fout bij aanmaken lobby.', 'error');
        setButtonLoading(createBtn, false);
        return;
    }
    
    // Update lobby state
    lobbyState.room = {
        code: roomCode,
        name: roomName,
        gameType: selectedGame,
        maxPlayers: maxPlayers,
        hostId: playerId,
        status: 'waiting'
    };
    
    lobbyState.players = [{
        id: playerId,
        name: playerName,
        isHost: true,
        isReady: true
    }];
    
    // Update UI
    showLobbyStatus();
    
    // Hide loading state
    setButtonLoading(createBtn, false);
    
    showNotification(`Lobby "${roomName}" aangemaakt! Code: ${roomCode}`, 'success');
}

async function joinLobby() {
    const playerName = document.getElementById('joinPlayerName').value.trim();
    const roomCode = document.getElementById('roomCode').value.trim().toUpperCase();
    
    if (!playerName) {
        showNotification('Voer een naam in!');
        return;
    }
    
    if (!roomCode) {
        showNotification('Voer een room code in!');
        return;
    }
    
    // Set player info
    gameState.playerName = playerName;
    gameState.playerId = generatePlayerId();
    gameState.isHost = false;
    gameState.roomCode = roomCode;
    gameState.isMultiplayer = true;
    
    // Join room in database
    const playerData = {
        id: gameState.playerId,
        name: playerName
    };
    
    const result = await window.supabaseClient.joinRoom(roomCode, playerData);
    
    if (!result) {
        showNotification('Fout bij joinen lobby. Controleer room code.');
        return;
    }
    
    // Update lobby state
    lobbyState.room = {
        code: result.room.code,
        name: result.room.name,
        gameType: result.room.game_type,
        maxPlayers: result.room.max_players,
        hostId: result.room.host_id,
        status: result.room.status
    };
    
    lobbyState.players = [result.player];
    
    // Update UI
    showLobbyStatus();
    
    showNotification(`Toegetreden tot lobby ${roomCode}!`);
}

function joinRoomByCode(roomCode) {
    document.getElementById('roomCode').value = roomCode;
    document.getElementById('joinPlayerName').value = gameState.playerName || 'Speler';
    joinLobby();
}

function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function generatePlayerId() {
    return 'player_' + Math.random().toString(36).substr(2, 9);
}

function showLobbyStatus() {
    // Verberg alle tabs
    document.querySelectorAll('.lobby-tab').forEach(tab => {
        tab.style.display = 'none';
    });
    
    // Toon lobby status
    const lobbyStatus = document.getElementById('lobbyStatus');
    lobbyStatus.style.display = 'block';
    
    // Update lobby info
    document.getElementById('currentRoomName').textContent = lobbyState.room.name;
    document.getElementById('currentRoomCode').textContent = lobbyState.room.code;
    document.getElementById('currentGameType').textContent = getGameDisplayName(lobbyState.room.gameType);
    
    updatePlayersList();
    updateStartButton();
}

function updatePlayersList() {
    const container = document.getElementById('playersInLobby');
    container.innerHTML = '';
    
    lobbyState.players.forEach(player => {
        const div = document.createElement('div');
        div.className = 'player-item';
        div.innerHTML = `
            <span class="player-name">${player.name} ${player.isHost ? '👑' : ''}</span>
            <span class="player-status ${player.isReady ? 'ready' : 'waiting'}">
                ${player.isReady ? '✅ Klaar' : '⏳ Wachten'}
            </span>
        `;
        container.appendChild(div);
    });
}

function updateStartButton() {
    const startBtn = document.getElementById('startGameBtn');
    const canStart = gameState.isHost && lobbyState.players.length >= 2 && 
                     lobbyState.players.every(p => p.isReady);
    
    startBtn.disabled = !canStart;
    startBtn.textContent = canStart ? '🎮 Start spel' : '⏳ Wachten op spelers...';
}

async function startGame() {
    if (!gameState.isHost) return;
    if (lobbyState.players.length < 2) {
        showNotification('Minimaal 2 spelers nodig!');
        return;
    }
    
    // Start game in database
    const room = await window.supabaseClient.startGame(gameState.roomCode);
    
    if (!room) {
        showNotification('Fout bij starten spel. Probeer opnieuw.');
        return;
    }
    
    // Start het geselecteerde spel
    lobbyState.gameStarted = true;
    gameState.currentGame = lobbyState.room.gameType;
    
    // Update gameState players voor multiplayer
    gameState.players = lobbyState.players.map(p => ({
        id: p.id,
        name: p.name,
        score: 0
    }));
    
    // Setup game action subscription
    window.supabaseClient.setupGameSubscription();
    
    // Start spel
    if (lobbyState.room.gameType === 'paardenrace') {
        showRaceGame();
        setupRaceTrack();
    } else if (lobbyState.room.gameType === 'mexico') {
        showMexicoGame();
        resetMexicoState();
        updateCurrentPlayer();
        updateMexicoScoreboard();
    } else if (lobbyState.room.gameType === 'bussen') {
        showBussenGame();
        resetBussenState();
        setupBussenGame();
    }
    
    showNotification('Spel gestart! 🎮');
}

async function leaveLobby() {
    // Stop polling
    if (window.supabaseClient && window.supabaseClient.stopPolling) {
        window.supabaseClient.stopPolling();
    }
    
    // Leave room in database if in multiplayer
    if (gameState.isMultiplayer && gameState.playerId && gameState.roomCode) {
        await window.supabaseClient.leaveRoom(gameState.playerId, gameState.roomCode);
    }
    
    // Reset multiplayer state
    gameState.isMultiplayer = false;
    gameState.isHost = false;
    gameState.roomCode = null;
    gameState.playerId = null;
    gameState.connectionStatus = 'disconnected';
    
    // Reset lobby state
    lobbyState.room = null;
    lobbyState.players = [];
    lobbyState.gameType = null;
    lobbyState.gameStarted = false;
    
    // Ga terug naar lobby screen
    showLobbyScreen();
    
    showNotification('Lobby verlaten');
}

async function refreshRooms() {
    showNotification('Rooms verversen...');
    
    try {
        const rooms = await window.supabaseClient.getRooms();
        
        const roomsList = document.getElementById('roomsList');
        
        if (rooms.length === 0) {
            roomsList.innerHTML = '<p>Geen beschikbare rooms gevonden.</p>';
            return;
        }
        
        roomsList.innerHTML = '';
        
        rooms.forEach(room => {
            const playerCount = room.players ? room.players.length : 0;
            const gameIcon = getGameIcon(room.game_type);
            
            const roomDiv = document.createElement('div');
            roomDiv.className = 'room-item';
            roomDiv.innerHTML = `
                <div class="room-info">
                    <h4>${gameIcon} ${room.name}</h4>
                    <p>${getGameDisplayName(room.game_type)} • ${playerCount}/${room.max_players} spelers</p>
                    <p>Room code: ${room.code}</p>
                </div>
                <button class="btn btn-small" onclick="joinRoomByCode('${room.code}')">Join</button>
            `;
            roomsList.appendChild(roomDiv);
        });
        
        showNotification(`${rooms.length} rooms gevonden!`);
        
    } catch (error) {
        console.error('Fout bij ophalen rooms:', error);
        showNotification('Fout bij ophalen rooms. Probeer opnieuw.');
    }
}

function getGameIcon(gameType) {
    const icons = {
        'paardenrace': '🏇',
        'mexico': '🎲',
        'bussen': '🃏'
    };
    return icons[gameType] || '🎮';
}

function getGameDisplayName(gameType) {
    const names = {
        'paardenrace': '🏇 Paardenrace',
        'mexico': '🎲 Mexico',
        'bussen': '🃏 Bussen'
    };
    return names[gameType] || gameType;
}

// ============================================================================
// SIMULATIE FUNCTIES (voor demo doeleinden)
// ============================================================================

function simulateLobbyCreation(roomCode, roomName, gameType, maxPlayers) {
    // In echte implementatie zou dit een WebSocket bericht zijn naar de server
    console.log(`🏠 Lobby aangemaakt: ${roomName} (${roomCode}) - ${gameType} - Max ${maxPlayers} spelers`);
}

function simulateJoinLobby(roomCode, playerName) {
    // Simuleer join lobby response
    setTimeout(() => {
        // Voor demo accepteren we altijd de join
        lobbyState.room = {
            code: roomCode,
            name: 'Demo Lobby',
            gameType: 'paardenrace',
            maxPlayers: 4,
            hostId: 'demo_host'
        };
        
        lobbyState.players = [
            { id: 'demo_host', name: 'Host', isHost: true, isReady: true },
            { id: gameState.playerId, name: playerName, isHost: false, isReady: true }
        ];
        
        showLobbyStatus();
        showNotification(`Toegetreden tot lobby ${roomCode}!`);
    }, 1000);
}

// ============================================================================
// GAME ACTION BROADCASTING
// ============================================================================

function broadcastGameAction(action, data) {
    // Use Supabase for real-time broadcasting
    if (window.supabaseClient && gameState.isMultiplayer) {
        window.supabaseClient.broadcastAction(action, data);
    } else {
        // Fallback voor demo/lokaal spelen
        console.log(`📡 Broadcasting: ${action}`, data);
        setTimeout(() => {
            console.log(`📨 Received: ${action}`, data);
        }, 100);
    }
}

// ============================================================================
// UTILITY FUNCTIES VOOR UI
// ============================================================================

function setButtonLoading(button, loading) {
    if (loading) {
        button.classList.add('loading');
        button.disabled = true;
    } else {
        button.classList.remove('loading');
        button.disabled = false;
    }
}

function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(n => n.remove());
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}-message`;
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        left: 50%;
        transform: translateX(-50%);
        padding: 15px 30px;
        border-radius: 25px;
        font-weight: bold;
        z-index: 2000;
        animation: slideDown 0.3s ease-out;
        max-width: 90%;
        text-align: center;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Auto remove after 4 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideUp 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }
    }, 4000);
}
