// ============================================================================
// DRANKSPEL PARTY - Multiplayer Lobby System
// ============================================================================

// Globale variabelen
let gameState = {
    players: [],
    currentGame: null,
    isMultiplayer: false,
    settings: {
        playerCount: 4,
        playerNames: ['Speler 1', 'Speler 2', 'Speler 3', 'Speler 4'],
        drinkUnit: 'slokken',
        animationSpeed: 'standaard',
        soundEnabled: true
    }
};

let lobbyState = {
    currentRoom: null,
    currentPlayer: null,
    players: [],
    isHost: false,
    gameType: null,
    gameStarted: false,
    currentTurn: 0
};

// Paardenrace Game State
let raceState = {
    phase: 'betting', // 'betting', 'racing', 'results'
    bettingTimer: 30,
    bettingInterval: null,
    cardDrawInterval: null,
    cardDrawDelay: 2000, // 2 seconds between cards
    playerBets: {}, // {playerId: suit}
    horses: {
        '♠': 0, // Spades
        '♥': 0, // Hearts  
        '♦': 0, // Diamonds
        '♣': 0  // Clubs
    },
    trackLength: 8, // Number of track cards
    trackCards: [], // Cards on the track
    revealedCards: 0, // Number of revealed track cards
    drawPile: [], // Remaining cards to draw
    gameOver: false,
    winner: null,
    currentCard: null,
    isHost: false, // Whether this client is the host
    raceSeed: null, // Seed for consistent random card generation
    drawnCards: 0, // Number of drawn cards
    lastBettingUpdate: 0 // Prevent spam updates
};

// ============================================================================
// INITIALISATIE
// ============================================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🎉 Drankspel Party geladen!');
    
    // Laad opgeslagen gegevens
    loadSettings();
    loadScoreboard();
    
    // Initialize Supabase
    if (window.simpleSupabase) {
        window.simpleSupabase.initialize();
    } else {
        console.warn('⚠️ Supabase not available');
    }
    
    // Show start screen
    showStartScreen();
    
    // Initialize lobby system
    if (window.simpleLobby) {
        window.simpleLobby.initialize();
    }
});

// ============================================================================
// DATA PERSISTENTIE
// ============================================================================

function saveSettings() {
    localStorage.setItem('drankspel_settings', JSON.stringify(gameState.settings));
}

function loadSettings() {
    const saved = localStorage.getItem('drankspel_settings');
    if (saved) {
        gameState.settings = { ...gameState.settings, ...JSON.parse(saved) };
        updateSettingsUI();
    }
}

function saveScoreboard() {
    localStorage.setItem('drankspel_scoreboard', JSON.stringify(gameState.players));
}

function loadScoreboard() {
    const saved = localStorage.getItem('drankspel_scoreboard');
    if (saved) {
        gameState.players = JSON.parse(saved);
        updateScoreboard();
    }
}

function updateSettingsUI() {
    document.getElementById('playerCount').value = gameState.settings.playerCount;
    document.getElementById('playerCountDisplay').textContent = gameState.settings.playerCount;
    document.getElementById('drinkUnit').value = gameState.settings.drinkUnit;
    document.getElementById('animationSpeed').value = gameState.settings.animationSpeed;
    document.getElementById('soundEnabled').checked = gameState.settings.soundEnabled;
    
    // Update player name inputs
    for (let i = 0; i < 8; i++) {
        const input = document.getElementById(`playerName${i + 1}`);
        if (input) {
            input.value = gameState.settings.playerNames[i] || `Speler ${i + 1}`;
            input.style.display = i < gameState.settings.playerCount ? 'block' : 'none';
        }
    }
}

// ============================================================================
// SCREEN NAVIGATIE
// ============================================================================

function showScreen(screenId) {
    // Verberg alle schermen
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => screen.classList.remove('active'));
    
    // Toon gewenst scherm
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
        console.log(`📱 Switched to screen: ${screenId}`);
    } else {
        console.error(`❌ Screen not found: ${screenId}`);
    }
}

function showStartScreen() {
    showScreen('startScreen');
}

function showGameSelection() {
    showScreen('gameSelection');
}

function showSettings() {
    showScreen('settingsScreen');
    updateSettingsUI();
}

function showScoreboard() {
    showScreen('scoreboardScreen');
    updateScoreboard();
}

