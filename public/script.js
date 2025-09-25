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
    console.log('🏠 Room created data:', data);
    
    currentRoom = data.roomCode;
    
    // Find the host player in the players array
    const hostPlayer = data.room.players.find(player => player.isHost);
    if (hostPlayer) {
        currentPlayer = {
            id: hostPlayer.id,
            name: hostPlayer.name,
            isHost: true
        };
        console.log('👑 Host player set:', currentPlayer);
    } else {
        console.log('⚠️ Host player not found in room data');
        // Fallback: use first player as host
        if (data.room.players && data.room.players.length > 0) {
            currentPlayer = {
                id: data.room.players[0].id,
                name: data.room.players[0].name,
                isHost: true
            };
        }
    }
    
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
    
    console.log('🏠 Showing lobby for room:', room);
    console.log('👥 Players in room:', room.players);
    
    // Update lobby display
    const roomCodeElement = document.getElementById('currentRoomCode');
    const playerCountElement = document.getElementById('playerCount');
    
    if (roomCodeElement) {
        roomCodeElement.textContent = room.code;
    }
    
    if (playerCountElement) {
        playerCountElement.textContent = room.playerCount || room.players.length;
    }
    
    // Show/hide leave button based on host status
    const currentPlayer = JSON.parse(localStorage.getItem('currentPlayer') || '{}');
    const leaveBtn = document.getElementById('leaveLobbyBtn');
    
    if (leaveBtn) {
        // Always show leave button for now - players can leave anytime
        leaveBtn.style.display = 'inline-flex';
    }
    
    // Update players grid
    const playersGrid = document.getElementById('playersGrid');
    if (playersGrid) {
        playersGrid.innerHTML = '';
        
        if (room.players && room.players.length > 0) {
            // Sort players to show host first
            const sortedPlayers = [...room.players].sort((a, b) => {
                if (a.isHost && !b.isHost) return -1;
                if (!a.isHost && b.isHost) return 1;
                return 0;
            });
            
            sortedPlayers.forEach(player => {
                console.log('👤 Adding player to lobby:', player);
                const playerElement = document.createElement('div');
                playerElement.className = `player-item ${player.isHost ? 'host-player' : ''}`;
                playerElement.innerHTML = `
                    <span class="player-avatar">${player.avatar}</span>
                    <span class="player-name">${player.name}</span>
                    ${player.isHost ? '<span class="host-badge">👑 Host</span>' : ''}
                `;
                playersGrid.appendChild(playerElement);
            });
        } else {
            console.log('⚠️ No players found in room.players array');
            playersGrid.innerHTML = '<p class="no-players">No players yet...</p>';
        }
    }
    
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
    
    const gameType = gameState.currentGame || 'simpleTest';
    startGameAPI(gameType);
}

