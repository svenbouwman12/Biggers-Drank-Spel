// ============================================================================
// SIMPLE SUPABASE CLIENT FOR DRANKSPEL PARTY (OPTIMIZED VERSION)
// ============================================================================

// Supabase configuration
const SUPABASE_URL = 'https://tmqnpdtbldewusevrgxc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtcW5wZHRibGRld3VzZXZyZ3hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0NTYzNDMsImV4cCI6MjA3NDAzMjM0M30.0YsgPSlp-_Egj72t7e5wZRIWxQWXIouvGY_jXHLS1Ys';

let supabase = null;

// ============================================================================
// INITIALIZATION
// ============================================================================

function initializeSupabase() {
    try {
        console.log('🔌 Initializing Simple Supabase connection...');
        
        if (typeof window.supabase === 'undefined') {
            throw new Error('Supabase library not loaded');
        }
        
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✅ Simple Supabase client initialized');
        
        // Test connection
        testConnection();
        
        // Start cleanup
        startCleanup();
        
        return true;
        
    } catch (error) {
        console.error('❌ Error initializing Simple Supabase:', error);
        return false;
    }
}

async function testConnection() {
    try {
        const { data, error } = await supabase.from('rooms').select('count').limit(1);
        if (error) throw error;
        console.log('✅ Supabase connection test successful');
    } catch (error) {
        console.error('❌ Supabase connection test failed:', error);
    }
}

// ============================================================================
// ROOM MANAGEMENT
// ============================================================================

async function createRoom(roomData) {
    try {
        console.log('🏠 Creating room:', roomData);
        
        const { data, error } = await supabase
            .from('rooms')
            .insert([roomData])
            .select()
            .single();
            
        if (error) throw error;
        
        console.log('✅ Room created:', data);
        return data;
        
    } catch (error) {
        console.error('❌ Error creating room:', error);
        throw error;
    }
}

async function getRoom(roomCode) {
    try {
        const { data, error } = await supabase
            .from('rooms')
            .select('*')
            .eq('code', roomCode)
            .single();
            
        if (error) throw error;
        return data;
        
    } catch (error) {
        console.error('❌ Error getting room:', error);
        return null;
    }
}

async function updateRoomStatus(roomCode, status) {
    try {
        console.log('🔄 Updating room status:', roomCode, 'to', status);
        
        const updateData = { status };
        if (status === 'playing') {
            updateData.started_at = new Date().toISOString();
        }
        
        const { data, error } = await supabase
            .from('rooms')
            .update(updateData)
            .eq('code', roomCode)
            .select()
            .single();
            
        if (error) throw error;
        
        console.log('✅ Room status updated:', data);
        return data;
        
    } catch (error) {
        console.error('❌ Error updating room status:', error);
        throw error;
    }
}

async function deleteRoom(roomCode) {
    try {
        console.log('🗑️ Deleting room:', roomCode);
        
        const { error } = await supabase
            .from('rooms')
            .delete()
            .eq('code', roomCode);
            
        if (error) throw error;
        
        console.log('✅ Room deleted:', roomCode);
        
    } catch (error) {
        console.error('❌ Error deleting room:', error);
        throw error;
    }
}

// ============================================================================
// PLAYER MANAGEMENT
// ============================================================================

async function addPlayer(playerData) {
    try {
        console.log('👤 Adding player:', playerData);
        
        const { data, error } = await supabase
            .from('players')
            .insert([playerData])
            .select()
            .single();
            
        if (error) throw error;
        
        console.log('✅ Player added:', data);
        return data;
        
    } catch (error) {
        console.error('❌ Error adding player:', error);
        throw error;
    }
}

async function getPlayers(roomCode) {
    try {
        const { data, error } = await supabase
            .from('players')
            .select('*')
            .eq('room_code', roomCode)
            .order('joined_at');
            
        if (error) throw error;
        return data || [];
        
    } catch (error) {
        console.error('❌ Error getting players:', error);
        return [];
    }
}

