// ============================================================================
// SUPABASE CONFIGURATIE EN DATABASE FUNCTIES
// ============================================================================

// Supabase configuratie
const SUPABASE_URL = 'https://tmqnpdtbldewusevrgxc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtcW5wZHRibGRld3VzZXZyZ3hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0NTYzNDMsImV4cCI6MjA3NDAzMjM0M30.0YsgPSlp-_Egj72t7e5wZRIWxQWXIouvGY_jXHLS1Ys';

// Initialiseer Supabase client
let supabase = null;

// ============================================================================
// SUPABASE INITIALISATIE
// ============================================================================

function initializeSupabase() {
    try {
        // Check if Supabase is available
        if (typeof window.supabase === 'undefined') {
            throw new Error('Supabase library not loaded');
        }
        
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✅ Supabase client geïnitialiseerd');
        
        // Test verbinding
        testSupabaseConnection();
        
        // Setup page unload event to mark player as left
        setupPageUnloadHandler();
        
        // Clean up empty rooms and inactive players on startup
        setTimeout(() => {
            cleanupInactivePlayers();
            cleanupEmptyRooms();
        }, 2000); // Wait 2 seconds after initialization
        
        // Start continuous cleanup every 10 seconds
        startContinuousCleanup();
        
        // Setup polling (instead of real-time)
        setupRealtimeSubscriptions();
        
    } catch (error) {
        console.error('❌ Fout bij initialiseren Supabase:', error);
        gameState.connectionStatus = 'disconnected';
        updateConnectionStatus();
        
        // Fallback to demo mode
        console.log('🔄 Fallback naar demo modus');
        showNotification('Supabase niet beschikbaar. Gebruik lokale modus.');
    }
}

async function testSupabaseConnection() {
    try {
        const { data, error } = await supabase
            .from('rooms')
            .select('count')
            .limit(1);
            
        if (error) {
            console.log('⚠️ Supabase verbinding test (rooms tabel bestaat nog niet)');
            gameState.connectionStatus = 'disconnected';
        } else {
            console.log('✅ Supabase verbinding succesvol');
            gameState.connectionStatus = 'connected';
        }
    } catch (error) {
        console.log('⚠️ Supabase verbinding test gefaald:', error);
        gameState.connectionStatus = 'disconnected';
    }
    
    updateConnectionStatus();
}

// ============================================================================
// ROOM MANAGEMENT FUNCTIES
// ============================================================================

async function createRoomInDatabase(roomData) {
    try {
        const { data, error } = await supabase
            .from('rooms')
            .insert([{
                code: roomData.code,
                name: roomData.name,
                game_type: roomData.gameType,
                max_players: roomData.maxPlayers,
                host_id: roomData.hostId,
                status: 'waiting',
                created_at: new Date().toISOString()
            }])
            .select()
            .single();
            
        if (error) throw error;
        
        console.log('✅ Room aangemaakt in database:', data);
        return data;
        
    } catch (error) {
        console.error('❌ Fout bij aanmaken room:', error);
        showNotification('Fout bij aanmaken lobby. Probeer opnieuw.');
        return null;
    }
}

async function joinRoomInDatabase(roomCode, playerData) {
    try {
        // Check if room exists
        const { data: room, error: roomError } = await supabase
            .from('rooms')
            .select('*')
            .eq('code', roomCode)
            .eq('status', 'waiting')
            .single();
            
        if (roomError || !room) {
            throw new Error('Room niet gevonden of al vol');
        }
        
        // Check if room has space
        const { data: players, error: playersError } = await supabase
            .from('players')
            .select('*')
            .eq('room_code', roomCode);
            
        if (playersError) throw playersError;
        
        if (players.length >= room.max_players) {
            throw new Error('Room is vol');
        }
        
        // Add player to room
        const { data: player, error: playerError } = await supabase
            .from('players')
            .insert([{
                id: playerData.id,
                name: playerData.name,
                room_code: roomCode,
                is_host: false,
                is_ready: true, // Players are automatically ready when they join
                joined_at: new Date().toISOString()
            }])
            .select()
            .single();
            
        if (playerError) throw playerError;
        
        console.log('✅ Speler toegevoegd aan room:', player);
        return { room, player };
        
    } catch (error) {
        console.error('❌ Fout bij joinen room:', error);
        showNotification(error.message || 'Fout bij joinen lobby. Probeer opnieuw.');
        return null;
    }
}