async function startGameAPI(gameType) {
    const startBtn = document.getElementById('startGameBtn');
    
    // Prevent multiple simultaneous calls
    if (startBtn && startBtn.disabled) {
        console.log('⚠️ Game start already in progress, ignoring duplicate call');
        return;
    }
    
    try {
        console.log('🎮 Starting game via API:', gameType);
        
        // Disable button to prevent double clicks
        if (startBtn) {
            startBtn.disabled = true;
            startBtn.innerHTML = '<span class="button-icon">⏳</span><span class="button-text">Starting...</span>';
        }
        
        const response = await fetch('/api/game/start', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                roomCode: currentRoom,
                gameType: 'balletjeBalletje' // Always use balletjeBalletje
            })
        });

        if (response.ok) {
            const data = await response.json();
            console.log('✅ Game started via API:', data);
            data.skipNotification = true; // Skip notification since we'll show it in polling
            handleGameStarted(data);
        } else {
            const error = await response.json();
            console.error('❌ Failed to start game:', error);
            
            // Try force update if normal start fails
            console.log('🔄 Normal start failed, trying force update...');
            try {
                const forceResponse = await fetch(`/api/debug/force-game-start/${currentRoom}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                });
                
                if (forceResponse.ok) {
                    const forceData = await forceResponse.json();
                    console.log('✅ Force update successful:', forceData);
                    showNotification('🎮 Game started!', 'success');
                    // The polling will detect the game state change
                } else {
                    const forceError = await forceResponse.json();
                    showNotification(forceError.error || 'Failed to start game', 'error');
                }
            } catch (forceError) {
                console.error('❌ Force update failed:', forceError);
                showNotification('Failed to start game', 'error');
            }
            
            // Re-enable button on error
            if (startBtn) {
                startBtn.disabled = false;
                startBtn.innerHTML = '<span class="button-icon">🚀</span><span class="button-text">Start Game</span>';
            }
        }
    } catch (error) {
        console.error('❌ Error starting game:', error);
        showNotification('Failed to start game', 'error');
        
        // Re-enable button on error
        if (startBtn) {
            startBtn.disabled = false;
            startBtn.innerHTML = '<span class="button-icon">🚀</span><span class="button-text">Start Game</span>';
        }
    }
}

function handleGameStarted(data) {
    console.log('🎮 Game started:', data);
    
    // Don't show duplicate notification if we already showed one
    if (!data.skipNotification) {
        showNotification('Game started!', 'success');
    }
    
    // Switch to game screen
    showScreen('gameScreen');
    
    // Update game screen with current state
    updateGameScreen(data);
}

function updateGameScreen(data) {
    // Check if we have current game data from polling
    const roomData = currentRoomData;
    const currentGame = roomData && roomData.currentGame;
    
    // Update game title
    const gameTitle = document.getElementById('gameTitle');
    if (gameTitle) {
        gameTitle.textContent = `🎮 Balletje Balletje - Room ${currentRoom}`;
    }
    
    // Show the game interface
    const gameContent = document.getElementById('gameContent');
    if (!gameContent) return;
    
    if (currentGame && currentGame.isActive) {
        // Show active game with current round
        gameContent.innerHTML = `
            <div class="game-header">
                <div class="round-info">
                    <span class="round-counter">Round ${currentGame.currentRound}/${currentGame.totalRounds}</span>
                    <span class="game-phase">${currentGame.phase === 'question' ? 'Kies je beker!' : 'Resultaten'}</span>
                </div>
                <div class="timer" id="gameTimer">
                    <span id="timeRemaining">${Math.ceil((currentGame.timeRemaining || 0) / 1000)}s</span>
                </div>
            </div>
            
            ${currentGame.phase === 'question' ? `
                <div class="question-container">
                    <h3 class="question">${currentGame.currentQuestion ? currentGame.currentQuestion.question : 'Loading...'}</h3>
                    <div class="beker-container">
                        ${currentGame.currentQuestion ? currentGame.currentQuestion.options.map((option, index) => `
                            <div class="beker-option" onclick="selectAnswer(${index})">
                                <div class="beker">
                                    <div class="beker-top">${option}</div>
                                    <div class="beker-body"></div>
                                </div>
                                <div class="vote-indicators" id="votes-${index}">
                                    <!-- Votes will be shown here -->
                                </div>
                            </div>
                        `).join('') : ''}
                    </div>
                    <div class="player-votes" id="playerVotes">
                        <!-- Player votes will be shown here -->
                    </div>
                </div>
            ` : `
                <div class="results-container">
                    <h3>Round ${currentGame.currentRound} Resultaten</h3>
                    <div class="correct-answer">
                        <p><strong>Het juiste antwoord was: Beker ${currentGame.currentQuestion.correctAnswer + 1}</strong></p>
                        <p>${currentGame.currentQuestion.explanation}</p>
                    </div>
                    <div class="vote-results">
                        ${currentGame.currentQuestion.options.map((option, index) => `
                            <div class="vote-result">
                                <span class="beker-name">${option}:</span>
                                <span class="vote-count">${getVoteCount(currentGame, index)} stemmen</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `}
            
            <div class="game-actions">
                <button class="glass-button secondary" onclick="backToLobby()">
                    <span class="button-icon">🏠</span>
                    <span class="button-text">Back to Lobby</span>
                </button>
            </div>
        `;
        
        // Update player votes display
        updatePlayerVotes(currentGame);
        
        // Start timer if question phase
        if (currentGame.phase === 'question') {
            startGameTimer(currentGame.timeRemaining || 10000);
        }
    } else {
        // Show basic game screen (fallback) - Balletje Balletje
        gameContent.innerHTML = `
            <div class="game-question">
                <h3>🎯 Balletje Balletje</h3>
                <p>Room: <strong>${currentRoom}</strong></p>
                <p>Players: <strong>${data.players.length}</strong></p>
                <p>Waar zit het balletje onder?</p>
                
                <div class="beker-container">
                    <div class="beker-option" onclick="selectAnswer(0)">
                        <div class="beker">
                            <div class="beker-top">Beker 1</div>
                            <div class="beker-body"></div>
                        </div>
                        <div class="vote-indicators" id="votes-0">
                            <!-- Votes will be shown here -->
                        </div>
                    </div>
                    
                    <div class="beker-option" onclick="selectAnswer(1)">
                        <div class="beker">
                            <div class="beker-top">Beker 2</div>
                            <div class="beker-body"></div>
                        </div>
                        <div class="vote-indicators" id="votes-1">
                            <!-- Votes will be shown here -->
                        </div>
                    </div>
                    
                    <div class="beker-option" onclick="selectAnswer(2)">
                        <div class="beker">
                            <div class="beker-top">Beker 3</div>
                            <div class="beker-body"></div>
                        </div>
                        <div class="vote-indicators" id="votes-2">
                            <!-- Votes will be shown here -->
                        </div>
                    </div>
                </div>
                
                <div class="player-votes" id="playerVotes">
                    <!-- Player votes will be shown here -->
                </div>
                
                <div class="game-timer">
                    <div class="timer-label">Time remaining:</div>
                    <div class="timer-value" id="timeRemaining">10s</div>
                </div>
                
                <div class="game-actions">
                    <button class="glass-button secondary" onclick="backToLobby()">
                        <span class="button-icon">🏠</span>
                        <span class="button-text">Back to Lobby</span>
                    </button>
                </div>
            </div>
        `;
        
        // Start timer for fallback interface
        startGameTimer(10000);
    }
}

function startGameTimer(duration) {
    // Clear any existing timer
    if (window.gameTimer) {
        clearInterval(window.gameTimer);
    }
    
    const timerElement = document.getElementById('timeRemaining');
    if (!timerElement) return;
    
    let timeLeft = Math.ceil(duration / 1000);
    timerElement.textContent = `${timeLeft}s`;
    
    window.gameTimer = setInterval(() => {
        timeLeft--;
        timerElement.textContent = `${timeLeft}s`;
        
        if (timeLeft <= 0) {
            clearInterval(window.gameTimer);
            timerElement.textContent = '0s';
        }
    }, 1000);
}

function selectAnswer(answerIndex) {
    console.log(`Selected answer: ${answerIndex}`);
    
    if (!currentPlayer || !currentRoom) {
        showNotification('No player or room found', 'error');
        return;
    }
    
    // Send vote to server
    fetch('/api/game/vote', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            roomCode: currentRoom,
            playerId: currentPlayer.id,
            vote: answerIndex
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log('✅ Vote submitted:', data);
            showNotification(`Je hebt gekozen voor Beker ${answerIndex + 1}!`, 'success');
        } else {
            console.error('❌ Vote failed:', data);
            showNotification(data.error || 'Failed to submit vote', 'error');
        }
    })
    .catch(error => {
        console.error('❌ Vote error:', error);
        showNotification('Failed to submit vote', 'error');
    });
}

