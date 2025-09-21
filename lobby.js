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
    
    // Check if Supabase is available
    if (!window.supabaseClient || !supabase) {
        console.log('🔄 Supabase niet beschikbaar, gebruik demo modus');
        createLobbyDemo(roomCode, roomName, selectedGame, maxPlayers, playerName, playerId, createBtn);
        return;
    }
    
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
        showNotification('Supabase error. Gebruik demo modus.', 'warning');
        createLobbyDemo(roomCode, roomName, selectedGame, maxPlayers, playerName, playerId, createBtn);
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
        showNotification('Voer een naam in!', 'error');
        return;
    }
    
    if (!roomCode) {
        showNotification('Voer een room code in!', 'error');
        return;
    }
    
    // Show loading state
    const joinBtn = document.getElementById('joinLobbyBtn');
    setButtonLoading(joinBtn, true);
    
    // Set player info
    gameState.playerName = playerName;
    gameState.playerId = generatePlayerId();
    gameState.isHost = false;
    gameState.roomCode = roomCode;
    gameState.isMultiplayer = true;
    
    // Check if Supabase is available
    if (!window.supabaseClient || !supabase) {
        console.log('🔄 Supabase niet beschikbaar, gebruik demo modus');
        joinLobbyDemo(roomCode, playerName, joinBtn);
        return;
    }
    
    try {
        // Join room in database
        const playerData = {
            id: gameState.playerId,
            name: playerName
        };
        
        const result = await window.supabaseClient.joinRoom(roomCode, playerData);
        
        if (!result) {
            throw new Error('Room niet gevonden');
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
        
        // Hide loading state
        setButtonLoading(joinBtn, false);
        
        showNotification(`Toegetreden tot lobby ${roomCode}!`, 'success');
        
    } catch (error) {
        console.error('Error joining lobby:', error);
        setButtonLoading(joinBtn, false);
        showNotification('Supabase error. Gebruik demo modus.', 'warning');
        joinLobbyDemo(roomCode, playerName, joinBtn);
    }
}

function joinLobbyDemo(roomCode, playerName, joinBtn) {
    // Demo mode - join lobby locally
    console.log('🎮 Demo mode: Joining lobby lokaal');
    
    // Update lobby state
    lobbyState.room = {
        code: roomCode,
        name: 'Demo Lobby',
        gameType: 'paardenrace',
        maxPlayers: 4,
        hostId: 'demo_host',
        status: 'waiting'
    };
    
    lobbyState.players = [
        { id: 'demo_host', name: 'Demo Host', isHost: true, isReady: true },
        { id: gameState.playerId, name: playerName, isHost: false, isReady: true }
    ];
    
    // Update UI
    showLobbyStatus();
    
    // Hide loading state
    setButtonLoading(joinBtn, false);
    
    showNotification(`Demo: Toegetreden tot lobby ${roomCode}!`, 'warning');
}

function joinRoomByCode(roomCode) {
    document.getElementById('roomCode').value = roomCode;
    document.getElementById('joinPlayerName').value = gameState.playerName || 'Speler';
    joinLobby();
}

// Force refresh lobby data (called by refresh button)
async function refreshLobbyData() {
    if (!gameState.isMultiplayer || !gameState.roomCode) {
        showNotification('Geen actieve lobby om te verversen', 'warning');
        return;
    }
    
    console.log('🔄 Manual lobby refresh triggered');
    
    // Check if Supabase is available
    if (typeof window.supabase === 'undefined') {
        showNotification('Supabase niet beschikbaar - demo modus', 'warning');
        return;
    }
    
    if (window.supabaseClient && supabase) {
        try {
            await window.supabaseClient.refreshLobbyData();
            // Silent refresh - no notification
        } catch (error) {
            console.error('Manual refresh error:', error);
            showNotification('Fout bij verversen lobby', 'error');
        }
    } else {
        showNotification('Supabase client niet geïnitialiseerd', 'warning');
    }
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
    
    // For multiplayer, only check if host and minimum players
    // Players are automatically ready when they join
    const canStart = gameState.isHost && lobbyState.players.length >= 2;
    
    // Debug info
    console.log('🔍 Start button debug:', {
        isHost: gameState.isHost,
        playerCount: lobbyState.players.length,
        players: lobbyState.players.map(p => ({ name: p.name, isReady: p.isReady })),
        canStart: canStart
    });
    
    startBtn.disabled = !canStart;
    
    if (!gameState.isHost) {
        startBtn.textContent = '⏳ Alleen host kan starten';
    } else if (lobbyState.players.length < 2) {
        startBtn.textContent = `⏳ Minimaal 2 spelers nodig (${lobbyState.players.length}/2)`;
    } else {
        startBtn.textContent = '🎮 Start spel';
    }
}

async function startGame() {
    if (!gameState.isHost) return;
    if (lobbyState.players.length < 2) {
        showNotification('Minimaal 2 spelers nodig!');
        return;
    }
    
    console.log('🎮 Starting game...', {
        roomCode: gameState.roomCode,
        isHost: gameState.isHost,
        playerCount: lobbyState.players.length
    });
    
    // Start game in database
    let room = null;
    
    if (window.supabaseClient && supabase) {
        room = await window.supabaseClient.startGame(gameState.roomCode);
        
        if (!room) {
            console.error('❌ Failed to start game in database, trying local mode');
            showNotification('Database fout, start lokaal...', 'warning');
            // Continue with local game start
        } else {
            console.log('✅ Game started successfully in database:', room);
        }
    } else {
        console.log('🔄 Supabase not available, starting local game');
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

function createLobbyDemo(roomCode, roomName, selectedGame, maxPlayers, playerName, playerId, createBtn) {
    // Demo mode - create lobby locally
    console.log('🎮 Demo mode: Lobby aangemaakt lokaal');
    
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
    
    showNotification(`Demo lobby "${roomName}" aangemaakt! Code: ${roomCode}`, 'warning');
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