async function getRoomsFromDatabase() {
    try {
        console.log('🔄 Fetching available rooms with ACTIVE players...');

        // First get all waiting rooms with their ACTIVE players only
        const { data: rooms, error } = await supabase
            .from('rooms')
            .select(`
                *,
                players!inner (id, name, is_ready, joined_at, status)
            `)
            .eq('status', 'waiting')
            .eq('players.status', 'active') // Only rooms with ACTIVE players
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Filter out rooms with no active players
        const roomsWithActivePlayers = (rooms || []).filter(room => {
            const activePlayers = room.players.filter(p => p.status === 'active');
            const hasActivePlayers = activePlayers.length > 0;
            
            if (!hasActivePlayers) {
                console.log(`🗑️ Filtering out room with no active players: ${room.name} (${room.code})`);
            } else {
                console.log(`✅ Room has ${activePlayers.length} active players: ${room.name} (${room.code})`);
            }
            return hasActivePlayers;
        });

        console.log(`✅ ${roomsWithActivePlayers.length} rooms with ACTIVE players fetched (${(rooms || []).length} total rooms)`);

        // Optional: Clean up rooms with no active players (run in background, don't wait for it)
        if ((rooms || []).length > roomsWithActivePlayers.length) {
            cleanupEmptyRooms();
        }

        return roomsWithActivePlayers;

    } catch (error) {
        console.error('❌ Fout bij ophalen rooms:', error);
        return [];
    }
}

async function updatePlayerReadyStatus(playerId, isReady) {
    try {
        const { data, error } = await supabase
            .from('players')
            .update({ is_ready: isReady })
            .eq('id', playerId)
            .select()
            .single();
            
        if (error) throw error;
        
        console.log('✅ Speler ready status bijgewerkt:', data);
        return data;
        
    } catch (error) {
        console.error('❌ Fout bij bijwerken ready status:', error);
        return null;
    }
}

async function startGameInDatabase(roomCode) {
    try {
        console.log('🎮 Starting game for room:', roomCode);
        
        // First, verify room exists and get current status
        const { data: existingRooms, error: checkError } = await supabase
            .from('rooms')
            .select('*')
            .eq('code', roomCode);
            
        if (checkError) {
            console.error('❌ Error checking room:', checkError);
            throw checkError;
        }
        
        if (!existingRooms || existingRooms.length === 0) {
            console.error('❌ Room not found:', roomCode);
            throw new Error('Room niet gevonden');
        }
        
        const existingRoom = existingRooms[0];
        console.log('✅ Room found:', existingRoom);
        console.log('🔍 Room details:', {
            code: existingRoom.code,
            status: existingRoom.status,
            name: existingRoom.name,
            game_type: existingRoom.game_type,
            host_id: existingRoom.host_id
        });
        
        // Check if room is already playing
        if (existingRoom.status === 'playing') {
            console.log('⚠️ Room is already playing, returning existing room');
            return existingRoom;
        }
        
        // Check if room is in waiting status
        if (existingRoom.status !== 'waiting') {
            console.error('❌ Room is not in waiting status:', existingRoom.status);
            throw new Error(`Room is in ${existingRoom.status} status, cannot start game`);
        }
        
        // Check if room has active players
        const { data: activePlayers } = await supabase
            .from('players')
            .select('id, name, status')
            .eq('room_code', roomCode)
            .eq('status', 'active');
            
        if (!activePlayers || activePlayers.length === 0) {
            console.error('❌ No active players found in room:', roomCode);
            throw new Error('Geen actieve spelers in room');
        }
        
        console.log('✅ Room validation passed, proceeding with update...');
        console.log('👥 Active players:', activePlayers.map(p => p.name));
        
        // Update room status - DON'T use .single() on updates!
        const { data: updatedRooms, error: roomError } = await supabase
            .from('rooms')
            .update({ 
                status: 'playing',
                started_at: new Date().toISOString()
            })
            .eq('code', roomCode)
            .eq('status', 'waiting') // Only update if still waiting
            .select(); // Return updated rows as array
            
        console.log('🔄 Update query executed, checking results...');
            
        if (roomError) {
            console.error('❌ Error updating room status:', roomError);
            throw roomError;
        }
        
        // Check if any rows were updated
        if (!updatedRooms || updatedRooms.length === 0) {
            console.log('⚠️ No rows updated - room might have been modified by another process');
            
            // Re-check room status
            const { data: currentRooms } = await supabase
                .from('rooms')
                .select('*')
                .eq('code', roomCode);
                
            if (currentRooms && currentRooms.length > 0) {
                const currentRoom = currentRooms[0];
                if (currentRoom.status === 'playing') {
                    console.log('✅ Room is now playing (updated by another process)');
                    return currentRoom;
                } else {
                    console.error('❌ Room status is still:', currentRoom.status);
                    throw new Error(`Room status is ${currentRoom.status}, cannot start game`);
                }
            } else {
                throw new Error('Room not found after update attempt');
            }
        }
        
        const updatedRoom = updatedRooms[0];
        console.log('✅ Room status updated:', updatedRoom);
        
        // Update all players to ready (optional, players are already ready when they join)
        const { data: updatedPlayers, error: playersError } = await supabase
            .from('players')
            .update({ is_ready: true })
            .eq('room_code', roomCode)
            .eq('status', 'active') // Only update active players
            .select();
            
        if (playersError) {
            console.error('⚠️ Error updating players (non-critical):', playersError);
            // Don't throw error for player update, it's not critical
        } else {
            console.log('✅ Players updated:', updatedPlayers);
        }
        
        console.log('✅ Spel gestart in database:', updatedRoom);
        return updatedRoom;
        
    } catch (error) {
        console.error('❌ Fout bij starten spel:', error);
        showNotification('Fout bij starten spel. Probeer opnieuw.');
        return null;
    }
}

