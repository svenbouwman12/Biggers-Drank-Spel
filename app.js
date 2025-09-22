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
    console.log(`📱 showScreen() called with: ${screenId}`);
    
    // Verberg alle schermen
    const screens = document.querySelectorAll('.screen');
    console.log(`📱 Found ${screens.length} screens`);
    screens.forEach(screen => screen.classList.remove('active'));
    
    // Toon gewenst scherm
    const targetScreen = document.getElementById(screenId);
    console.log(`📱 Target screen element:`, targetScreen);
    
    if (targetScreen) {
        targetScreen.classList.add('active');
        console.log(`📱 Switched to screen: ${screenId}`);
        console.log(`📱 Target screen classes:`, targetScreen.className);
    } else {
        console.error(`❌ Screen not found: ${screenId}`);
        console.error(`❌ Available screens:`, Array.from(document.querySelectorAll('.screen')).map(s => s.id));
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
    
    console.log(`🎮 Game state:`, gameState);
    console.log(`🎮 Race state:`, raceState);
    
    // Reset spel specifieke states
    if (gameType === 'paardenrace') {
        console.log('🏇 Starting Paardenrace game');
        console.log(`🏇 About to call showRaceGame()`);
        showRaceGame();
        console.log(`🏇 showRaceGame() called`);
    } else if (gameType === 'mexico') {
        console.log('🎲 Starting Mexico game');
        alert('Mexico game is nog niet geïmplementeerd!');
    } else if (gameType === 'bussen') {
        console.log('🃏 Starting Bussen game');
        alert('Bussen game is nog niet geïmplementeerd!');
    }
}

// ============================================================================
// GAME IMPLEMENTATIONS REMOVED - TO BE ADDED PER GAME
// ============================================================================

// ============================================================================
// PAARDENRACE GAME FUNCTIONS
// ============================================================================