function updatePlayerVotes(currentGame) {
    if (!currentGame || !currentGame.playerVotes) return;
    
    const playerVotesContainer = document.getElementById('playerVotes');
    if (!playerVotesContainer) return;
    
    // Clear previous votes
    playerVotesContainer.innerHTML = '';
    
    // Show each player's vote
    currentGame.playerVotes.forEach(([playerId, vote]) => {
        const player = currentRoomData?.players?.find(p => p.id === playerId);
        if (player) {
            const voteElement = document.createElement('div');
            voteElement.className = 'player-vote';
            voteElement.innerHTML = `
                <span class="player-avatar">${player.avatar}</span>
                <span class="player-name">${player.name}</span>
                <span class="vote-choice">Beker ${vote + 1}</span>
            `;
            playerVotesContainer.appendChild(voteElement);
        }
    });
    
    // Update vote indicators on bekers
    currentGame.currentQuestion.options.forEach((option, index) => {
        const voteContainer = document.getElementById(`votes-${index}`);
        if (voteContainer) {
            voteContainer.innerHTML = '';
            
            currentGame.playerVotes.forEach(([playerId, vote]) => {
                if (vote === index) {
                    const player = currentRoomData?.players?.find(p => p.id === playerId);
                    if (player) {
                        const indicator = document.createElement('span');
                        indicator.className = 'vote-indicator';
                        indicator.textContent = player.avatar;
                        indicator.title = player.name;
                        voteContainer.appendChild(indicator);
                    }
                }
            });
        }
    });
}