async function leaveRoomFromDatabase(playerId, roomCode) {
    try {
        console.log('🚪 Leaving room:', roomCode, 'Player:', playerId);
        
        // Mark player as 'left' instead of deleting immediately
        const { error: playerError } = await supabase
            .from('players')
            .update({ 
                status: 'left',
                last_seen: new Date().toISOString()
            })
            .eq('id', playerId);
            
        if (playerError) throw playerError;
        
        console.log('✅ Player marked as left in database');
        
        // Check if room has any active players
        const { data: activePlayers } = await supabase
            .from('players')
            .select('id')
            .eq('room_code', roomCode)
            .eq('status', 'active');
            
        // If no active players left, delete the room
        if (!activePlayers || activePlayers.length === 0) {
            console.log('🗑️ Room has no active players, deleting:', roomCode);
            await supabase
                .from('rooms')
                .delete()
                .eq('code', roomCode);
            console.log('✅ Room deleted (no active players):', roomCode);
            
            // Trigger rooms refresh if someone is viewing the rooms tab
            if (typeof refreshRooms === 'function') {
                setTimeout(() => {
                    refreshRooms(true); // Silent refresh
                }, 1000);
            }
        }
        
        console.log('✅ Speler status op left gezet');
        return true;
        
    } catch (error) {
        console.error('❌ Fout bij verlaten room:', error);
        return false;
    }
}

// ============================================================================
// REAL-TIME SUBSCRIPTIONS
// ============================================================================

function setupRealtimeSubscriptions() {
    if (!supabase) return;
    
    console.log('🔄 Polling mode enabled (Realtime not available)');
    
    // Start polling for updates every 3 seconds
    startPolling();
}

function startPolling() {
    if (gameState.pollingInterval) {
        clearInterval(gameState.pollingInterval);
    }
    
    gameState.pollingInterval = setInterval(async () => {
        if (gameState.isMultiplayer && gameState.roomCode) {
            try {
                await refreshLobbyData();
                updateConnectionIndicator('✅ Verbonden', false);
            } catch (error) {
                console.error('Polling error:', error);
                updateConnectionIndicator('❌ Verbindingsfout', false);
            }
        }
    }, 2000); // Poll every 2 seconds (faster for better sync)
    
    console.log('✅ Polling started for real-time updates (every 2 seconds)');
}

function stopPolling() {
    if (gameState.pollingInterval) {
        clearInterval(gameState.pollingInterval);
        gameState.pollingInterval = null;
        console.log('⏹️ Polling stopped');
    }
}

