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
        const { data: rooms, error } = await supabase
            .from('rooms')
            .select(`
                *,
                players (id, name, is_ready)
            `)
            .eq('status', 'waiting')
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        
        console.log('✅ Rooms opgehaald:', rooms);
        return rooms;
        
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
        // Update room status
        const { data: room, error: roomError } = await supabase
            .from('rooms')
            .update({ status: 'playing' })
            .eq('code', roomCode)
            .select()
            .single();
            
        if (roomError) throw roomError;
        
        // Update all players to ready
        const { error: playersError } = await supabase
            .from('players')
            .update({ is_ready: true })
            .eq('room_code', roomCode);
            
        if (playersError) throw playersError;
        
        console.log('✅ Spel gestart in database:', room);
        return room;
        
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
            await supabase
                .from('rooms')
                .delete()
                .eq('code', roomCode);
            console.log('✅ Lege room verwijderd');
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
            console.log('⚠️ Room niet meer beschikbaar, blijf in demo modus');
            return; // Don't leave lobby, stay in demo mode
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
    refreshLobbyData: refreshLobbyData
};
