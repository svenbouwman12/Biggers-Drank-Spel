// ============================================================================
// SIMPLE LOBBY SYSTEM FOR DRANKSPEL PARTY (OPTIMIZED VERSION)
// ============================================================================

// Global state
let currentRoom = null;
let currentPlayer = null;
let players = [];
let pollingInterval = null;
let heartbeatInterval = null;

// ============================================================================
// LOBBY CREATION
// ============================================================================

async function createLobby() {
    try {
        console.log('🏠 Creating lobby...');
        
        const lobbyName = document.getElementById('roomName').value || 'Mijn Lobby';
        const gameType = document.getElementById('selectedGame').value || 'paardenrace';
        const maxPlayers = parseInt(document.getElementById('maxPlayers').value) || 4;
        const playerName = document.getElementById('playerName').value || 'Speler 1';
        
        // Generate room code and player ID
        const roomCode = window.simpleSupabase.generateRoomCode();
        const playerId = window.simpleSupabase.generatePlayerId();
        
        // Create room data
        const roomData = {
            code: roomCode,
            name: lobbyName,
            game_type: gameType,
            max_players: maxPlayers,
            host_id: playerId
        };
        
        // Create player data
        const playerData = {
            id: playerId,
            name: playerName,
            room_code: roomCode,
            is_host: true,
            is_ready: true
        };
        
        // Create room and add player
        const room = await window.simpleSupabase.createRoom(roomData);
        await window.simpleSupabase.addPlayer(playerData);
        
        // Set current state
        currentRoom = room;
        currentPlayer = playerData;
        players = [playerData];
        
        // Start polling and heartbeat
        startPolling();
        startHeartbeat();
        
        // Show lobby
        showLobbyScreen();
        
        console.log('✅ Lobby created successfully:', roomCode);
        showNotification(`Lobby "${lobbyName}" aangemaakt! Code: ${roomCode}`, 'success');
        
    } catch (error) {
        console.error('❌ Error creating lobby:', error);
        showNotification('Fout bij aanmaken lobby. Probeer opnieuw.', 'error');
    }
}

// ============================================================================
// LOBBY JOINING
// ============================================================================

async function joinLobby() {
    try {
        console.log('🚪 Joining lobby...');
        
        const roomCode = document.getElementById('roomCode').value?.trim().toUpperCase();
        const playerName = document.getElementById('joinPlayerName').value || 'Speler 2';
        
        if (!roomCode) {
            showNotification('Voer een room code in!', 'error');
            return;
        }
        
        // Check if room exists
        const room = await window.simpleSupabase.getRoom(roomCode);
        if (!room) {
            showNotification('Room niet gevonden!', 'error');
            return;
        }
        
        if (room.status !== 'waiting') {
            showNotification('Room is al bezig!', 'error');
            return;
        }
        
        // Get current players
        const existingPlayers = await window.simpleSupabase.getPlayers(roomCode);
        if (existingPlayers.length >= room.max_players) {
            showNotification('Room is vol!', 'error');
            return;
        }
        
        // Generate player ID
        const playerId = window.simpleSupabase.generatePlayerId();
        
        // Create player data
        const playerData = {
            id: playerId,
            name: playerName,
            room_code: roomCode,
            is_host: false,
            is_ready: true
        };
        
        // Add player
        await window.simpleSupabase.addPlayer(playerData);
        
        // Set current state
        currentRoom = room;
        currentPlayer = playerData;
        players = [...existingPlayers, playerData];
        
        // Start polling and heartbeat
        startPolling();
        startHeartbeat();
        
        // Show lobby
        showLobbyScreen();
        
        console.log('✅ Joined lobby successfully:', roomCode);
        showNotification(`Lobby "${room.name}" gejoined!`, 'success');
        
    } catch (error) {
        console.error('❌ Error joining lobby:', error);
        showNotification('Fout bij joinen lobby. Probeer opnieuw.', 'error');
    }
}

// ============================================================================
// GAME START
// ============================================================================