function handleRoomChange(payload) {
    if (payload.eventType === 'DELETE' && payload.old.code === gameState.roomCode) {
        // Room was deleted, leave lobby
        showNotification('Room is verwijderd door host');
        leaveLobby();
    }
}

function handlePlayerChange(payload) {
    if (!gameState.isMultiplayer || !gameState.roomCode) return;
    
    const player = payload.new || payload.old;
    if (player.room_code !== gameState.roomCode) return;
    
    // Refresh lobby data
    refreshLobbyData();
}

async function refreshLobbyData() {
    if (!gameState.isMultiplayer || !gameState.roomCode) return;
    
    try {
        // Get room data
        const { data: room, error: roomError } = await supabase
            .from('rooms')
            .select('*')
            .eq('code', gameState.roomCode)
            .single();
            
        if (roomError || !room) {
            console.log('⚠️ Room niet meer beschikbaar, leaving lobby');
            
            // Leave lobby if room doesn't exist
            if (typeof leaveLobby === 'function') {
                leaveLobby();
            }
            return;
        }
        
        // Get players data
        const { data: players, error: playersError } = await supabase
            .from('players')
            .select('*')
            .eq('room_code', gameState.roomCode)
            .order('joined_at');
            
        if (playersError) throw playersError;
        
        // Update lobby state
        lobbyState.room = {
            code: room.code,
            name: room.name,
            gameType: room.game_type,
            maxPlayers: room.max_players,
            hostId: room.host_id,
            status: room.status
        };
        
        lobbyState.players = players.map(p => ({
            id: p.id,
            name: p.name,
            isHost: p.is_host,
            isReady: true // Players are automatically ready when they join
        }));
        
        console.log('🔄 Lobby data refreshed:', {
            roomCode: room.code,
            playerCount: players.length,
            players: players.map(p => ({ name: p.name, isReady: p.is_ready }))
        });
        
        // Update UI if we're in lobby
        if (document.getElementById('lobbyStatus').style.display !== 'none') {
            updatePlayersList();
            updateStartButton();
            
            // Check if game started
            if (room.status === 'playing' && !lobbyState.gameStarted) {
                startGame();
            }
        }
        
    } catch (error) {
        console.error('❌ Fout bij verversen lobby data:', error);
        // Stay in demo mode instead of crashing
    }
}

// ============================================================================
// GAME ACTIONS (voor multiplayer games)
// ============================================================================

async function broadcastGameAction(action, data) {
    if (!supabase || !gameState.isMultiplayer) return;
    
    try {
        // Store game action in database for real-time sync
        const { error } = await supabase
            .from('game_actions')
            .insert([{
                room_code: gameState.roomCode,
                action: action,
                data: data,
                player_id: gameState.playerId,
                timestamp: new Date().toISOString()
            }]);
            
        if (error) throw error;
        
        console.log('📡 Game action broadcasted:', action, data);
        
    } catch (error) {
        console.error('❌ Fout bij broadcasten game action:', error);
    }
}

function setupGameActionSubscription() {
    if (!supabase || !gameState.isMultiplayer) return;
    
    console.log('🔄 Game action polling enabled');
    
    // Start polling for game actions every 2 seconds during gameplay
    if (gameState.gameActionInterval) {
        clearInterval(gameState.gameActionInterval);
    }
    
    gameState.gameActionInterval = setInterval(async () => {
        if (gameState.isMultiplayer && gameState.roomCode && gameState.currentGame) {
            try {
                await pollGameActions();
            } catch (error) {
                console.error('Game action polling error:', error);
            }
        }
    }, 1000); // Poll every 1 second for faster sync
    
    // Start heartbeat system for active players
    startHeartbeat();
}

async function pollGameActions() {
    if (!supabase || !gameState.roomCode) return;
    
    try {
        // Check for recent actions (last 10 seconds for better sync)
        const { data: actions, error } = await supabase
            .from('game_actions')
            .select('*')
            .eq('room_code', gameState.roomCode)
            .gt('timestamp', new Date(Date.now() - 10000).toISOString()) // Last 10 seconds
            .order('timestamp', { ascending: false })
            .limit(20); // More actions for better sync
            
        if (error) throw error;
        
        // Process new actions (exclude our own)
        if (actions && actions.length > 0) {
            console.log(`🎮 Processing ${actions.length} game actions...`);
            
            actions.forEach(action => {
                if (action.player_id !== gameState.playerId) {
                    console.log(`🎮 Handling action: ${action.action} from ${action.player_id}`);
                    handleGameAction(action);
                }
            });
        }
        
        // Also check room status for game start
        await checkRoomStatusForGameStart();
        
    } catch (error) {
        console.error('Error polling game actions:', error);
    }
}