async function removePlayer(playerId) {
    try {
        console.log('🚪 Removing player:', playerId);
        
        const { error } = await supabase
            .from('players')
            .delete()
            .eq('id', playerId);
            
        if (error) throw error;
        
        console.log('✅ Player removed:', playerId);
        
    } catch (error) {
        console.error('❌ Error removing player:', error);
        throw error;
    }
}

async function updatePlayerHeartbeat(playerId) {
    try {
        const { error } = await supabase
            .from('players')
            .update({ last_seen: new Date().toISOString() })
            .eq('id', playerId);
            
        if (error) throw error;
        
    } catch (error) {
        console.error('❌ Error updating heartbeat:', error);
    }
}

// ============================================================================
// GAME EVENTS
// ============================================================================

async function addGameEvent(eventData) {
    try {
        console.log('🎮 Adding game event:', eventData.event_type);
        
        // Remove timestamp field and use created_at instead
        const cleanEventData = {
            room_code: eventData.room_code,
            event_type: eventData.event_type,
            event_data: eventData.event_data,
            player_id: eventData.player_id || null
            // created_at will be set automatically by the database
        };
        
        const { data, error } = await supabase
            .from('game_events')
            .insert([cleanEventData])
            .select()
            .single();
            
        if (error) throw error;
        
        console.log('✅ Game event added:', data);
        return data;
        
    } catch (error) {
        console.error('❌ Error adding game event:', error);
        throw error;
    }
}

async function getGameEvents(roomCode, since = null) {
    try {
        let query = supabase
            .from('game_events')
            .select('*')
            .eq('room_code', roomCode)
            .order('created_at', { ascending: false })
            .limit(50);
            
        if (since) {
            query = query.gt('created_at', since);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        return data || [];
        
    } catch (error) {
        console.error('❌ Error getting game events:', error);
        return [];
    }
}

// ============================================================================
// ROOM LISTING
// ============================================================================

async function getAvailableRooms() {
    try {
        console.log('🔄 Getting available rooms...');
        
        const { data, error } = await supabase
            .from('rooms_with_players')
            .select('*')
            .eq('status', 'waiting')
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        
        console.log(`✅ Found ${data?.length || 0} available rooms`);
        return data || [];
        
    } catch (error) {
        console.error('❌ Error getting available rooms:', error);
        return [];
    }
}

// ============================================================================
// CLEANUP
// ============================================================================

let cleanupInterval = null;

function startCleanup() {
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
    }
    
    console.log('🧹 Starting cleanup interval...');
    
    // Run cleanup every 5 minutes
    cleanupInterval = setInterval(async () => {
        try {
            await cleanupOldData();
        } catch (error) {
            console.error('❌ Cleanup error:', error);
        }
    }, 5 * 60 * 1000); // 5 minutes
}

function stopCleanup() {
    if (cleanupInterval) {
        console.log('⏹️ Stopping cleanup interval');
        clearInterval(cleanupInterval);
        cleanupInterval = null;
    }
}

async function cleanupOldData() {
    try {
        console.log('🧹 Running cleanup...');
        
        const { error } = await supabase.rpc('cleanup_old_data');
        
        if (error) throw error;
        
        console.log('✅ Cleanup completed');
        
    } catch (error) {
        console.error('❌ Error during cleanup:', error);
    }
}

// ============================================================================
// UTILITIES
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
    return 'player_' + Math.random().toString(36).substr(2, 9);
}

// ============================================================================
// EXPORTS
// ============================================================================

window.simpleSupabase = {
    // Initialization
    initialize: initializeSupabase,
    
    // Room management
    createRoom,
    getRoom,
    updateRoomStatus,
    deleteRoom,
    
    // Player management
    addPlayer,
    getPlayers,
    removePlayer,
    updatePlayerHeartbeat,
    
    // Game events
    addGameEvent,
    getGameEvents,
    
    // Room listing
    getAvailableRooms,
    
    // Cleanup
    startCleanup,
    stopCleanup,
    cleanupOldData,
    
    // Utilities
    generateRoomCode,
    generatePlayerId
};

console.log('✅ Simple Supabase client loaded');