async function startGame() {
    try {
        if (!currentPlayer?.is_host) {
            showNotification('Alleen de host kan het spel starten!', 'error');
            return;
        }
        
        if (players.length < 2) {
            showNotification('Minimaal 2 spelers nodig!', 'error');
            return;
        }
        
        console.log('🎮 Starting game...');
        
        // Update room status
        await window.simpleSupabase.updateRoomStatus(currentRoom.code, 'playing');
        
        // Add game start event
        await window.simpleSupabase.addGameEvent({
            room_code: currentRoom.code,
            event_type: 'game_start',
            event_data: {
                game_type: currentRoom.game_type,
                players: players,
                timestamp: new Date().toISOString()
            },
            player_id: currentPlayer.id
        });
        
        // Start the game locally
        startGameLocally();
        
        console.log('✅ Game started successfully');
        showNotification('Spel gestart! 🎮', 'success');
        
    } catch (error) {
        console.error('❌ Error starting game:', error);
        showNotification('Fout bij starten spel. Probeer opnieuw.', 'error');
    }
}

function startGameLocally() {
    // Set game state
    gameState.currentGame = currentRoom.game_type;
    gameState.players = players.map(p => ({
        id: p.id,
        name: p.name,
        score: 0
    }));
    
    // Determine if this player is the host
    const isHost = currentPlayer && currentPlayer.is_host;
    
    console.log('🎮 Starting game locally');
    console.log('🎮 Current player:', currentPlayer);
    console.log('🎮 Is host:', isHost);
    console.log('🎮 Game type:', currentRoom.game_type);
    
    // Set host status for race game
    if (currentRoom.game_type === 'paardenrace') {
        raceState.isHost = isHost;
        console.log(`🏇 Race game - Host status set to: ${raceState.isHost}`);
    }
    
    // Start the selected game
    if (currentRoom.game_type === 'paardenrace') {
        showRaceGame();
        // setupRaceTrack() is no longer needed - showRaceGame() handles everything
    } else if (currentRoom.game_type === 'mexico') {
        showMexicoGame();
    } else if (currentRoom.game_type === 'bussen') {
        showBussenGame();
    }
}

// ============================================================================
// LEAVE LOBBY
// ============================================================================

async function leaveLobby() {
    try {
        console.log('🚪 Leaving lobby...');
        
        if (currentPlayer) {
            await window.simpleSupabase.removePlayer(currentPlayer.id);
        }
        
        // Stop polling and heartbeat
        stopPolling();
        stopHeartbeat();
        
        // Reset state
        currentRoom = null;
        currentPlayer = null;
        players = [];
        
        // Go back to lobby screen
        showLobbyScreen();
        
        console.log('✅ Left lobby successfully');
        showNotification('Lobby verlaten', 'info');
        
    } catch (error) {
        console.error('❌ Error leaving lobby:', error);
        showNotification('Fout bij verlaten lobby.', 'error');
    }
}

// ============================================================================
// POLLING SYSTEM
// ============================================================================

function startPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
    }
    
    console.log('🔄 Starting lobby polling...');
    
    pollingInterval = setInterval(async () => {
        try {
            await pollLobbyData();
            await pollGameEvents();
        } catch (error) {
            console.error('❌ Polling error:', error);
        }
    }, 2000); // Poll every 2 seconds
}

function stopPolling() {
    if (pollingInterval) {
        console.log('⏹️ Stopping lobby polling');
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
}

async function pollLobbyData() {
    if (!currentRoom) return;
    
    try {
        // Get updated room data
        const room = await window.simpleSupabase.getRoom(currentRoom.code);
        if (!room) {
            console.log('⚠️ Room not found, leaving lobby');
            leaveLobby();
            return;
        }
        
        // Get updated players
        const updatedPlayers = await window.simpleSupabase.getPlayers(currentRoom.code);
        
        // Update state
        currentRoom = room;
        players = updatedPlayers;
        
        // Update UI
        updateLobbyUI();
        
        // Check for game start
        if (room.status === 'playing' && !gameState.currentGame) {
            handleGameStart();
        }
        
    } catch (error) {
        console.error('❌ Error polling lobby data:', error);
    }
}

async function pollGameEvents() {
    if (!currentRoom) return;
    
    try {
        // Get recent game events
        const events = await window.simpleSupabase.getGameEvents(currentRoom.code);
        
        // Process new events
        for (const event of events) {
            if (event.player_id !== currentPlayer?.id) {
                handleGameEvent(event);
            }
        }
        
    } catch (error) {
        console.error('❌ Error polling game events:', error);
    }
}

// ============================================================================
// GAME EVENT HANDLING
// ============================================================================

function handleGameStart() {
    console.log('🎮 Game start detected, starting locally...');
    startGameLocally();
    showNotification('🎮 Spel gestart door host!', 'success');
}

function handleGameEvent(event) {
    console.log('🎮 Handling game event:', event.event_type);
    
    switch (event.event_type) {
        case 'game_start':
            if (!gameState.currentGame) {
                handleGameStart();
            }
            break;
        case 'race_card':
        case 'betting_update':
        case 'race_start':
            // Handle race-specific game events
            if (window.handleRaceGameEvent) {
                window.handleRaceGameEvent(event);
            }
            break;
        // Add more event types as needed
    }
}

// ============================================================================
// HEARTBEAT SYSTEM
// ============================================================================

function startHeartbeat() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
    }
    
    if (!currentPlayer) return;
    
    console.log('💓 Starting heartbeat...');
    
    heartbeatInterval = setInterval(async () => {
        try {
            await window.simpleSupabase.updatePlayerHeartbeat(currentPlayer.id);
        } catch (error) {
            console.error('❌ Heartbeat error:', error);
        }
    }, 10000); // Heartbeat every 10 seconds
}