function showGameRules(gameType) {
    // Implementation will be added per game
    console.log(`📖 Showing rules for: ${gameType}`);
}

// ============================================================================
// INSTELLINGEN MANAGEMENT
// ============================================================================

function updatePlayerCount() {
    const count = document.getElementById('playerCount').value;
    document.getElementById('playerCountDisplay').textContent = count;
    gameState.settings.playerCount = parseInt(count);
    
    // Show/hide player name inputs
    for (let i = 0; i < 8; i++) {
        const input = document.getElementById(`playerName${i + 1}`);
        if (input) {
            input.style.display = i < gameState.settings.playerCount ? 'block' : 'none';
        }
    }
    
    saveSettings();
}

function updatePlayerName(index, name) {
    gameState.settings.playerNames[index] = name;
    saveSettings();
}

function updateDrinkUnit() {
    gameState.settings.drinkUnit = document.getElementById('drinkUnit').value;
    saveSettings();
}

function updateAnimationSpeed() {
    gameState.settings.animationSpeed = document.getElementById('animationSpeed').value;
    saveSettings();
}

function toggleSound() {
    gameState.settings.soundEnabled = document.getElementById('soundEnabled').checked;
    saveSettings();
}

function resetSettings() {
    gameState.settings = {
        playerCount: 4,
        playerNames: ['Speler 1', 'Speler 2', 'Speler 3', 'Speler 4'],
        drinkUnit: 'slokken',
        animationSpeed: 'standaard',
        soundEnabled: true
    };
    updateSettingsUI();
    saveSettings();
}

// ============================================================================
// SCOREBOARD MANAGEMENT
// ============================================================================

function updateScoreboard() {
    const container = document.getElementById('scoreList');
    container.innerHTML = '';
    
    gameState.players.forEach((player, index) => {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'score-item';
        playerDiv.innerHTML = `
            <span class="player-name">${player.name}</span>
            <span class="player-score">${player.score} ${gameState.settings.drinkUnit}</span>
            <button class="btn btn-small" onclick="adjustScore(${index}, -1)">-</button>
            <button class="btn btn-small" onclick="adjustScore(${index}, 1)">+</button>
        `;
        container.appendChild(playerDiv);
    });
}

function adjustScore(playerIndex, change) {
    gameState.players[playerIndex].score += change;
    gameState.players[playerIndex].score = Math.max(0, gameState.players[playerIndex].score);
    updateScoreboard();
    saveScoreboard();
}

function resetScoreboard() {
    gameState.players.forEach(player => player.score = 0);
    updateScoreboard();
    saveScoreboard();
}

// ============================================================================
// SPEL STARTERS
// ============================================================================

function startGame(gameType) {
    gameState.currentGame = gameType;
    
    // Reset spel specifieke states
    if (gameType === 'paardenrace') {
        // Paardenrace implementation will be added
        console.log('🏇 Starting Paardenrace game');
    } else if (gameType === 'mexico') {
        // Mexico implementation will be added
        console.log('🎲 Starting Mexico game');
    } else if (gameType === 'bussen') {
        // Bussen implementation will be added
        console.log('🃏 Starting Bussen game');
    }
    
    // Show multiplayer lobby for now
    if (window.simpleLobby) {
        window.simpleLobby.showLobbyScreen();
    }
}

// ============================================================================
// GAME IMPLEMENTATIONS REMOVED - TO BE ADDED PER GAME
// ============================================================================

// ============================================================================
// PAARDENRACE GAME FUNCTIONS
// ============================================================================

function showRaceGame() {
    showScreen('paardenraceGame');
    resetRaceState();
    
    // Set host status for single player mode
    if (!gameState.isMultiplayer) {
        raceState.isHost = true;
        console.log('🏇 Single player mode - Host status set to true');
    }
    
    startBettingPhase();
}