async function checkRoomStatusForGameStart() {
    try {
        const { data: room, error } = await supabase
            .from('rooms')
            .select('status')
            .eq('code', gameState.roomCode)
            .single();
            
        if (error) throw error;
        
        // If room status changed to 'playing' and we're not in game yet
        if (room && room.status === 'playing' && !gameState.currentGame) {
            console.log('🎮 Room status changed to playing - starting game!');
            
            // Get game type from lobby state
            if (lobbyState.room && lobbyState.room.gameType) {
                gameState.currentGame = lobbyState.room.gameType;
                
                // Update gameState players voor multiplayer
                gameState.players = lobbyState.players.map(p => ({
                    id: p.id,
                    name: p.name,
                    score: 0
                }));
                
                // Start het geselecteerde spel
                if (lobbyState.room.gameType === 'paardenrace') {
                    showRaceGame();
                    setupRaceTrack();
                } else if (lobbyState.room.gameType === 'mexico') {
                    showMexicoGame();
                } else if (lobbyState.room.gameType === 'bussen') {
                    showBussenGame();
                }
                
                showNotification('🎮 Spel gestart door host!', 'success');
                console.log('✅ Game started from room status change');
            }
        }
        
    } catch (error) {
        console.error('Error checking room status:', error);
    }
}

function handleGameAction(actionData) {
    // Don't process our own actions
    if (actionData.player_id === gameState.playerId) return;
    
    console.log(`🎮 Processing action: ${actionData.action}`, actionData.data);
    
    // Process the action based on type
    switch (actionData.action) {
        case 'game_start':
            console.log('🎮 Game start action received from host!');
            handleGameStartFromHost(actionData.data);
            break;
        case 'roll_dice':
            if (gameState.currentGame === 'paardenrace') {
                processDiceRoll(actionData.data.dice);
            }
            break;
        case 'player_turn':
            // Handle turn changes
            break;
        case 'game_state':
            // Handle game state updates
            break;
        default:
            console.log(`🎮 Unknown action type: ${actionData.action}`);
    }
}

function handleGameStartFromHost(gameData) {
    try {
        console.log('🎮 Starting game from host action:', gameData);
        
        if (!lobbyState.room || !lobbyState.room.gameType) {
            console.error('❌ No lobby room or game type available');
            return;
        }
        
        // Set game state
        gameState.currentGame = lobbyState.room.gameType;
        lobbyState.gameStarted = true;
        
        // Update gameState players voor multiplayer
        gameState.players = lobbyState.players.map(p => ({
            id: p.id,
            name: p.name,
            score: 0
        }));
        
        // Start het geselecteerde spel
        if (lobbyState.room.gameType === 'paardenrace') {
            showRaceGame();
            setupRaceTrack();
        } else if (lobbyState.room.gameType === 'mexico') {
            showMexicoGame();
        } else if (lobbyState.room.gameType === 'bussen') {
            showBussenGame();
        }
        
        showNotification('🎮 Spel gestart door host!', 'success');
        console.log('✅ Game started from host action');
        
    } catch (error) {
        console.error('❌ Error starting game from host:', error);
    }
}

// ============================================================================
// UTILITY FUNCTIES
// ============================================================================

