// ============================================================================
// DRANKSPEL MULTIPLAYER - SUPABASE INTEGRATION
// ============================================================================
// Database integration for persistent game data and statistics

const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'your-supabase-url';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'your-supabase-anon-key';

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================================
// ROOM MANAGEMENT
// ============================================================================

/**
 * Create a new room in the database
 * @param {Object} roomData - Room information
 * @returns {Promise<Object>} Created room
 */
async function createRoom(roomData) {
    try {
        const { data, error } = await supabase
            .from('rooms')
            .insert([{
                code: roomData.code,
                host_name: roomData.hostName,
                host_id: roomData.hostId,
                game_type: roomData.gameType,
                status: 'lobby',
                max_players: roomData.maxPlayers || 8,
                current_players: 1,
                settings: roomData.settings || {}
            }])
            .select()
            .single();

        if (error) throw error;
        console.log('🏠 Room created in database:', data);
        return data;
    } catch (error) {
        console.error('❌ Error creating room:', error);
        throw error;
    }
}

/**
 * Get room information by code
 * @param {string} roomCode - Room code
 * @returns {Promise<Object>} Room data
 */
async function getRoom(roomCode) {
    try {
        const { data, error } = await supabase
            .from('rooms')
            .select(`
                *,
                players (
                    id,
                    player_name,
                    avatar,
                    is_host,
                    score,
                    position,
                    joined_at
                )
            `)
            .eq('code', roomCode)
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('❌ Error getting room:', error);
        throw error;
    }
}

/**
 * Update room status
 * @param {string} roomCode - Room code
 * @param {string} status - New status
 * @param {Object} additionalData - Additional data to update
 * @returns {Promise<Object>} Updated room
 */
async function updateRoom(roomCode, status, additionalData = {}) {
    try {
        const updateData = {
            status,
            ...additionalData
        };

        if (status === 'playing') {
            updateData.started_at = new Date().toISOString();
        } else if (status === 'finished') {
            updateData.finished_at = new Date().toISOString();
        }

        const { data, error } = await supabase
            .from('rooms')
            .update(updateData)
            .eq('code', roomCode)
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('❌ Error updating room:', error);
        throw error;
    }
}

// ============================================================================
// PLAYER MANAGEMENT
// ============================================================================

/**
 * Add player to room
 * @param {string} roomCode - Room code
 * @param {Object} playerData - Player information
 * @returns {Promise<Object>} Created player
 */
async function addPlayer(roomCode, playerData) {
    try {
        // First get room ID
        const room = await getRoom(roomCode);
        if (!room) throw new Error('Room not found');

        const { data, error } = await supabase
            .from('players')
            .insert([{
                room_id: room.id,
                socket_id: playerData.socketId,
                player_name: playerData.name,
                avatar: playerData.avatar,
                is_host: playerData.isHost || false,
                is_ready: false,
                score: 0
            }])
            .select()
            .single();

        if (error) throw error;

        // Update room player count
        await supabase
            .from('rooms')
            .update({ current_players: room.current_players + 1 })
            .eq('code', roomCode);

        console.log('👤 Player added to database:', data);
        return data;
    } catch (error) {
        console.error('❌ Error adding player:', error);
        throw error;
    }
}

/**
 * Remove player from room
 * @param {string} socketId - Socket ID
 * @returns {Promise<Object>} Updated room
 */
async function removePlayer(socketId) {
    try {
        // Get player info
        const { data: player, error: playerError } = await supabase
            .from('players')
            .select('*, rooms!inner(code)')
            .eq('socket_id', socketId)
            .single();

        if (playerError) throw playerError;

        // Update player as left
        await supabase
            .from('players')
            .update({ left_at: new Date().toISOString() })
            .eq('socket_id', socketId);

        // Update room player count
        const { data: room, error: roomError } = await supabase
            .from('rooms')
            .select('current_players')
            .eq('code', player.rooms.code)
            .single();

        if (roomError) throw roomError;

        await supabase
            .from('rooms')
            .update({ current_players: Math.max(0, room.current_players - 1) })
            .eq('code', player.rooms.code);

        console.log('👋 Player removed from database');
        return { roomCode: player.rooms.code };
    } catch (error) {
        console.error('❌ Error removing player:', error);
        throw error;
    }
}