function resetRaceState() {
    raceState.phase = 'betting';
    raceState.bettingTimer = 30;
    raceState.bettingInterval = null;
    raceState.cardDrawInterval = null;
    raceState.playerBets = {};
    raceState.horses = {
        '♠': 0, '♥': 0, '♦': 0, '♣': 0
    };
    raceState.trackCards = [];
    raceState.revealedCards = 0;
    raceState.drawPile = [];
    raceState.gameOver = false;
    raceState.winner = null;
    raceState.currentCard = null;
    raceState.raceSeed = null;
    raceState.drawnCards = 0;
    raceState.lastBettingUpdate = 0;
    
    // Reset UI phases
    const phases = ['bettingPhase', 'racePhase', 'resultsPhase'];
    phases.forEach(phaseId => {
        const element = document.getElementById(phaseId);
        if (element) {
            element.classList.remove('active');
        }
    });
    
    // Show betting phase
    const bettingPhase = document.getElementById('bettingPhase');
    if (bettingPhase) {
        bettingPhase.classList.add('active');
    }
}

// ============================================================================
// PAARDENRACE GAME FUNCTIONS (BASIC)
// ============================================================================

function startBettingPhase() {
    console.log('💰 Starting betting phase');
    
    // Reset bet counters and player lists
    ['♠', '♥', '♦', '♣'].forEach(suit => {
        const suitName = suit === '♠' ? 'spades' : 
                        suit === '♥' ? 'hearts' :
                        suit === '♦' ? 'diamonds' : 'clubs';
        
        // Reset count
        const countElement = document.getElementById(`bet-${suitName}`);
        if (countElement) {
            countElement.textContent = '0';
        }
        
        // Reset player names
        const playersElement = document.getElementById(`bet-players-${suitName}`);
        if (playersElement) {
            playersElement.textContent = '';
        }
    });
    
    // Start betting timer
    raceState.bettingTimer = 30;
    updateBettingTimer();
    
    // Only host starts the timer interval
    if (raceState.isHost) {
        console.log('⏰ Host starting betting timer');
        raceState.bettingInterval = setInterval(() => {
            raceState.bettingTimer--;
            updateBettingTimer();
            
            // Broadcast timer updates to other players (throttled)
            const now = Date.now();
            if (window.simpleSupabase && gameState.isMultiplayer && 
                now - raceState.lastBettingUpdate > 1000) {
                if (typeof broadcastBettingUpdate === 'function') {
                    broadcastBettingUpdate();
                }
                raceState.lastBettingUpdate = now;
            }
            
            if (raceState.bettingTimer <= 0) {
                endBettingPhase();
            }
        }, 1000);
    } else {
        console.log('⏰ Non-host waiting for timer updates from host');
    }
}

function updateBettingTimer() {
    const timerElement = document.getElementById('bettingTimer');
    if (timerElement) {
        timerElement.textContent = raceState.bettingTimer;
        
        // Change color when time is running out
        if (raceState.bettingTimer <= 10) {
            timerElement.style.background = '#e74c3c';
        } else if (raceState.bettingTimer <= 20) {
            timerElement.style.background = '#f39c12';
        } else {
            timerElement.style.background = '#ff6b6b';
        }
    }
}

function endBettingPhase() {
    console.log('⏰ Betting phase ended');
    
    // Stop timer
    if (raceState.bettingInterval) {
        clearInterval(raceState.bettingInterval);
        raceState.bettingInterval = null;
    }
    
    // Set timer to 0
    raceState.bettingTimer = 0;
    updateBettingTimer();
    
    // Assign random bets to players who didn't bet
    gameState.players.forEach(player => {
        if (!raceState.playerBets[player.id]) {
            const suits = ['♠', '♥', '♦', '♣'];
            const randomSuit = suits[Math.floor(Math.random() * suits.length)];
            raceState.playerBets[player.id] = randomSuit;
            console.log(`Random bet assigned: ${player.name} -> ${randomSuit}`);
        }
    });
    
    // Generate race seed for consistent randomness
    raceState.raceSeed = Date.now();
    
    // Start race phase first (host)
    startRacePhase();
    
    // Then broadcast race start to other players
    if (window.simpleSupabase && raceState.isHost && gameState.isMultiplayer) {
        if (typeof broadcastRaceStart === 'function') {
            broadcastRaceStart();
        }
    }
}