function getVoteCount(currentGame, optionIndex) {
    if (!currentGame || !currentGame.playerVotes) return 0;
    
    let count = 0;
    currentGame.playerVotes.forEach(([playerId, vote]) => {
        if (vote === optionIndex) count++;
    });
    return count;
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
                    // Add small delay after game start to allow database sync
                    if (data.gameState === 'playing' && currentRoomData && currentRoomData.gameState === 'lobby') {
                        console.log('🎮 Game state changed to playing, waiting for database sync...');
                        setTimeout(() => {
                            updateLobby(data);
                            currentRoomData = data;
                        }, 1000); // 1 second delay
                    } else {
                        updateLobby(data);
                        currentRoomData = data;
                    }
                    
                    // Check if we're in game screen and update game state
                    const currentScreen = document.querySelector('.screen.active');
                    if (currentScreen && currentScreen.id === 'gameScreen' && data.currentGame) {
                        console.log('🎮 Updating game screen with new data');
                        updateGameScreen(data);
                        
                        // Update player votes if in question phase
                        if (data.currentGame.phase === 'question') {
                            updatePlayerVotes(data.currentGame);
                        }
                    }
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
        // Check if game state changed from lobby to playing
        const gameStateChanged = currentRoomData.gameState !== data.gameState;
        
        // Only show lobby if we're not in a game
        if (data.gameState === 'lobby' || data.gameState === 'waiting') {
            showLobby(data);
        } else if (data.gameState === 'playing') {
            // If game state changed to playing, switch to game screen
            if (gameStateChanged && currentRoomData.gameState === 'lobby') {
                console.log('🎮 Game started! Switching to game screen for all players');
                showNotification('🎮 Game started!', 'success');
                handleGameStarted({
                    success: true,
                    gameType: data.gameType || 'mostLikelyTo',
                    players: data.players,
                    playerCount: data.playerCount
                });
            } else {
                // Update current room data but don't switch to lobby
                currentRoomData = data;
                console.log('🎮 Game is active, staying on current screen');
            }
        } else {
            // Fallback: show lobby for unknown states
            showLobby(data);
        }
    }
}

// ============================================================================
// UI FUNCTIONS
// ============================================================================

function showScreen(screenId) {
    // First hide all screens using both methods for maximum compatibility
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => {
        if (screen) {
            screen.classList.remove('active');
            screen.style.display = 'none';
        }
    });
    
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
        targetScreen.style.display = 'block';
        console.log(`📱 Switching to screen: ${screenId}`);
    } else {
        console.warn(`⚠️ Screen not found: ${screenId}`);
    }
}