/**
 * Update player score
 * @param {string} socketId - Socket ID
 * @param {number} score - New score
 * @returns {Promise<Object>} Updated player
 */
async function updatePlayerScore(socketId, score) {
    try {
        const { data, error } = await supabase
            .from('players')
            .update({ score })
            .eq('socket_id', socketId)
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('❌ Error updating player score:', error);
        throw error;
    }
}

// ============================================================================
// GAME EVENTS
// ============================================================================

/**
 * Log game event
 * @param {string} roomCode - Room code
 * @param {string} socketId - Socket ID
 * @param {string} eventType - Type of event
 * @param {Object} eventData - Event data
 * @returns {Promise<Object>} Created event
 */
async function logGameEvent(roomCode, socketId, eventType, eventData) {
    try {
        // Get room and player IDs
        const room = await getRoom(roomCode);
        if (!room) throw new Error('Room not found');

        const player = room.players.find(p => p.socket_id === socketId);
        if (!player) throw new Error('Player not found');

        const { data, error } = await supabase
            .from('game_events')
            .insert([{
                room_id: room.id,
                player_id: player.id,
                event_type: eventType,
                event_data: eventData,
                round_number: eventData.roundNumber || 1,
                game_phase: eventData.gamePhase || 'playing'
            }])
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('❌ Error logging game event:', error);
        throw error;
    }
}

/**
 * Create game round
 * @param {string} roomCode - Room code
 * @param {Object} roundData - Round information
 * @returns {Promise<Object>} Created round
 */
async function createGameRound(roomCode, roundData) {
    try {
        const room = await getRoom(roomCode);
        if (!room) throw new Error('Room not found');

        const { data, error } = await supabase
            .from('game_rounds')
            .insert([{
                room_id: room.id,
                round_number: roundData.roundNumber,
                game_type: roundData.gameType,
                question: roundData.question,
                question_data: roundData.questionData || {},
                correct_answer: roundData.correctAnswer,
                time_limit: roundData.timeLimit,
                status: 'active'
            }])
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('❌ Error creating game round:', error);
        throw error;
    }
}

/**
 * Log player vote
 * @param {string} roomCode - Room code
 * @param {string} socketId - Socket ID
 * @param {Object} voteData - Vote information
 * @returns {Promise<Object>} Created vote
 */
async function logVote(roomCode, socketId, voteData) {
    try {
        const room = await getRoom(roomCode);
        if (!room) throw new Error('Room not found');

        const player = room.players.find(p => p.socket_id === socketId);
        if (!player) throw new Error('Player not found');

        // Get current round
        const { data: round, error: roundError } = await supabase
            .from('game_rounds')
            .select('id')
            .eq('room_id', room.id)
            .eq('round_number', voteData.roundNumber)
            .eq('status', 'active')
            .single();

        if (roundError) throw roundError;

        const { data, error } = await supabase
            .from('votes')
            .insert([{
                room_id: room.id,
                round_id: round.id,
                player_id: player.id,
                vote_data: voteData.vote,
                vote_type: voteData.voteType,
                response_time: voteData.responseTime,
                is_correct: voteData.isCorrect
            }])
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('❌ Error logging vote:', error);
        throw error;
    }
}

// ============================================================================
// STATISTICS AND RESULTS
// ============================================================================

/**
 * Get room statistics
 * @param {string} roomCode - Room code
 * @returns {Promise<Object>} Room statistics
 */
async function getRoomStatistics(roomCode) {
    try {
        const { data, error } = await supabase
            .rpc('get_room_statistics', { room_code: roomCode });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('❌ Error getting room statistics:', error);
        throw error;
    }
}

/**
 * Get player achievements
 * @param {string} socketId - Socket ID
 * @returns {Promise<Object>} Player achievements
 */
async function getPlayerAchievements(socketId) {
    try {
        const { data, error } = await supabase
            .rpc('get_player_achievements', { player_socket_id: socketId });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('❌ Error getting player achievements:', error);
        throw error;
    }
}

/**
 * Update game statistics
 * @param {string} roomCode - Room code
 * @param {Object} statsData - Statistics data
 * @returns {Promise<Object>} Updated statistics
 */