function startRacePhase() {
    console.log('🏇 Starting race phase');
    console.log('🏇 Host status:', raceState.isHost);
    
    raceState.phase = 'racing';
    
    // Hide betting phase, show race phase
    const bettingPhase = document.getElementById('bettingPhase');
    const racePhase = document.getElementById('racePhase');
    
    if (bettingPhase) bettingPhase.classList.remove('active');
    if (racePhase) racePhase.classList.add('active');
    
    // Create track cards
    if (typeof createTrackCards === 'function') {
        createTrackCards();
    }
    
    // Create draw pile
    if (typeof createDrawPile === 'function') {
        createDrawPile();
    }
    
    // Update UI
    if (typeof updateBetCounts === 'function') {
        updateBetCounts();
    }
    
    // Start automatic card drawing (only for host in multiplayer, or always in single player)
    if (raceState.isHost || !gameState.isMultiplayer) {
        console.log('🎴 Starting automatic card drawing');
        if (typeof startAutomaticCardDrawing === 'function') {
            startAutomaticCardDrawing();
        }
    } else {
        console.log('🎴 Not starting automatic drawing - not host');
    }
    
    // Show manual draw button as fallback
    const drawButton = document.getElementById('drawCard');
    if (drawButton) {
        drawButton.style.display = 'block';
        drawButton.textContent = 'Trek Kaart (Handmatig)';
    }
}

// ============================================================================
// EFFECTEN EN ANIMATIES
// ============================================================================

function createConfetti() {
    const container = document.getElementById('confetti');
    container.innerHTML = '';
    
    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.animationDelay = Math.random() * 2 + 's';
        confetti.style.animationDuration = (Math.random() * 3 + 2) + 's';
        container.appendChild(confetti);
    }
    
    // Remove confetti after animation
    setTimeout(() => {
        container.innerHTML = '';
    }, 5000);
}

function playSound(type) {
    if (!gameState.settings.soundEnabled) return;
    
    // Simple sound implementation
    const audio = new Audio();
    audio.volume = 0.3;
    
    switch (type) {
        case 'card':
            // Card flip sound
            break;
        case 'dice':
            // Dice roll sound
            break;
        case 'win':
            // Win sound
            break;
        default:
            break;
    }
}

// ============================================================================
// TOEGANKELIJKHEID EN KEYBOARD NAVIGATIE
// ============================================================================

document.addEventListener('keydown', function(e) {
    // Escape toets om terug te gaan
    if (e.key === 'Escape') {
        if (gameState.currentGame) {
            showGameSelection();
        } else {
            showStartScreen();
        }
    }
    
    // Enter toets voor acties
    if (e.key === 'Enter' && e.target.tagName === 'BUTTON') {
        e.target.click();
    }
});

// ============================================================================
// CSS ANIMATIES TOEVOEGEN
// ============================================================================

// Voeg CSS animaties toe
const style = document.createElement('style');
style.textContent = `
    @keyframes slideDown {
        from { transform: translateY(-20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
    }
    
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    
    @keyframes bounce {
        0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
        40% { transform: translateY(-10px); }
        60% { transform: translateY(-5px); }
    }
    
    .screen.active {
        animation: slideDown 0.3s ease-out;
    }
    
    .btn:hover {
        animation: bounce 0.6s ease;
    }
`;
document.head.appendChild(style);

// ============================================================================
// MULTIPLAYER FUNCTIONALITEIT (Simple Supabase)
// ============================================================================

// Oude WebSocket functies verwijderd - we gebruiken nu simpleSupabase

// ============================================================================
// ROOMS AUTO-REFRESH FUNCTIONS
// ============================================================================

function startRoomsAutoRefresh() {
    // Stop any existing interval
    stopRoomsAutoRefresh();
    
    // Start new interval
    if (window.roomsAutoRefreshInterval) {
        clearInterval(window.roomsAutoRefreshInterval);
    }
    
    window.roomsAutoRefreshInterval = setInterval(() => {
        if (window.simpleLobby && window.simpleLobby.refreshRooms) {
            window.simpleLobby.refreshRooms();
        }
    }, 5000); // Refresh every 5 seconds
}

function stopRoomsAutoRefresh() {
    if (window.roomsAutoRefreshInterval) {
        clearInterval(window.roomsAutoRefreshInterval);
        window.roomsAutoRefreshInterval = null;
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function generateRoomCode() {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
}

function showNotification(message, type = 'info') {
    console.log(`📢 ${type.toUpperCase()}: ${message}`);
    // Simple notification - can be enhanced with UI
}

// ============================================================================
// END OF FILE
// ============================================================================