function showHome() {
    showScreen('homeScreen');
    
    // Stop lobby refresh when going home
    stopLobbyRefresh();
}

function showHostForm() {
    showScreen('hostForm');
}

function showJoinForm() {
    showScreen('joinForm');
    
    // Stop lobby refresh when leaving lobby browser
    stopLobbyRefresh();
}

function nextRound() {
    console.log('🎮 Next round requested');
    
    // For Balletje Balletje, rounds advance automatically
    showNotification('Rounds advance automatically! Wait for the next question.', 'info');
}

// Simple test game - no voting needed

function backToLobby() {
    console.log('🏠 Back to lobby requested');
    if (currentRoom) {
        showScreen('lobbyScreen');
    } else {
        showHome();
    }
}

// Global variables for lobby browser
let lobbiesData = [];
let lobbyRefreshInterval = null;
let selectedRoomCode = null;

// Hide all screens
function hideAllScreens() {
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => {
        screen.classList.remove('active');
        // Force hide with inline style as backup
        screen.style.display = 'none';
    });
}

function showLobbyBrowser() {
    console.log('📋 Showing lobby browser');
    hideAllScreens();
    
    const lobbyScreen = document.getElementById('lobbyBrowserScreen');
    if (lobbyScreen) {
        lobbyScreen.classList.add('active');
        console.log('✅ Lobby browser screen activated');
        
        // Debug: Check which screens are active
        const activeScreens = document.querySelectorAll('.screen.active');
        console.log('📱 Active screens:', Array.from(activeScreens).map(s => s.id));
        
        // Debug: Check screen visibility
        const computedStyle = window.getComputedStyle(lobbyScreen);
        console.log('👁️ Screen visibility:', {
            display: computedStyle.display,
            visibility: computedStyle.visibility,
            opacity: computedStyle.opacity,
            classes: lobbyScreen.className
        });
        
        // Force display if still hidden
        if (computedStyle.display === 'none') {
            console.log('🔧 Forcing display to block...');
            lobbyScreen.style.display = 'block';
        }
        
    } else {
        console.error('❌ Lobby browser screen not found!');
        return;
    }
    
    // Start auto-refresh
    startLobbyRefresh();
    
    // Load initial lobbies
    refreshLobbies();
}

function startLobbyRefresh() {
    if (lobbyRefreshInterval) {
        clearInterval(lobbyRefreshInterval);
    }
    
    lobbyRefreshInterval = setInterval(() => {
        refreshLobbies();
    }, 2000); // 2 seconds for more real-time updates
    
    console.log('🔄 Lobby auto-refresh started');
}

function stopLobbyRefresh() {
    if (lobbyRefreshInterval) {
        clearInterval(lobbyRefreshInterval);
        lobbyRefreshInterval = null;
        console.log('⏹️ Lobby auto-refresh stopped');
    }
}

// Refresh lobbies from server
async function refreshLobbies() {
    try {
        console.log('🔄 Refreshing lobbies...');
        
        // Add visual refresh indicator
        const refreshButton = document.querySelector('.glass-button.secondary');
        if (refreshButton) {
            refreshButton.style.opacity = '0.7';
            refreshButton.querySelector('.button-icon').textContent = '⏳';
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
        }
        
        // Reset refresh button
        if (refreshButton) {
            refreshButton.style.opacity = '1';
            refreshButton.querySelector('.button-icon').textContent = '🔄';
        }
        
    } catch (error) {
        console.error('❌ Error refreshing lobbies:', error);
        showNotification(`Verbindingsfout: ${error.message}`, 'error');
        
        // Reset refresh button on error
        const refreshButton = document.querySelector('.glass-button.secondary');
        if (refreshButton) {
            refreshButton.style.opacity = '1';
            refreshButton.querySelector('.button-icon').textContent = '🔄';
        }
    }
}