function stopHeartbeat() {
    if (heartbeatInterval) {
        console.log('💔 Stopping heartbeat');
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
}

// ============================================================================
// LOBBY SCREEN MANAGEMENT
// ============================================================================

function showLobbyScreen() {
    // Hide all screens
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => screen.classList.remove('active'));
    
    // Show lobby screen
    const lobbyScreen = document.getElementById('lobbyScreen');
    if (lobbyScreen) {
        lobbyScreen.classList.add('active');
    }
    
    // Show lobby status if in a room
    if (currentRoom) {
        showLobbyStatus();
    } else {
        showLobbyTabs();
    }
}

function showLobbyTabs() {
    const lobbyStatus = document.getElementById('lobbyStatus');
    const lobbyTabs = document.getElementById('lobbyTabs');
    
    if (lobbyStatus) {
        lobbyStatus.style.display = 'none';
    }
    if (lobbyTabs) {
        lobbyTabs.style.display = 'block';
    }
}

function showLobbyStatus() {
    const lobbyTabs = document.getElementById('lobbyTabs');
    const lobbyStatus = document.getElementById('lobbyStatus');
    
    if (lobbyTabs) {
        lobbyTabs.style.display = 'none';
    }
    if (lobbyStatus) {
        lobbyStatus.style.display = 'block';
    }
    
    updateLobbyUI();
}

function showLobbyTab(tabName, clickedButton = null) {
    try {
        console.log('🔄 Switching to tab:', tabName);

        // Hide all tabs
        const tabs = document.querySelectorAll('.lobby-tab');
        tabs.forEach(tab => {
            if (tab && tab.classList) {
                tab.classList.remove('active');
            }
        });

        // Hide all tab buttons
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(btn => {
            if (btn && btn.classList) {
                btn.classList.remove('active');
            }
        });

        // Show selected tab
        let targetTabId;
        if (tabName === 'create') {
            targetTabId = 'createLobbyTab';
        } else if (tabName === 'join') {
            targetTabId = 'joinLobbyTab';
        } else if (tabName === 'rooms') {
            targetTabId = 'roomsTab';
        }

        const targetTab = document.getElementById(targetTabId);
        if (targetTab && targetTab.classList) {
            targetTab.classList.add('active');
        } else {
            console.error('❌ Target tab not found:', targetTabId);
        }

        // Activate the correct tab button
        if (clickedButton && clickedButton.classList) {
            clickedButton.classList.add('active');
        } else {
            const activeTabButton = document.querySelector(`[onclick*="showLobbyTab('${tabName}'"]`);
            if (activeTabButton && activeTabButton.classList) {
                activeTabButton.classList.add('active');
            }
        }

        // Auto-refresh rooms when switching to rooms tab
        if (tabName === 'rooms') {
            refreshRooms();
        }

        console.log('✅ Tab switched successfully:', tabName);

    } catch (error) {
        console.error('❌ Error switching tab:', error);
    }
}

