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
        console.log('🔄 Fetching available rooms with players...');
        
        // First get all waiting rooms with their players
        const { data: rooms, error } = await supabase
            .from('rooms')
            .select(`
                *,
                players (id, name, is_ready, joined_at)
            `)
            .eq('status', 'waiting')
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        
        // Filter out rooms with no players or empty player arrays
        const roomsWithPlayers = (rooms || []).filter(room => {
            const hasPlayers = room.players && room.players.length > 0;
            if (!hasPlayers) {
                console.log(`🗑️ Filtering out empty room: ${room.name} (${room.code})`);
            }
            return hasPlayers;
        });
        
        console.log(`✅ ${roomsWithPlayers.length} rooms with players fetched (${(rooms || []).length} total rooms)`);
        
        // Optional: Clean up empty rooms (run in background, don't wait for it)
        if ((rooms || []).length > roomsWithPlayers.length) {
            cleanupEmptyRooms();
        }
        
        return roomsWithPlayers;
        
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
        
        // First, check if room exists
        const { data: existingRoom, error: checkError } = await supabase
            .from('rooms')
            .select('*')
            .eq('code', roomCode)
            .eq('status', 'waiting');
            
        if (checkError) {
            console.error('❌ Error checking room:', checkError);
            throw checkError;
        }
        
        if (!existingRoom || existingRoom.length === 0) {
            console.error('❌ Room not found or not in waiting status:', roomCode);
            throw new Error('Room niet gevonden of niet beschikbaar');
        }
        
        console.log('✅ Room found:', existingRoom[0]);
        
        // Update room status
        const { data: updatedRoom, error: roomError } = await supabase
            .from('rooms')
            .update({ 
                status: 'playing',
                started_at: new Date().toISOString()
            })
            .eq('code', roomCode)
            .eq('status', 'waiting') // Double check status
            .select();
            
        if (roomError) {
            console.error('❌ Error updating room status:', roomError);
            throw roomError;
        }
        
        if (!updatedRoom || updatedRoom.length === 0) {
            console.error('❌ No room was updated');
            throw new Error('Room kon niet worden bijgewerkt');
        }
        
        console.log('✅ Room status updated:', updatedRoom[0]);
        
        // Update all players to ready
        const { data: updatedPlayers, error: playersError } = await supabase
            .from('players')
            .update({ is_ready: true })
            .eq('room_code', roomCode)
            .select();
            
        if (playersError) {
            console.error('❌ Error updating players:', playersError);
            throw playersError;
        }
        
        console.log('✅ Players updated:', updatedPlayers);
        console.log('✅ Spel gestart in database:', updatedRoom[0]);
        return updatedRoom[0];
        
    } catch (error) {
        console.error('❌ Fout bij starten spel:', error);
        showNotification('Fout bij starten spel. Probeer opnieuw.');
        return null;
    }
}

async function leaveRoomFromDatabase(playerId, roomCode) {
    try {
        // Remove player from room
        const { error } = await supabase
            .from('players')
            .delete()
            .eq('id', playerId);
            
        if (error) throw error;
        
        // Check if room is empty and delete if so
        const { data: remainingPlayers } = await supabase
            .from('players')
            .select('id')
            .eq('room_code', roomCode);
            
        if (!remainingPlayers || remainingPlayers.length === 0) {
            console.log('🗑️ Room is empty, deleting:', roomCode);
            await supabase
                .from('rooms')
                .delete()
                .eq('code', roomCode);
            console.log('✅ Empty room deleted:', roomCode);
            
            // Trigger rooms refresh if someone is viewing the rooms tab
            if (typeof refreshRooms === 'function') {
                setTimeout(() => {
                    refreshRooms(true); // Silent refresh
                }, 1000);
            }
        }
        
        console.log('✅ Speler uit room verwijderd');
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
    }, 2000); // Poll every 2 seconds for game actions
    
    // Start heartbeat system for active players
    startHeartbeat();
}

async function pollGameActions() {
    if (!supabase || !gameState.roomCode) return;
    
    try {
        const { data: actions, error } = await supabase
            .from('game_actions')
            .select('*')
            .eq('room_code', gameState.roomCode)
            .gt('timestamp', new Date(Date.now() - 5000).toISOString()) // Last 5 seconds
            .order('timestamp', { ascending: false })
            .limit(10);
            
        if (error) throw error;
        
        // Process new actions
        if (actions && actions.length > 0) {
            actions.forEach(action => {
                if (action.player_id !== gameState.playerId) {
                    handleGameAction(action);
                }
            });
        }
        
    } catch (error) {
        console.error('Error polling game actions:', error);
    }
}

function handleGameAction(actionData) {
    // Don't process our own actions
    if (actionData.player_id === gameState.playerId) return;
    
    // Process the action based on type
    switch (actionData.action) {
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
    
    // Run cleanup every 10 seconds
    continuousCleanupInterval = setInterval(async () => {
        try {
            await cleanupInactivePlayers();
            await cleanupEmptyRooms();
        } catch (error) {
            console.error('❌ Continuous cleanup error:', error);
        }
    }, 10000); // Every 10 seconds
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

async function cleanupEmptyRooms() {
    try {
        console.log('🧹 Cleaning up empty rooms...');
        
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
        
        console.log(`🔍 Checking ${allRooms.length} rooms for cleanup...`);
        
        // Check which rooms have players and clean up empty ones
        let deletedCount = 0;
        for (const room of allRooms) {
            const { data: players } = await supabase
                .from('players')
                .select('id, name, last_seen')
                .eq('room_code', room.code);
                
            const hasActivePlayers = players && players.length > 0;
            
            if (!hasActivePlayers) {
                console.log(`🗑️ Deleting empty room: ${room.name} (${room.code})`);
                
                // Delete the room
                const { error: deleteError } = await supabase
                    .from('rooms')
                    .delete()
                    .eq('code', room.code);
                    
                if (deleteError) {
                    console.error('❌ Error deleting room:', deleteError);
                } else {
                    deletedCount++;
                    console.log(`✅ Deleted empty room: ${room.code}`);
                }
            } else {
                console.log(`✅ Room has ${players.length} players: ${room.name} (${room.code})`);
            }
        }
        
        if (deletedCount > 0) {
            console.log(`✅ Cleaned up ${deletedCount} empty rooms`);
        } else {
            console.log('✅ No empty rooms found');
        }
        
    } catch (error) {
        console.error('❌ Error cleaning up empty rooms:', error);
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
    stopContinuousCleanup: stopContinuousCleanup
};