function showRaceGame() {
    console.log('🏇 showRaceGame() called');
    console.log('🏇 About to call showScreen("paardenraceGame")');
    
    showScreen('paardenraceGame');
    console.log('🏇 showScreen() called');
    
    console.log('🏇 About to call resetRaceState()');
    resetRaceState();
    console.log('🏇 resetRaceState() called');
    
    // Set host status for single player mode
    if (!gameState.isMultiplayer) {
        raceState.isHost = true;
        console.log('🏇 Single player mode - Host status set to true');
    }
    
    console.log('🏇 About to call startBettingPhase()');
    startBettingPhase();
    console.log('🏇 startBettingPhase() called');
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
    createTrackCards();
    
    // Position aces in main grid
    positionAcesInGrid();
    
    // Create draw pile
    createDrawPile();
    
    // Update UI
    updateBetCounts();
    
    // Start automatic card drawing (only for host in multiplayer, or always in single player)
    if (raceState.isHost || !gameState.isMultiplayer) {
        console.log('🎴 Starting automatic card drawing');
        startAutomaticCardDrawing();
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

function positionAcesInGrid() {
    console.log('🏇 Positioning aces in main grid');
    
    const aces = [
        { id: 'horse-spades', suit: '♠', row: 2 },
        { id: 'horse-hearts', suit: '♥', row: 3 },
        { id: 'horse-diamonds', suit: '♦', row: 4 },
        { id: 'horse-clubs', suit: '♣', row: 5 }
    ];
    
    aces.forEach(ace => {
        const aceElement = document.getElementById(ace.id);
        if (aceElement) {
            aceElement.style.gridColumn = 1; // Start at column 1
            aceElement.style.gridRow = ace.row; // Each ace in its own row
            console.log(`🏇 Positioned ${ace.suit} at row ${ace.row}, column 1`);
        }
    });
}

function createTrackCards() {
    console.log('🎴 Creating track cards');
    const trackCardsContainer = document.getElementById('trackCards');
    if (!trackCardsContainer) return;
    
    trackCardsContainer.innerHTML = '';
    raceState.trackCards = [];
    
    for (let i = 0; i < raceState.trackLength; i++) {
        const cardElement = document.createElement('div');
        cardElement.className = 'track-card';
        cardElement.textContent = '?';
        cardElement.setAttribute('data-position', i);
        // Position directly in main grid
        cardElement.style.gridColumn = i + 1;
        cardElement.style.gridRow = 1;
        trackCardsContainer.appendChild(cardElement);
        
        raceState.trackCards.push({
            position: i,
            suit: null,
            rank: null,
            revealed: false
        });
    }
}

function createDrawPile() {
    console.log('🎴 Creating draw pile');
    raceState.drawPile = [];
    
    const suits = ['♠', '♥', '♦', '♣'];
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    
    // Create a full deck
    for (let suit of suits) {
        for (let rank of ranks) {
            raceState.drawPile.push({ suit, rank });
        }
    }
    
    // Shuffle the deck
    for (let i = raceState.drawPile.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [raceState.drawPile[i], raceState.drawPile[j]] = [raceState.drawPile[j], raceState.drawPile[i]];
    }
    
    console.log(`🎴 Created draw pile with ${raceState.drawPile.length} cards`);
}

function updateBetCounts() {
    console.log('💰 Updating bet counts');
    
    // Initialize bet counts
    const betPlayers = {
        '♠': [],
        '♥': [],
        '♦': [],
        '♣': []
    };
    
    // Count bets
    Object.entries(raceState.playerBets).forEach(([playerId, suit]) => {
        const player = gameState.players.find(p => p.id === playerId);
        if (player && betPlayers[suit]) {
            betPlayers[suit].push(player.name);
        }
    });
    
    // Update UI
    ['♠', '♥', '♦', '♣'].forEach(suit => {
        const suitName = suit === '♠' ? 'spades' : 
                        suit === '♥' ? 'hearts' :
                        suit === '♦' ? 'diamonds' : 'clubs';
        
        const countElement = document.getElementById(`bet-${suitName}`);
        const playersElement = document.getElementById(`bet-players-${suitName}`);
        
        if (countElement) {
            countElement.textContent = betPlayers[suit].length;
        }
        
        if (playersElement) {
            playersElement.textContent = betPlayers[suit].join(', ');
        }
    });
}

function startAutomaticCardDrawing() {
    console.log('🎴 Starting automatic card drawing');
    console.log('🎴 Draw pile size:', raceState.drawPile.length);
    console.log('🎴 Card draw delay:', raceState.cardDrawDelay);
    
    // Clear any existing interval
    if (raceState.cardDrawInterval) {
        clearInterval(raceState.cardDrawInterval);
        raceState.cardDrawInterval = null;
    }
    
    raceState.cardDrawInterval = setInterval(() => {
        console.log('🎴 Interval tick - Phase:', raceState.phase, 'GameOver:', raceState.gameOver);
        
        if (raceState.phase === 'racing' && !raceState.gameOver && raceState.drawPile.length > 0) {
            console.log('🎴 Drawing card automatically');
            drawRaceCard();
        } else {
            console.log('🎴 Stopping automatic card drawing');
            stopAutomaticCardDrawing();
        }
    }, raceState.cardDrawDelay);
    
    console.log('🎴 Automatic card drawing interval started');
}

function stopAutomaticCardDrawing() {
    if (raceState.cardDrawInterval) {
        clearInterval(raceState.cardDrawInterval);
        raceState.cardDrawInterval = null;
        console.log('🎴 Automatic card drawing stopped');
    }
}

function drawRaceCard() {
    console.log('🎴 drawRaceCard called - Phase:', raceState.phase, 'GameOver:', raceState.gameOver);
    
    if (raceState.phase !== 'racing' || raceState.gameOver || raceState.drawPile.length === 0) {
        console.log('🎴 Cannot draw card - game not in racing phase or game over');
        return;
    }
    
    // Draw a card
    const drawnCard = raceState.drawPile.pop();
    raceState.currentCard = drawnCard;
    raceState.drawnCards++;
    
    console.log('🎴 Drew card:', drawnCard.rank, drawnCard.suit);
    console.log('🎴 Remaining cards:', raceState.drawPile.length);
    
    // Update UI
    const currentCardElement = document.getElementById('currentCard');
    const cardDescriptionElement = document.getElementById('cardDescription');
    
    if (currentCardElement) {
        currentCardElement.textContent = drawnCard.rank + ' ' + drawnCard.suit;
        currentCardElement.className = 'card';
    }
    
    if (cardDescriptionElement) {
        cardDescriptionElement.textContent = `${drawnCard.rank} ${drawnCard.suit} getrokken`;
    }
    
    console.log('🎴 Card UI updated');
    
    // Move the corresponding horse
    moveHorse(drawnCard.suit);
    
    // Broadcast to other players
    if (window.simpleSupabase && gameState.isMultiplayer && raceState.isHost) {
        console.log('🎴 Broadcasting card to other players');
        broadcastRaceCard(drawnCard);
    }
    
    // Check for race winner
    checkRaceWinner();
}

function moveHorse(suit) {
    console.log('🐎 Moving horse', suit, 'forward from position', raceState.horses[suit]);
    
    // Move horse forward
    raceState.horses[suit]++;
    
    console.log('🐎 Horse', suit, 'now at position', raceState.horses[suit]);
    
    // Update horse position in grid
    updateHorsePosition(suit);
    
    // Check if horse passed a track card
    checkTrackCardReveal();
}

function updateHorsePosition(suit) {
    const horseElement = document.getElementById(`horse-${suit === '♠' ? 'spades' : 
                                                      suit === '♥' ? 'hearts' :
                                                      suit === '♦' ? 'diamonds' : 'clubs'}`);
    
    if (!horseElement) return;
    
    const row = getHorseRow(suit);
    const column = raceState.horses[suit] + 1; // +1 because grid is 1-indexed
    
    console.log(`📍 Updating horse ${suit} position to row ${row}, column ${column}`);
    
    // Set grid position directly in main grid
    horseElement.style.gridRow = row;
    horseElement.style.gridColumn = column;
    
    console.log(`📍 Horse ${suit} positioned at row ${row}, column ${column}`);
}

function getHorseRow(suit) {
    const suitMap = {
        '♠': 2, // Row 2 in main grid
        '♥': 3, // Row 3 in main grid
        '♦': 4, // Row 4 in main grid
        '♣': 5  // Row 5 in main grid
    };
    return suitMap[suit] || 2;
}

function checkTrackCardReveal() {
    // Check if any horse has passed all track cards
    const maxPosition = Math.max(...Object.values(raceState.horses));
    
    if (maxPosition > raceState.revealedCards) {
        // Reveal the next track card
        raceState.revealedCards = maxPosition;
        
        if (raceState.revealedCards < raceState.trackLength) {
            // Reveal the track card
            const trackCardElement = document.querySelector(`[data-position="${raceState.revealedCards - 1}"]`);
            if (trackCardElement) {
                // Draw a random card for the track
                const trackCard = raceState.drawPile.pop();
                trackCardElement.textContent = trackCard.rank + ' ' + trackCard.suit;
                trackCardElement.classList.add('revealed');
                
                console.log(`🎴 Revealed track card at position ${raceState.revealedCards - 1}: ${trackCard.rank} ${trackCard.suit}`);
                
                // Move the corresponding horse back
                raceState.horses[trackCard.suit]--;
                updateHorsePosition(trackCard.suit);
            }
        }
    }
}

function checkRaceWinner() {
    // Check if any horse has reached the finish (position 8)
    for (const [suit, position] of Object.entries(raceState.horses)) {
        if (position >= 8) {
            raceState.gameOver = true;
            raceState.winner = suit;
            console.log(`🏆 Race winner: ${suit} at position ${position}`);
            showRaceResults();
            return;
        }
    }
}

function showRaceResults() {
    console.log('🏆 Showing race results');
    
    raceState.phase = 'results';
    
    // Hide race phase, show results phase
    const racePhase = document.getElementById('racePhase');
    const resultsPhase = document.getElementById('resultsPhase');
    
    if (racePhase) racePhase.classList.remove('active');
    if (resultsPhase) resultsPhase.classList.add('active');
    
    // Show results
    const resultsElement = document.getElementById('raceResults');
    if (resultsElement && raceState.winner) {
        resultsElement.innerHTML = `
            <div class="winner-display">
                <h3>🏆 Winnaar: ${raceState.winner}</h3>
                <p>De ${raceState.winner} aas heeft de race gewonnen!</p>
            </div>
            <div class="drink-rules">
                <h4>🍻 Drinkregels:</h4>
                <p>Winnaars mogen drankjes uitdelen</p>
                <p>Verliezers moeten drinken</p>
            </div>
        `;
    }
}

function resetRaceGame() {
    console.log('🔄 Resetting race game');
    
    // Stop any intervals
    stopAutomaticCardDrawing();
    if (raceState.bettingInterval) {
        clearInterval(raceState.bettingInterval);
        raceState.bettingInterval = null;
    }
    
    // Reset to betting phase
    showRaceGame();
}

function broadcastRaceCard(card) {
    if (!window.simpleSupabase || !gameState.isMultiplayer) return;
    
    const eventData = {
        card: card,
        horses: raceState.horses,
        drawnCards: raceState.drawnCards,
        gameOver: raceState.gameOver,
        winner: raceState.winner
    };
    
    console.log('📡 Broadcasting race card:', card);
    
    window.simpleSupabase.addGameEvent({
        room_code: lobbyState.currentRoom?.code,
        event_type: 'race_card',
        event_data: eventData
    });
}

function handleRaceCardBroadcast(eventData) {
    console.log('📥 Received race card broadcast:', eventData);
    
    if (!raceState.isHost) {
        // Update race state from broadcast
        raceState.horses = { ...eventData.horses };
        raceState.drawnCards = eventData.drawnCards;
        raceState.gameOver = eventData.gameOver;
        raceState.winner = eventData.winner;
        
        // Update UI
        updateRaceUIFromBroadcast(eventData);
    }
}

function updateRaceUIFromBroadcast(eventData) {
    // Update current card display
    const currentCardElement = document.getElementById('currentCard');
    const cardDescriptionElement = document.getElementById('cardDescription');
    
    if (currentCardElement && eventData.card) {
        currentCardElement.textContent = eventData.card.rank + ' ' + eventData.card.suit;
        currentCardElement.className = 'card';
    }
    
    if (cardDescriptionElement && eventData.card) {
        cardDescriptionElement.textContent = `${eventData.card.rank} ${eventData.card.suit} getrokken`;
    }
    
    // Update horse positions
    Object.keys(raceState.horses).forEach(suit => {
        updateHorsePosition(suit);
    });
    
    // Update track cards if needed
    updateTrackCardsFromBroadcast(eventData);
}

function updateTrackCardsFromBroadcast(eventData) {
    // This would update revealed track cards if needed
    console.log('🎴 Updating track cards from broadcast');
}

function broadcastBettingUpdate() {
    if (!window.simpleSupabase || !gameState.isMultiplayer) return;
    
    const eventData = {
        playerBets: raceState.playerBets,
        bettingTimer: raceState.bettingTimer
    };
    
    console.log('📡 Broadcasting betting update');
    
    window.simpleSupabase.addGameEvent({
        room_code: lobbyState.currentRoom?.code,
        event_type: 'betting_update',
        event_data: eventData
    });
}

function handleBettingUpdateBroadcast(eventData) {
    console.log('📥 Received betting update broadcast');
    
    if (!raceState.isHost) {
        raceState.playerBets = { ...eventData.playerBets };
        raceState.bettingTimer = eventData.bettingTimer;
        updateBettingTimer();
        updateBetCounts();
    }
}

function broadcastRaceStart() {
    if (!window.simpleSupabase || !gameState.isMultiplayer) return;
    
    const eventData = {
        playerBets: raceState.playerBets,
        horses: raceState.horses,
        raceSeed: raceState.raceSeed
    };
    
    console.log('📡 Broadcasting race start');
    
    window.simpleSupabase.addGameEvent({
        room_code: lobbyState.currentRoom?.code,
        event_type: 'race_start',
        event_data: eventData
    });
}

function handleRaceStartBroadcast(eventData) {
    console.log('📥 Received race start broadcast');
    
    if (raceState.phase === 'racing') {
        return; // Already in racing phase
    }
    
    raceState.playerBets = { ...eventData.playerBets };
    raceState.horses = { ...eventData.horses };
    raceState.raceSeed = eventData.raceSeed;
    
    console.log('🏇 Starting race phase');
    startRacePhase();
}

function handleRaceGameEvent(event) {
    console.log('🎮 Handling race game event:', event.event_type);
    
    switch (event.event_type) {
        case 'race_card':
            handleRaceCardBroadcast(event.event_data);
            break;
        case 'betting_update':
            handleBettingUpdateBroadcast(event.event_data);
            break;
        case 'race_start':
            handleRaceStartBroadcast(event.event_data);
            break;
        default:
            console.log('🎮 Unknown race event type:', event.event_type);
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