// Update the lobbies display
function updateLobbiesDisplay() {
    console.log('🔄 Updating lobbies display...');
    
    const noLobbiesState = document.getElementById('noLobbies');
    const lobbiesList = document.getElementById('lobbiesList');
    const createLobbySmall = document.getElementById('createLobbySmall');
    
    console.log('📋 Elements found:', {
        noLobbiesState: !!noLobbiesState,
        lobbiesList: !!lobbiesList,
        createLobbySmall: !!createLobbySmall,
        lobbiesCount: lobbiesData.length
    });
    
    if (lobbiesData.length === 0) {
        console.log('📋 No lobbies - showing empty state');
        // Show no lobbies state
        if (noLobbiesState) {
            noLobbiesState.classList.remove('hidden');
            console.log('✅ Empty state shown');
        }
        if (lobbiesList) {
            lobbiesList.classList.add('hidden');
            console.log('✅ Lobbies list hidden');
        }
        if (createLobbySmall) {
            createLobbySmall.style.display = 'none';
            console.log('✅ Small create button hidden');
        }
    } else {
        console.log(`📋 Showing ${lobbiesData.length} lobbies`);
        // Show lobbies list
        if (noLobbiesState) {
            noLobbiesState.classList.add('hidden');
            console.log('✅ Empty state hidden');
        }
        if (lobbiesList) {
            lobbiesList.classList.remove('hidden');
            console.log('✅ Lobbies list shown');
            renderLobbies();
        }
        if (createLobbySmall) {
            createLobbySmall.style.display = 'inline-flex';
            console.log('✅ Small create button shown');
        }
    }
}

// Render the lobbies list
function renderLobbies() {
    const lobbiesList = document.getElementById('lobbiesList');
    if (!lobbiesList) {
        console.error('❌ Lobbies list element not found!');
        return;
    }
    
    console.log(`🎨 Rendering ${lobbiesData.length} lobbies...`);
    
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
    
    console.log('✅ Lobbies rendered successfully');
}

// Select a lobby and show join form
function selectLobby(roomCode) {
    console.log(`🎯 Selected lobby: ${roomCode}`);
    
    // Store the selected room code and show popup
    selectedRoomCode = roomCode;
    showQuickJoinPopup();
}

// Quick Join Popup Functions
function showQuickJoinPopup() {
    const popup = document.getElementById('quickJoinPopup');
    const nameInput = document.getElementById('quickJoinName');
    
    if (popup) {
        popup.classList.remove('hidden');
        // Focus on name input after popup appears
        setTimeout(() => {
            if (nameInput) {
                nameInput.focus();
            }
        }, 100);
        console.log(`🚀 Quick join popup shown for room: ${selectedRoomCode}`);
    }
}

function closeQuickJoinPopup() {
    const popup = document.getElementById('quickJoinPopup');
    const nameInput = document.getElementById('quickJoinName');
    
    if (popup) {
        popup.classList.add('hidden');
    }
    
    if (nameInput) {
        nameInput.value = '';
    }
    
    // Don't reset selectedRoomCode here - let it be reset after successful join
    console.log('❌ Quick join popup closed, selectedRoomCode:', selectedRoomCode);
}

function handleQuickJoinKeyPress(event) {
    if (event.key === 'Enter') {
        confirmQuickJoin();
    }
}