function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function generatePlayerId() {
    return 'player_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

function updateConnectionIndicator(message, isPolling) {
    const indicator = document.getElementById('connectionStatus');
    if (indicator) {
        indicator.textContent = message;
        if (isPolling) {
            indicator.classList.add('polling');
        } else {
            indicator.classList.remove('polling');
        }
    }
}

// Heartbeat system to track active players
let heartbeatInterval = null;
let continuousCleanupInterval = null;

function startHeartbeat() {
    // Stop any existing heartbeat
    stopHeartbeat();
    
    if (!gameState.isMultiplayer || !gameState.playerId) return;
    
    console.log('💓 Starting heartbeat for player:', gameState.playerId);
    
    // Send heartbeat every 5 seconds for faster detection
    heartbeatInterval = setInterval(async () => {
        if (gameState.isMultiplayer && gameState.playerId && gameState.roomCode) {
            try {
                await updatePlayerHeartbeat();
            } catch (error) {
                console.error('❌ Heartbeat error:', error);
            }
        }
    }, 5000); // Every 5 seconds
}

function stopHeartbeat() {
    if (heartbeatInterval) {
        console.log('💔 Stopping heartbeat');
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
}

function startContinuousCleanup() {
    // Stop any existing cleanup
    stopContinuousCleanup();
    
    console.log('🧹 Starting continuous cleanup (every 10 seconds)');
    
    // Run AGGRESSIVE cleanup every 5 seconds
    continuousCleanupInterval = setInterval(async () => {
        try {
            await cleanupInactivePlayers();
            await cleanupEmptyRooms();
        } catch (error) {
            console.error('❌ Continuous cleanup error:', error);
        }
    }, 5000); // Every 5 seconds - AGGRESSIVE
}

function stopContinuousCleanup() {
    if (continuousCleanupInterval) {
        console.log('⏹️ Stopping continuous cleanup');
        clearInterval(continuousCleanupInterval);
        continuousCleanupInterval = null;
    }
}

async function updatePlayerHeartbeat() {
    if (!supabase || !gameState.playerId) return;
    
    try {
        const { error } = await supabase
            .from('players')
            .update({ 
                last_seen: new Date().toISOString()
            })
            .eq('id', gameState.playerId);
            
        if (error) throw error;
        
        console.log('💓 Heartbeat sent for player:', gameState.playerId);
        
    } catch (error) {
        console.error('❌ Error updating heartbeat:', error);
    }
}

function setupPageUnloadHandler() {
    console.log('🔗 Setting up page unload handler for leave tracking');
    
    // Handle page unload (refresh, close, navigate away)
    window.addEventListener('beforeunload', async (event) => {
        if (gameState.isMultiplayer && gameState.playerId && gameState.roomCode) {
            console.log('🚪 Page unloading - marking player as left');
            
            try {
                // Mark player as left in database
                if (supabase) {
                    await supabase
                        .from('players')
                        .update({ 
                            status: 'left',
                            last_seen: new Date().toISOString()
                        })
                        .eq('id', gameState.playerId);
                    console.log('✅ Player marked as left during page unload');
                }
            } catch (error) {
                console.log('⚠️ Could not mark player as left during unload:', error);
            }
        }
    });
    
    // Handle visibility change (tab switching, minimizing)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && gameState.isMultiplayer && gameState.playerId) {
            console.log('👁️ Tab hidden - updating last_seen');
            updatePlayerHeartbeat();
        }
    });
}

async function cleanupInactivePlayers() {
    try {
        console.log('🧹 Cleaning up inactive players...');
        
        // Remove players who haven't been seen for more than 10 seconds
        const cutoffTime = new Date(Date.now() - 10 * 1000).toISOString(); // 10 seconds ago
        
        const { data: inactivePlayers, error } = await supabase
            .from('players')
            .delete()
            .lt('last_seen', cutoffTime)
            .select('id, name, room_code');
            
        if (error) throw error;
        
        if (inactivePlayers && inactivePlayers.length > 0) {
            console.log(`🗑️ Removed ${inactivePlayers.length} inactive players:`, inactivePlayers.map(p => p.name));
        } else {
            console.log('✅ No inactive players found');
        }
        
    } catch (error) {
        console.error('❌ Error cleaning up inactive players:', error);
    }
}