function showStartScreen() {
    // Hide all screens
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => screen.classList.remove('active'));
    
    // Show start screen
    const startScreen = document.getElementById('startScreen');
    if (startScreen) {
        startScreen.classList.add('active');
    }
    
    // Stop any active polling/heartbeat
    stopPolling();
    stopHeartbeat();
    
    // Reset state
    currentRoom = null;
    currentPlayer = null;
    players = [];
}

// ============================================================================
// UI UPDATES
// ============================================================================

function updateLobbyUI() {
    if (!currentRoom) return;
    
    // Update room info
    document.getElementById('currentRoomName').textContent = currentRoom.name;
    document.getElementById('currentRoomCode').textContent = currentRoom.code;
    document.getElementById('currentGameType').textContent = getGameIcon(currentRoom.game_type) + ' ' + currentRoom.game_type;
    document.getElementById('playerCount').textContent = players.length;
    
    // Update players list
    updatePlayersList();
    
    // Update start button
    updateStartButton();
}

function updatePlayersList() {
    const playersList = document.getElementById('playersList');
    if (!playersList) return;
    
    playersList.innerHTML = players.map(player => `
        <div class="player-item ${player.is_host ? 'host' : ''}">
            <span class="player-name">${player.name}</span>
            ${player.is_host ? '<span class="host-badge">👑</span>' : ''}
            <span class="ready-status ${player.is_ready ? 'ready' : 'not-ready'}">
                ${player.is_ready ? '✅' : '⏳'}
            </span>
        </div>
    `).join('');
}

function updateStartButton() {
    const startBtn = document.getElementById('startGameBtn');
    if (!startBtn) return;
    
    const canStart = currentPlayer?.is_host && players.length >= 2;
    
    startBtn.disabled = !canStart;
    
    if (!currentPlayer?.is_host) {
        startBtn.textContent = '⏳ Alleen host kan starten';
    } else if (players.length < 2) {
        startBtn.textContent = `⏳ Minimaal 2 spelers nodig (${players.length}/2)`;
    } else {
        startBtn.textContent = '🎮 Start spel';
    }
}

// ============================================================================
// ROOM LISTING
// ============================================================================

async function refreshRooms() {
    try {
        console.log('🔄 Refreshing rooms...');
        
        const rooms = await window.simpleSupabase.getAvailableRooms();
        const roomsList = document.getElementById('roomsList');
        
        if (!roomsList) return;
        
        if (rooms.length === 0) {
            roomsList.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #666;">
                    <h3>🎮 Geen actieve lobbies</h3>
                    <p>Er zijn momenteel geen lobbies beschikbaar.</p>
                    <p>💡 <strong>Tip:</strong> Maak je eigen lobby aan!</p>
                </div>
            `;
            return;
        }
        
        roomsList.innerHTML = rooms.map(room => `
            <div class="room-item">
                <div class="room-info">
                    <h4>${getGameIcon(room.game_type)} ${room.name}</h4>
                    <p>${room.game_type} • ${room.player_count}/${room.max_players} spelers</p>
                    <p>Room code: <strong>${room.code}</strong></p>
                    <p class="room-status">Status: 🟢 Wachtend</p>
                </div>
                <button class="btn btn-small" onclick="joinRoomByCode('${room.code}')">Join</button>
            </div>
        `).join('');
        
        showNotification(`${rooms.length} lobbies gevonden`, 'info');
        
    } catch (error) {
        console.error('❌ Error refreshing rooms:', error);
        showNotification('Fout bij ophalen lobbies', 'error');
    }
}

function joinRoomByCode(roomCode) {
    document.getElementById('roomCode').value = roomCode;
    showLobbyTab('join');
}

function getGameIcon(gameType) {
    const icons = {
        'paardenrace': '🏇',
        'mexico': '🎲',
        'bussen': '🃏'
    };
    return icons[gameType] || '🎮';
}

// ============================================================================
// PAGE UNLOAD HANDLING
// ============================================================================

window.addEventListener('beforeunload', () => {
    if (currentPlayer) {
        // Mark player as left (fire and forget)
        window.simpleSupabase.removePlayer(currentPlayer.id).catch(console.error);
    }
});

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ Simple lobby system loaded');
    
    // Initialize Supabase when available
    if (window.simpleSupabase) {
        window.simpleSupabase.initialize();
    }
});

console.log('✅ Simple lobby system loaded');