async function confirmQuickJoin() {
    const nameInput = document.getElementById('quickJoinName');
    const playerName = nameInput?.value?.trim();
    
    console.log('🔍 confirmQuickJoin - selectedRoomCode:', selectedRoomCode);
    console.log('🔍 confirmQuickJoin - playerName:', playerName);
    
    if (!playerName) {
        showNotification('Voer je naam in!', 'error');
        return;
    }
    
    if (!selectedRoomCode) {
        showNotification('Geen lobby geselecteerd!', 'error');
        return;
    }
    
    console.log(`🚀 Joining room ${selectedRoomCode} as ${playerName}`);
    
    try {
        // Debug: Check if room exists first
        console.log(`🔍 Debug: Checking room ${selectedRoomCode}`);
        const debugResponse = await fetch(`/api/debug/room/${selectedRoomCode}`);
        const debugData = await debugResponse.json();
        console.log('🔍 Debug response:', debugData);
        
        // Close popup first
        closeQuickJoinPopup();
        
        // Show loading
        showNotification('Joining lobby...', 'info');
        
        // Join the room
        const joinData = {
            roomCode: selectedRoomCode,
            playerName: playerName
        };
        
        console.log('📤 Sending join data:', joinData);
        
        const response = await fetch('/api/room/join', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(joinData)
        });
        
        if (!response.ok) {
            let errorMessage = 'Failed to join room';
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorData.details || errorMessage;
                console.error('❌ Join error details:', errorData);
            } catch (e) {
                console.error('❌ Failed to parse error response');
            }
            throw new Error(errorMessage);
        }
        
        const data = await response.json();
        console.log('✅ Joined room successfully:', data);
        
        // Store player and room info
        localStorage.setItem('currentPlayer', JSON.stringify(data.player));
        localStorage.setItem('currentRoom', JSON.stringify(data.room));
        
        // Show success and go to lobby
        showNotification(`Welkom in lobby ${selectedRoomCode}!`, 'success');
        
        // Start polling for this room
        startPolling(data.room.code);
        
        // Show lobby screen
        showLobby(data.room);
        
        // Reset selected room code after successful join
        selectedRoomCode = null;
        
    } catch (error) {
        console.error('❌ Error joining room:', error);
        showNotification(`Kon niet joinen: ${error.message}`, 'error');
        // Don't reset selectedRoomCode on error so user can try again
    }
}

// Leave lobby function
async function leaveLobby() {
    const currentPlayer = JSON.parse(localStorage.getItem('currentPlayer') || '{}');
    const currentRoom = JSON.parse(localStorage.getItem('currentRoom') || '{}');
    
    if (!currentPlayer.id || !currentRoom.code) {
        showNotification('Geen actieve lobby gevonden!', 'error');
        return;
    }
    
    console.log(`🚪 Leaving lobby ${currentRoom.code} as ${currentPlayer.name}`);
    
    try {
        // Debug: Test the leave endpoint first
        console.log('🧪 Testing leave endpoint...');
        const debugResponse = await fetch('/api/debug/test-leave', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                roomCode: currentRoom.code,
                playerId: currentPlayer.id
            })
        });
        
        const debugData = await debugResponse.json();
        console.log('🧪 Debug test result:', debugData);
        
        // Show loading
        showNotification('Verlaten van lobby...', 'info');
        
        const response = await fetch('/api/room/leave', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                roomCode: currentRoom.code,
                playerId: currentPlayer.id
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to leave room');
        }
        
        const data = await response.json();
        console.log('✅ Left room successfully:', data);
        
        // Clear local storage
        localStorage.removeItem('currentPlayer');
        localStorage.removeItem('currentRoom');
        
        // Stop polling
        stopPolling();
        
        // Show success message
        showNotification('Lobby verlaten!', 'success');
        
        // Refresh page after a short delay
        setTimeout(() => {
            window.location.reload();
        }, 1500);
        
    } catch (error) {
        console.error('❌ Error leaving room:', error);
        showNotification(`Kon lobby niet verlaten: ${error.message}`, 'error');
    }
}

// Utility functions for lobby browser
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
            const qrContainer = document.getElementById('lobbyQrCode');
            if (qrContainer) {
                qrContainer.innerHTML = `<img src="${data.qrCode}" alt="QR Code for room ${roomCode}" />`;
            }
        }
    } catch (error) {
        console.error('❌ Error generating QR code:', error);
    }
}

// ============================================================================
// END OF FILE
// ============================================================================