// NUCLEAR OPTION: Force delete ALL empty rooms
async function nuclearCleanup() {
    try {
        console.log('💥 NUCLEAR CLEANUP - Deleting ALL empty rooms...');
        
        // Get all rooms
        const { data: allRooms, error } = await supabase
            .from('rooms')
            .select('code, name')
            .eq('status', 'waiting');
            
        if (error) throw error;
        
        if (!allRooms || allRooms.length === 0) {
            console.log('💥 No rooms to nuke');
            return;
        }
        
        console.log(`💥 NUKING ${allRooms.length} rooms...`);
        
        // NUCLEAR: Delete ALL rooms and let players handle it
        let nuked = 0;
        for (const room of allRooms) {
            try {
                await supabase
                    .from('rooms')
                    .delete()
                    .eq('code', room.code);
                    
                nuked++;
                console.log(`💥 NUKED: ${room.name} (${room.code})`);
            } catch (error) {
                console.error(`💥 Failed to nuke ${room.code}:`, error);
            }
        }
        
        console.log(`💥 NUCLEAR CLEANUP COMPLETE: ${nuked} rooms nuked`);
        
    } catch (error) {
        console.error('💥 NUCLEAR CLEANUP FAILED:', error);
    }
}

async function cleanupEmptyRooms() {
    try {
        console.log('🧹 AGGRESSIVE cleanup of empty rooms (active players only)...');
        
        // Get all waiting rooms
        const { data: allRooms, error: roomsError } = await supabase
            .from('rooms')
            .select('code, name, created_at')
            .eq('status', 'waiting')
            .order('created_at', { ascending: true }); // Oldest first
            
        if (roomsError) throw roomsError;
        
        if (!allRooms || allRooms.length === 0) {
            console.log('✅ No rooms to clean up');
            return;
        }
        
        console.log(`🔍 AGGRESSIVELY checking ${allRooms.length} rooms for ACTIVE players...`);
        
        // AGGRESSIVE: Delete all rooms that don't have ACTIVE players
        let deletedCount = 0;
        const roomsToDelete = [];
        
        for (const room of allRooms) {
            const { data: activePlayers } = await supabase
                .from('players')
                .select('id, name, status')
                .eq('room_code', room.code)
                .eq('status', 'active'); // Only count ACTIVE players
                
            const hasActivePlayers = activePlayers && activePlayers.length > 0;
            
            if (!hasActivePlayers) {
                roomsToDelete.push(room.code);
                console.log(`🗑️ MARKED for deletion (no active players): ${room.name} (${room.code})`);
            } else {
                console.log(`✅ Room has ${activePlayers.length} ACTIVE players: ${room.name} (${room.code})`);
            }
        }
        
        // AGGRESSIVE: Delete all marked rooms at once
        if (roomsToDelete.length > 0) {
            console.log(`🔥 AGGRESSIVELY deleting ${roomsToDelete.length} rooms with no active players...`);
            
            for (const roomCode of roomsToDelete) {
                try {
                    // Force delete room and all related data
                    const { error: deleteError } = await supabase
                        .from('rooms')
                        .delete()
                        .eq('code', roomCode);
                        
                    if (deleteError) {
                        console.error(`❌ Error deleting room ${roomCode}:`, deleteError);
                    } else {
                        deletedCount++;
                        console.log(`🔥 FORCE DELETED (no active players): ${roomCode}`);
                    }
                } catch (error) {
                    console.error(`❌ Exception deleting room ${roomCode}:`, error);
                }
            }
            
            console.log(`🔥 AGGRESSIVE cleanup completed: ${deletedCount} rooms deleted (no active players)`);
        } else {
            console.log('✅ All rooms have active players');
        }
        
    } catch (error) {
        console.error('❌ Error in aggressive cleanup:', error);
    }
}

// Export voor gebruik in andere bestanden
window.supabaseClient = {
    initialize: initializeSupabase,
    createRoom: createRoomInDatabase,
    joinRoom: joinRoomInDatabase,
    getRooms: getRoomsFromDatabase,
    updatePlayerReady: updatePlayerReadyStatus,
    startGame: startGameInDatabase,
    leaveRoom: leaveRoomFromDatabase,
    broadcastAction: broadcastGameAction,
    setupGameSubscription: setupGameActionSubscription,
    stopPolling: stopPolling,
    refreshLobbyData: refreshLobbyData,
    cleanupEmptyRooms: cleanupEmptyRooms,
    startHeartbeat: startHeartbeat,
    stopHeartbeat: stopHeartbeat,
    cleanupInactivePlayers: cleanupInactivePlayers,
    startContinuousCleanup: startContinuousCleanup,
    stopContinuousCleanup: stopContinuousCleanup,
    nuclearCleanup: nuclearCleanup
};