async function updateGameStatistics(roomCode, statsData) {
    try {
        const room = await getRoom(roomCode);
        if (!room) throw new Error('Room not found');

        for (const [socketId, stats] of Object.entries(statsData)) {
            const player = room.players.find(p => p.socket_id === socketId);
            if (!player) continue;

            const { data, error } = await supabase
                .from('game_statistics')
                .upsert([{
                    room_id: room.id,
                    player_id: player.id,
                    total_score: stats.totalScore,
                    rounds_played: stats.roundsPlayed,
                    rounds_won: stats.roundsWon,
                    average_response_time: stats.averageResponseTime,
                    fastest_response_time: stats.fastestResponseTime,
                    slowest_response_time: stats.slowestResponseTime,
                    correct_answers: stats.correctAnswers,
                    total_answers: stats.totalAnswers,
                    accuracy: stats.accuracy
                }])
                .select()
                .single();

            if (error) throw error;
        }

        console.log('📊 Game statistics updated');
        return { success: true };
    } catch (error) {
        console.error('❌ Error updating game statistics:', error);
        throw error;
    }
}

/**
 * Award achievement
 * @param {string} socketId - Socket ID
 * @param {string} achievementType - Type of achievement
 * @param {Object} achievementData - Achievement data
 * @returns {Promise<Object>} Created achievement
 */
async function awardAchievement(socketId, achievementType, achievementData) {
    try {
        const { data: player, error: playerError } = await supabase
            .from('players')
            .select('id')
            .eq('socket_id', socketId)
            .single();

        if (playerError) throw playerError;

        const { data, error } = await supabase
            .from('achievements')
            .insert([{
                player_id: player.id,
                achievement_type: achievementType,
                achievement_data: achievementData,
                points_earned: achievementData.points || 0
            }])
            .select()
            .single();

        if (error) throw error;
        console.log('🏆 Achievement awarded:', achievementType);
        return data;
    } catch (error) {
        console.error('❌ Error awarding achievement:', error);
        throw error;
    }
}

// ============================================================================
// CUSTOM QUESTIONS
// ============================================================================

/**
 * Get custom questions
 * @param {string} gameType - Type of game
 * @param {string} category - Question category
 * @returns {Promise<Array>} Custom questions
 */
async function getCustomQuestions(gameType, category = null) {
    try {
        let query = supabase
            .from('custom_questions')
            .select('*')
            .eq('game_type', gameType)
            .eq('is_approved', true);

        if (category) {
            query = query.eq('category', category);
        }

        const { data, error } = await query;

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('❌ Error getting custom questions:', error);
        throw error;
    }
}

/**
 * Add custom question
 * @param {Object} questionData - Question information
 * @returns {Promise<Object>} Created question
 */
async function addCustomQuestion(questionData) {
    try {
        const { data, error } = await supabase
            .from('custom_questions')
            .insert([{
                created_by: questionData.createdBy,
                game_type: questionData.gameType,
                question_text: questionData.questionText,
                question_data: questionData.questionData || {},
                category: questionData.category,
                difficulty: questionData.difficulty || 'medium',
                is_approved: questionData.isApproved || false
            }])
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('❌ Error adding custom question:', error);
        throw error;
    }
}

// ============================================================================
// CLEANUP FUNCTIONS
// ============================================================================

/**
 * Cleanup old data
 * @returns {Promise<Object>} Cleanup result
 */
async function cleanupOldData() {
    try {
        const { data, error } = await supabase
            .rpc('cleanup_old_data');

        if (error) throw error;
        console.log('🧹 Old data cleaned up');
        return data;
    } catch (error) {
        console.error('❌ Error cleaning up old data:', error);
        throw error;
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    // Room management
    createRoom,
    getRoom,
    updateRoom,
    
    // Player management
    addPlayer,
    removePlayer,
    updatePlayerScore,
    
    // Game events
    logGameEvent,
    createGameRound,
    logVote,
    
    // Statistics
    getRoomStatistics,
    getPlayerAchievements,
    updateGameStatistics,
    awardAchievement,
    
    // Custom questions
    getCustomQuestions,
    addCustomQuestion,
    
    // Cleanup
    cleanupOldData
};

// ============================================================================
// END OF FILE
// ============================================================================
