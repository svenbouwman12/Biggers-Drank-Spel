// ============================================================================
// DRANKSPEL PARTY - Multiplayer Lobby System
// ============================================================================

// Globale variabelen
let gameState = {
    players: [],
    currentGame: null,
    settings: {
        playerCount: 4,
        drinkUnit: 'slokken',
        animationSpeed: 'normal',
        soundEnabled: true
    },
    scores: {},
    // Multiplayer state
    isMultiplayer: false,
    isHost: false,
    roomCode: null,
    playerId: null,
    playerName: null,
    connectionStatus: 'disconnected'
};

// WebSocket verbinding
let socket = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

// Rooms auto-refresh
let roomsAutoRefreshInterval = null;

// Lobby state
let lobbyState = {
    room: null,
    players: [],
    gameType: null,
    gameStarted: false,
    currentTurn: 0
};

// Spel specifieke variabelen
let raceState = {
    phase: 'betting', // 'betting', 'racing', 'results'
    bettingTimer: 30,
    bettingInterval: null,
    cardDrawInterval: null, // Automatisch kaart trekken
    cardDrawDelay: 2000, // 2 seconden tussen kaarten
    playerBets: {}, // {playerId: suit}
    horses: {
        '♠': 0, // Schoppen
        '♥': 0, // Harten  
        '♦': 0, // Ruiten
        '♣': 0  // Klaveren
    },
    trackLength: 8, // Aantal kaarten op de baan
    trackCards: [], // Kaarten op de baan
    revealedCards: 0, // Aantal omgedraaide kaarten
    drawPile: [], // Trekstapel
    gameOver: false,
    winner: null,
    currentCard: null,
    isHost: false, // Of deze client de host is
    raceSeed: null, // Seed voor consistente random kaarten
    drawnCards: 0 // Aantal getrokken kaarten
};

let mexicoState = {
    currentPlayer: 0,
    round: 1,
    scores: [],
    gameOver: false
};

let bussenState = {
    phase: 'questions', // 'questions' of 'bus'
    currentCard: null,
    previousCards: [],
    questionType: 0,
    deck: [],
    busCards: [],
    currentBusCard: 0
};

// ============================================================================
// INITIALISATIE
// ============================================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🎉 Drankspel Party geladen!');
    
    // Laad opgeslagen gegevens
    loadSettings();
    loadScores();
    
    // Reset multiplayer state (in case of page refresh)
    resetMultiplayerState();
    
    // Initialiseer spelers
    initializePlayers();
    
    // Update UI
    updatePlayerCount();
    updateScoreboard();
    
    // Wacht tot pagina volledig geladen is voor Simple Supabase
    window.addEventListener('load', function() {
        setTimeout(() => {
            if (window.simpleSupabase) {
                window.simpleSupabase.initialize();
            }
        }, 500); // Wacht 500ms extra
    });
    
    console.log('✅ App geïnitialiseerd');
});

function resetMultiplayerState() {
    // Reset multiplayer state in case of page refresh
    gameState.isMultiplayer = false;
    gameState.isHost = false;
    gameState.roomCode = null;
    gameState.playerId = null;
    gameState.playerName = null;
    gameState.connectionStatus = 'disconnected';
    
    // Reset lobby state
    lobbyState.room = null;
    lobbyState.players = [];
    lobbyState.gameType = null;
    lobbyState.gameStarted = false;
    lobbyState.currentTurn = 0;
    
    // Hide lobby status
    const lobbyStatus = document.getElementById('lobbyStatus');
    if (lobbyStatus) {
        lobbyStatus.style.display = 'none';
    }
    
    console.log('🔄 Multiplayer state reset (page refresh detected)');
}

// Oude Supabase functie verwijderd - we gebruiken nu simpleSupabase

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
    updatePlayerNames();
}

function showRules() {
    showScreen('rulesScreen');
}

function showGameRules(gameType) {
    // Voor nu tonen we het algemene regels scherm
    // Later kunnen we specifieke regels per spel tonen
    showRules();
}

function showLobbyScreen() {
    showScreen('lobbyScreen');
    // Reset lobby status
    document.getElementById('lobbyStatus').style.display = 'none';
    showLobbyTab('create');
}

function showLobbyTab(tabName, clickedButton = null) {
    try {
        console.log('🔄 Switching to tab:', tabName);
        
        // Verberg alle tabs
        const tabs = document.querySelectorAll('.lobby-tab');
        tabs.forEach(tab => {
            if (tab && tab.classList) {
                tab.classList.remove('active');
            }
        });
        
        // Verberg alle tab buttons
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(btn => {
            if (btn && btn.classList) {
                btn.classList.remove('active');
            }
        });
        
        // Toon geselecteerde tab
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
        
        // Activeer de juiste tab button
        if (clickedButton && clickedButton.classList) {
            // Als functie wordt aangeroepen vanuit een klik
            clickedButton.classList.add('active');
        } else {
            // Als functie wordt aangeroepen vanuit code
            const activeTabButton = document.querySelector(`[onclick*="showLobbyTab('${tabName}'"]`);
            if (activeTabButton && activeTabButton.classList) {
                activeTabButton.classList.add('active');
            } else {
                console.log('⚠️ Tab button not found for:', tabName);
            }
        }
        
    // Automatisch rooms verversen wanneer je naar "rooms" tab gaat
    if (tabName === 'rooms') {
        console.log('🔄 Auto-refreshing rooms...');
        if (window.simpleLobby && window.simpleLobby.refreshRooms) {
            window.simpleLobby.refreshRooms(); // Use new simple lobby function
        }
        
        // Start auto-refresh interval for rooms tab
        startRoomsAutoRefresh();
    } else {
        // Stop auto-refresh when leaving rooms tab
        stopRoomsAutoRefresh();
    }
        
        console.log('✅ Tab switched successfully:', tabName);
        
    } catch (error) {
        console.error('❌ Error switching tab:', error);
    }
}

// ============================================================================
// INSTELLINGEN MANAGEMENT
// ============================================================================

function updatePlayerCount() {
    const count = document.getElementById('playerCount').value;
    document.getElementById('playerCountDisplay').textContent = count;
    gameState.settings.playerCount = parseInt(count);
    
    // Update spelers array
    initializePlayers();
    updatePlayerNames();
}

function initializePlayers() {
    const count = gameState.settings.playerCount;
    gameState.players = [];
    
    for (let i = 1; i <= count; i++) {
        gameState.players.push({
            id: i,
            name: `Speler ${i}`,
            score: gameState.scores[i] || 0
        });
    }
}

function updatePlayerNames() {
    const container = document.getElementById('playerNames');
    container.innerHTML = '';
    
    gameState.players.forEach(player => {
        const div = document.createElement('div');
        div.className = 'player-name-input';
        div.innerHTML = `
            <label>Speler ${player.id}:</label>
            <input type="text" 
                   value="${player.name}" 
                   onchange="updatePlayerName(${player.id}, this.value)"
                   placeholder="Naam invoeren">
        `;
        container.appendChild(div);
    });
}

function updatePlayerName(playerId, newName) {
    const player = gameState.players.find(p => p.id === playerId);
    if (player) {
        player.name = newName || `Speler ${playerId}`;
        saveSettings();
    }
}

function saveSettings() {
    // Update settings object
    gameState.settings.playerCount = parseInt(document.getElementById('playerCount').value);
    gameState.settings.drinkUnit = document.getElementById('drinkUnit').value;
    gameState.settings.animationSpeed = document.getElementById('animationSpeed').value;
    gameState.settings.soundEnabled = document.getElementById('soundEnabled').checked;
    
    // Sla op in localStorage
    localStorage.setItem('drankspel_settings', JSON.stringify(gameState.settings));
    localStorage.setItem('drankspel_players', JSON.stringify(gameState.players));
    
    // Update scores object
    gameState.players.forEach(player => {
        gameState.scores[player.id] = player.score;
    });
    localStorage.setItem('drankspel_scores', JSON.stringify(gameState.scores));
    
    console.log('💾 Instellingen opgeslagen');
    
    // Toon bevestiging
    showNotification('Instellingen opgeslagen! 💾');
}

function loadSettings() {
    const savedSettings = localStorage.getItem('drankspel_settings');
    const savedPlayers = localStorage.getItem('drankspel_players');
    
    if (savedSettings) {
        gameState.settings = { ...gameState.settings, ...JSON.parse(savedSettings) };
    }
    
    if (savedPlayers) {
        const players = JSON.parse(savedPlayers);
        gameState.players = players;
        gameState.settings.playerCount = players.length;
    }
    
    // Update UI
    document.getElementById('playerCount').value = gameState.settings.playerCount;
    document.getElementById('drinkUnit').value = gameState.settings.drinkUnit;
    document.getElementById('animationSpeed').value = gameState.settings.animationSpeed;
    document.getElementById('soundEnabled').checked = gameState.settings.soundEnabled;
}

function loadScores() {
    const savedScores = localStorage.getItem('drankspel_scores');
    if (savedScores) {
        gameState.scores = JSON.parse(savedScores);
    }
}

// ============================================================================
// SCOREBOARD MANAGEMENT
// ============================================================================

function updateScoreboard() {
    const container = document.getElementById('scoreList');
    container.innerHTML = '';
    
    gameState.players.forEach(player => {
        const div = document.createElement('div');
        div.className = 'score-item';
        div.innerHTML = `
            <span class="player-name">${player.name}</span>
            <span class="player-score">${player.score} ${gameState.settings.drinkUnit}</span>
        `;
        container.appendChild(div);
    });
}

function addScore(playerId, points) {
    const player = gameState.players.find(p => p.id === playerId);
    if (player) {
        player.score += points;
        gameState.scores[playerId] = player.score;
        updateScoreboard();
        saveSettings();
    }
}

function resetScores() {
    gameState.players.forEach(player => {
        player.score = 0;
        gameState.scores[player.id] = 0;
    });
    updateScoreboard();
    saveSettings();
    showNotification('Scores gereset! 🔄');
}

// ============================================================================
// SPEL STARTERS
// ============================================================================

function startGame(gameType) {
    gameState.currentGame = gameType;
    
    // Reset spel specifieke states
    if (gameType === 'paardenrace') {
        resetRaceState();
        showRaceGame();
    } else if (gameType === 'mexico') {
        resetMexicoState();
        showMexicoGame();
    } else if (gameType === 'bussen') {
        resetBussenState();
        showBussenGame();
    }
}

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

function showMexicoGame() {
    showScreen('mexicoGame');
    updateCurrentPlayer();
    updateMexicoScoreboard();
}

function showBussenGame() {
    showScreen('bussenGame');
    setupBussenGame();
}

// ============================================================================
// PAARDENRACE SPEL
// ============================================================================

function resetRaceState() {
    raceState.phase = 'betting';
    raceState.bettingTimer = 30;
    raceState.bettingInterval = null;
    raceState.cardDrawInterval = null;
    raceState.cardDrawDelay = 2000;
    raceState.playerBets = {};
    raceState.horses = {
        '♠': 0, '♥': 0, '♦': 0, '♣': 0
    };
    raceState.trackLength = 8;
    raceState.trackCards = [];
    raceState.revealedCards = 0;
    raceState.drawPile = [];
    raceState.gameOver = false;
    raceState.winner = null;
    raceState.currentCard = null;
    raceState.isHost = false;
    raceState.raceSeed = null;
    raceState.drawnCards = 0;
    
    // Reset UI
    const bettingPhase = document.getElementById('bettingPhase');
    const racePhase = document.getElementById('racePhase');
    const resultsPhase = document.getElementById('resultsPhase');
    
    if (bettingPhase) bettingPhase.style.display = 'block';
    if (racePhase) racePhase.style.display = 'none';
    if (resultsPhase) resultsPhase.style.display = 'none';
}

// ============================================================================
// NIEUWE PAARDENRACE SPEL (Originele Regels)
// ============================================================================

function startBettingPhase() {
    console.log('💰 Starting betting phase');
    
    // Reset bet counters
    ['♠', '♥', '♦', '♣'].forEach(suit => {
        const elementId = `bet-${suit === '♠' ? 'spades' : 
                               suit === '♥' ? 'hearts' :
                               suit === '♦' ? 'diamonds' : 'clubs'}`;
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = '0';
        }
    });
    
    // Start betting timer
    raceState.bettingTimer = 30;
    updateBettingTimer();
    raceState.bettingInterval = setInterval(() => {
        raceState.bettingTimer--;
        updateBettingTimer();
        
        if (raceState.bettingTimer <= 0) {
            endBettingPhase();
        }
    }, 1000);
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

function placeBet(suit) {
    if (raceState.phase !== 'betting') return;
    
    // Get current player ID (use lobby player ID if available)
    const playerId = currentPlayer ? currentPlayer.id : 1;
    
    // Place bet
    raceState.playerBets[playerId] = suit;
    
    // Update UI
    updateBetCounts();
    
    // Visual feedback
    const horseCards = document.querySelectorAll('.horse-card');
    horseCards.forEach(card => {
        card.classList.remove('selected');
        if (card.querySelector('.horse-symbol').textContent === suit) {
            card.classList.add('selected');
        }
    });
    
    // Broadcast betting update if multiplayer
    if (window.simpleSupabase && raceState.isHost) {
        broadcastBettingUpdate();
    }
    
    console.log(`Player ${playerId} bet on ${suit}`);
}

function updateBetCounts() {
    const betCounts = { '♠': 0, '♥': 0, '♦': 0, '♣': 0 };
    
    // Count bets
    Object.values(raceState.playerBets).forEach(suit => {
        betCounts[suit]++;
    });
    
    // Update UI
    Object.keys(betCounts).forEach(suit => {
        const elementId = `bet-${suit === '♠' ? 'spades' : 
                               suit === '♥' ? 'hearts' :
                               suit === '♦' ? 'diamonds' : 'clubs'}`;
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = betCounts[suit];
        }
    });
}

function endBettingPhase() {
    console.log('⏰ Betting phase ended');
    
    // Stop timer
    if (raceState.bettingInterval) {
        clearInterval(raceState.bettingInterval);
        raceState.bettingInterval = null;
    }
    
    // Assign random bets to players who didn't bet
    gameState.players.forEach(player => {
        if (!raceState.playerBets[player.id]) {
            const suits = ['♠', '♥', '♦', '♣'];
            const randomSuit = suits[Math.floor(Math.random() * suits.length)];
            raceState.playerBets[player.id] = randomSuit;
            console.log(`Random bet assigned: Player ${player.id} -> ${randomSuit}`);
        }
    });
    
    // Generate race seed for consistent randomness
    raceState.raceSeed = Date.now();
    
    // Broadcast race start if multiplayer
    if (window.simpleSupabase && raceState.isHost) {
        broadcastRaceStart();
    }
    
    // Start race phase
    startRacePhase();
}

function startRacePhase() {
    console.log('🏇 Starting race phase');
    console.log('🏇 Host status:', raceState.isHost);
    console.log('🏇 Game state:', gameState.isMultiplayer);
    
    raceState.phase = 'racing';
    
    // Hide betting phase, show race phase
    const bettingPhase = document.getElementById('bettingPhase');
    const racePhase = document.getElementById('racePhase');
    
    if (bettingPhase) bettingPhase.style.display = 'none';
    if (racePhase) racePhase.style.display = 'block';
    
    // Create track cards
    createTrackCards();
    
    // Create draw pile (remaining cards after removing track cards and aces)
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
    
    // Show manual draw button as fallback (always visible for debugging)
    const drawButton = document.getElementById('drawCard');
    if (drawButton) {
        drawButton.style.display = 'block';
        drawButton.textContent = 'Trek Kaart (Handmatig)';
    }
}

function createTrackCards() {
    const suits = ['♠', '♥', '♦', '♣'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    
    raceState.trackCards = [];
    const trackContainer = document.getElementById('trackCards');
    if (trackContainer) {
        trackContainer.innerHTML = '';
        
        for (let i = 0; i < raceState.trackLength; i++) {
            const suit = suits[Math.floor(Math.random() * suits.length)];
            const rank = ranks[Math.floor(Math.random() * ranks.length)];
            
            const card = {
                suit: suit,
                rank: rank,
                revealed: false
            };
            
            raceState.trackCards.push(card);
            
            // Create UI element
            const cardElement = document.createElement('div');
            cardElement.className = 'track-card';
            cardElement.id = `track-card-${i}`;
            trackContainer.appendChild(cardElement);
        }
    }
    
    // Setup ace cards with proper styling
    setupAceCards();
}

function setupAceCards() {
    const aces = [
        { id: 'horse-diamonds', suit: '♦', color: 'red' },
        { id: 'horse-clubs', suit: '♣', color: 'black' },
        { id: 'horse-hearts', suit: '♥', color: 'red' },
        { id: 'horse-spades', suit: '♠', color: 'black' }
    ];
    
    aces.forEach(ace => {
        const element = document.getElementById(ace.id);
        if (element) {
            element.textContent = ace.suit;
            element.className = `horse-ace ${ace.color}`;
            element.setAttribute('data-rank', 'A');
        }
    });
}

function createDrawPile() {
    const suits = ['♠', '♥', '♦', '♣'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    
    raceState.drawPile = [];
    
    // Add all cards except aces and track cards
    suits.forEach(suit => {
        ranks.forEach(rank => {
            // Skip if this card is already on the track
            const isOnTrack = raceState.trackCards.some(card => 
                card.suit === suit && card.rank === rank);
            
            if (!isOnTrack) {
                raceState.drawPile.push({ suit: suit, rank: rank });
            }
        });
    });
    
    // Shuffle draw pile
    for (let i = raceState.drawPile.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [raceState.drawPile[i], raceState.drawPile[j]] = [raceState.drawPile[j], raceState.drawPile[i]];
    }
    
    console.log(`Created draw pile with ${raceState.drawPile.length} cards`);
}

function drawRaceCard() {
    console.log('🎴 drawRaceCard called - Phase:', raceState.phase, 'GameOver:', raceState.gameOver);
    
    if (raceState.phase !== 'racing' || raceState.gameOver) {
        console.log('🎴 Cannot draw card - wrong phase or game over');
        return;
    }
    
    if (raceState.drawPile.length === 0) {
        console.log('🎴 No more cards to draw');
        return;
    }
    
    // Draw card
    raceState.currentCard = raceState.drawPile.pop();
    raceState.drawnCards++;
    
    console.log(`🎴 Drew card: ${raceState.currentCard.rank} ${raceState.currentCard.suit}`);
    console.log('🎴 Remaining cards:', raceState.drawPile.length);
    
    // Show card
    const cardElement = document.getElementById('currentCard');
    const descriptionElement = document.getElementById('cardDescription');
    
    if (cardElement && descriptionElement) {
        cardElement.textContent = raceState.currentCard.rank + raceState.currentCard.suit;
        cardElement.className = `card ${raceState.currentCard.suit === '♥' || raceState.currentCard.suit === '♦' ? 'red' : 'black'} revealing`;
        descriptionElement.textContent = `${raceState.currentCard.rank} ${raceState.currentCard.suit}`;
        console.log('🎴 Card UI updated');
    } else {
        console.log('🎴 Card elements not found!');
    }
    
    // Move horse forward
    moveHorse(raceState.currentCard.suit, 'forward');
    
    // Check if we need to reveal track cards
    checkTrackCardReveal();
    
    // Check for winner
    checkRaceWinner();
    
    // Play sound
    if (gameState.settings.soundEnabled) {
        playSound('card');
    }
}

function moveHorse(suit, direction) {
    if (direction === 'forward') {
        raceState.horses[suit]++;
    } else if (direction === 'backward') {
        raceState.horses[suit] = Math.max(0, raceState.horses[suit] - 1);
    }
    
    // Animate horse
    const horseElement = document.getElementById(`horse-${suit === '♠' ? 'spades' : 
                                                       suit === '♥' ? 'hearts' :
                                                       suit === '♦' ? 'diamonds' : 'clubs'}`);
    
    if (horseElement) {
        horseElement.classList.remove('moving', 'backwards');
        
        // Add appropriate animation class
        if (direction === 'forward') {
            horseElement.classList.add('moving');
        } else if (direction === 'backward') {
            horseElement.classList.add('backwards');
        }
        
        // Update visual position based on horse position
        updateHorsePosition(horseElement, raceState.horses[suit]);
        
        // Remove animation class after animation completes
        setTimeout(() => {
            horseElement.classList.remove('moving', 'backwards');
        }, 800);
    }
    
    console.log(`Horse ${suit} moved ${direction} to position ${raceState.horses[suit]}`);
}

function updateHorsePosition(horseElement, position) {
    if (!horseElement) return;
    
    // Calculate horizontal offset based on position
    const trackWidth = 600; // Approximate track width
    const maxPosition = raceState.trackLength;
    const offset = (position / maxPosition) * trackWidth;
    
    // Apply transform to move horse horizontally
    horseElement.style.transform = `translateX(${offset}px)`;
    
    // Add visual feedback for position
    if (position >= maxPosition) {
        horseElement.style.boxShadow = '0 0 20px #f39c12, 0 0 40px #f39c12';
    } else {
        horseElement.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
    }
}

function checkTrackCardReveal() {
    // Check if all horses have passed the current track position
    const minPosition = Math.min(...Object.values(raceState.horses));
    
    if (minPosition > raceState.revealedCards && raceState.revealedCards < raceState.trackLength) {
        // Reveal next track card
        const trackCard = raceState.trackCards[raceState.revealedCards];
        const trackCardElement = document.getElementById(`track-card-${raceState.revealedCards}`);
        
        if (trackCardElement) {
            trackCardElement.textContent = trackCard.rank + trackCard.suit;
            trackCardElement.classList.add('revealed');
            trackCard.revealed = true;
            
            // Move corresponding horse backward
            moveHorse(trackCard.suit, 'backward');
            
            console.log(`Revealed track card: ${trackCard.rank} ${trackCard.suit} - ${trackCard.suit} horse moves back`);
        }
        
        raceState.revealedCards++;
    }
}

function checkRaceWinner() {
    // Check if any horse has reached the finish line
    const maxPosition = Math.max(...Object.values(raceState.horses));
    
    if (maxPosition >= raceState.trackLength) {
        raceState.gameOver = true;
        
        // Find winner
        Object.keys(raceState.horses).forEach(suit => {
            if (raceState.horses[suit] >= raceState.trackLength) {
                raceState.winner = suit;
            }
        });
        
        console.log(`Race finished! Winner: ${raceState.winner}`);
        
        // Show results
        showRaceResults();
        
        // Disable draw button
        const drawButton = document.getElementById('drawCard');
        if (drawButton) {
            drawButton.disabled = true;
        }
    }
}

function showRaceResults() {
    raceState.phase = 'results';
    
    // Hide race phase, show results phase
    const racePhase = document.getElementById('racePhase');
    const resultsPhase = document.getElementById('resultsPhase');
    
    if (racePhase) racePhase.style.display = 'none';
    if (resultsPhase) resultsPhase.style.display = 'block';
    
    // Calculate winners and losers
    const winners = [];
    const losers = [];
    
    gameState.players.forEach(player => {
        if (raceState.playerBets[player.id] === raceState.winner) {
            winners.push(player);
        } else {
            losers.push(player);
        }
    });
    
    // Update scores
    winners.forEach(player => {
        addScore(player.id, -1); // Winner distributes drinks (negative score)
    });
    
    losers.forEach(player => {
        addScore(player.id, 2); // Losers drink
    });
    
    // Show results
    const resultsDiv = document.getElementById('raceResults');
    if (resultsDiv) {
        resultsDiv.innerHTML = `
            <h3 class="winner-celebration">🏁 Race voorbij!</h3>
            <p><strong>${raceState.winner} heeft gewonnen! 🎉</strong></p>
            <p><strong>Winnaars:</strong> ${winners.map(p => p.name).join(', ')}</p>
            <p>Winnaars mogen 1 ${gameState.settings.drinkUnit} uitdelen</p>
            <p><strong>Verliezers:</strong> ${losers.map(p => p.name).join(', ')}</p>
            <p>Verliezers drinken 2 ${gameState.settings.drinkUnit}</p>
        `;
    }
    
    // Confetti effect
    createConfetti();
}

function resetRaceGame() {
    resetRaceState();
    startBettingPhase();
}

// ============================================================================
// MULTIPLAYER SYNCHRONISATIE
// ============================================================================

function startAutomaticCardDrawing() {
    console.log('🎴 Starting automatic card drawing');
    console.log('🎴 Draw pile size:', raceState.drawPile.length);
    console.log('🎴 Card draw delay:', raceState.cardDrawDelay);
    
    // Clear any existing interval
    if (raceState.cardDrawInterval) {
        clearInterval(raceState.cardDrawInterval);
        console.log('🎴 Cleared existing interval');
    }
    
    // Start drawing cards automatically
    raceState.cardDrawInterval = setInterval(() => {
        console.log('🎴 Interval tick - Phase:', raceState.phase, 'GameOver:', raceState.gameOver, 'DrawPile:', raceState.drawPile.length);
        
        if (raceState.phase === 'racing' && !raceState.gameOver && raceState.drawPile.length > 0) {
            console.log('🎴 Drawing card automatically');
            drawRaceCard();
            
            // Broadcast card to other players if multiplayer
            if (window.simpleSupabase && raceState.isHost) {
                console.log('🎴 Broadcasting card to other players');
                broadcastRaceCard(raceState.currentCard);
            }
        } else {
            // Stop automatic drawing
            console.log('🎴 Stopping automatic drawing - conditions not met');
            stopAutomaticCardDrawing();
        }
    }, raceState.cardDrawDelay);
    
    console.log('🎴 Automatic card drawing interval started');
}

function stopAutomaticCardDrawing() {
    console.log('⏹️ Stopping automatic card drawing');
    
    if (raceState.cardDrawInterval) {
        clearInterval(raceState.cardDrawInterval);
        raceState.cardDrawInterval = null;
    }
}

function broadcastRaceCard(card) {
    if (!window.simpleSupabase || !raceState.isHost) return;
    
    const eventData = {
        room_code: currentRoom ? currentRoom.code : 'unknown',
        event_type: 'race_card',
        event_data: {
            type: 'race_card',
            card: card,
            horses: raceState.horses,
            revealedCards: raceState.revealedCards,
            gameOver: raceState.gameOver,
            winner: raceState.winner,
            timestamp: Date.now()
        },
        timestamp: new Date().toISOString()
    };
    
    console.log('📡 Broadcasting race card:', card);
    
    window.simpleSupabase.addGameEvent(eventData);
}

function handleRaceCardBroadcast(eventData) {
    if (!eventData || eventData.type !== 'race_card') return;
    
    console.log('📥 Received race card broadcast:', eventData.card);
    
    // Update race state from broadcast
    raceState.currentCard = eventData.card;
    raceState.horses = eventData.horses;
    raceState.revealedCards = eventData.revealedCards;
    raceState.gameOver = eventData.gameOver;
    raceState.winner = eventData.winner;
    
    // Update UI
    updateRaceUIFromBroadcast();
}

function updateRaceUIFromBroadcast() {
    // Update current card display
    const cardElement = document.getElementById('currentCard');
    const descriptionElement = document.getElementById('cardDescription');
    
    if (cardElement && descriptionElement && raceState.currentCard) {
        cardElement.textContent = raceState.currentCard.rank + raceState.currentCard.suit;
        cardElement.className = `card ${raceState.currentCard.suit === '♥' || raceState.currentCard.suit === '♦' ? 'red' : 'black'} revealing`;
        descriptionElement.textContent = `${raceState.currentCard.rank} ${raceState.currentCard.suit}`;
    }
    
    // Update track cards
    updateTrackCardsFromBroadcast();
    
    // Check for game over
    if (raceState.gameOver && raceState.winner) {
        showRaceResults();
    }
}

function updateTrackCardsFromBroadcast() {
    // Update revealed track cards
    for (let i = 0; i < raceState.revealedCards && i < raceState.trackCards.length; i++) {
        const trackCard = raceState.trackCards[i];
        const trackCardElement = document.getElementById(`track-card-${i}`);
        
        if (trackCardElement && !trackCardElement.classList.contains('revealed')) {
            trackCardElement.textContent = trackCard.rank + trackCard.suit;
            trackCardElement.classList.add('revealed');
            
            // Add color class based on suit
            if (trackCard.suit === '♥' || trackCard.suit === '♦') {
                trackCardElement.classList.add('red');
            } else {
                trackCardElement.classList.add('black');
            }
        }
    }
}

function broadcastBettingUpdate() {
    if (!window.simpleSupabase || !raceState.isHost) return;
    
    const eventData = {
        room_code: currentRoom ? currentRoom.code : 'unknown',
        event_type: 'betting_update',
        event_data: {
            type: 'betting_update',
            playerBets: raceState.playerBets,
            bettingTimer: raceState.bettingTimer,
            timestamp: Date.now()
        },
        timestamp: new Date().toISOString()
    };
    
    console.log('📡 Broadcasting betting update');
    
    window.simpleSupabase.addGameEvent(eventData);
}

function handleBettingUpdateBroadcast(eventData) {
    if (!eventData || eventData.type !== 'betting_update') return;
    
    console.log('📥 Received betting update broadcast');
    
    // Update betting state
    raceState.playerBets = eventData.playerBets;
    raceState.bettingTimer = eventData.bettingTimer;
    
    // Update UI
    updateBetCounts();
    updateBettingTimer();
}

function broadcastRaceStart() {
    if (!window.simpleSupabase || !raceState.isHost) return;
    
    const eventData = {
        room_code: currentRoom ? currentRoom.code : 'unknown',
        event_type: 'race_start',
        event_data: {
            type: 'race_start',
            trackCards: raceState.trackCards,
            raceSeed: raceState.raceSeed,
            playerBets: raceState.playerBets,
            timestamp: Date.now()
        },
        timestamp: new Date().toISOString()
    };
    
    console.log('📡 Broadcasting race start');
    
    window.simpleSupabase.addGameEvent(eventData);
}

function handleRaceStartBroadcast(eventData) {
    if (!eventData || eventData.type !== 'race_start') return;
    
    console.log('📥 Received race start broadcast');
    
    // Update race state
    raceState.trackCards = eventData.trackCards;
    raceState.raceSeed = eventData.raceSeed;
    raceState.playerBets = eventData.playerBets;
    
    // Create track cards UI
    createTrackCardsFromBroadcast();
    
    // Start race phase
    startRacePhase();
}

function createTrackCardsFromBroadcast() {
    const trackContainer = document.getElementById('trackCards');
    if (trackContainer) {
        trackContainer.innerHTML = '';
        
        raceState.trackCards.forEach((card, i) => {
            const cardElement = document.createElement('div');
            cardElement.className = 'track-card';
            cardElement.id = `track-card-${i}`;
            trackContainer.appendChild(cardElement);
        });
    }
    
    // Setup ace cards with proper styling
    setupAceCards();
}

// ============================================================================
// GAME EVENT HANDLING
// ============================================================================

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
    }
}

// ============================================================================
// MEXICO SPEL
// ============================================================================

function resetMexicoState() {
    mexicoState.currentPlayer = 0;
    mexicoState.round = 1;
    mexicoState.scores = [];
    mexicoState.gameOver = false;
    
    // Reset scoreboard
    document.getElementById('mexicoScoreboard').innerHTML = '';
    document.getElementById('mexicoResults').innerHTML = '';
}

function updateCurrentPlayer() {
    const playerName = gameState.players[mexicoState.currentPlayer]?.name || 'Onbekend';
    document.getElementById('currentPlayerName').textContent = playerName;
}

function rollDiceForMexico() {
    const dice1 = Math.floor(Math.random() * 6) + 1;
    const dice2 = Math.floor(Math.random() * 6) + 1;
    
    // Animaties
    animateDice('dice1', dice1);
    animateDice('dice2', dice2);
    
    // Bereken score
    const score = calculateMexicoScore(dice1, dice2);
    
    // Sla score op
    const playerId = gameState.players[mexicoState.currentPlayer]?.id;
    mexicoState.scores.push({
        playerId: playerId,
        playerName: gameState.players[mexicoState.currentPlayer]?.name,
        dice1: dice1,
        dice2: dice2,
        score: score
    });
    
    // Volgende speler
    mexicoState.currentPlayer++;
    
    // Check of ronde voorbij is
    if (mexicoState.currentPlayer >= gameState.players.length) {
        endMexicoRound();
    } else {
        updateCurrentPlayer();
    }
    
    updateMexicoScoreboard();
    
    // Speel geluid
    if (gameState.settings.soundEnabled) {
        playSound('dice');
    }
}

function animateDice(diceId, value) {
    const diceElement = document.getElementById(diceId);
    diceElement.classList.add('rolling');
    diceElement.textContent = '?';
    
    setTimeout(() => {
        diceElement.classList.remove('rolling');
        diceElement.textContent = value;
    }, 600);
}

function calculateMexicoScore(dice1, dice2) {
    const larger = Math.max(dice1, dice2);
    const smaller = Math.min(dice1, dice2);
    
    // Mexico (21) is altijd de hoogste score
    if (dice1 === 1 && dice2 === 1) {
        return 21; // Mexico
    }
    
    return parseInt(larger.toString() + smaller.toString());
}

function endMexicoRound() {
    // Vind laagste score
    const lowestScore = Math.min(...mexicoState.scores.map(s => s.score));
    const losers = mexicoState.scores.filter(s => s.score === lowestScore);
    
    // Update scores
    losers.forEach(loser => {
        addScore(loser.playerId, 2); // Drinken
    });
    
    // Toon resultaten
    showMexicoRoundResults(losers, lowestScore);
    
    // Reset voor volgende ronde
    mexicoState.currentPlayer = 0;
    mexicoState.round++;
    mexicoState.scores = [];
    updateCurrentPlayer();
}

function showMexicoRoundResults(losers, lowestScore) {
    const resultsDiv = document.getElementById('mexicoResults');
    resultsDiv.innerHTML = `
        <h4>🎲 Ronde ${mexicoState.round - 1} voorbij!</h4>
        <p>Laagste score: <strong>${lowestScore}</strong></p>
        <p>Moeten drinken: ${losers.map(l => l.playerName).join(', ')}</p>
        <p>Drinken: 2 ${gameState.settings.drinkUnit}</p>
    `;
}

function updateMexicoScoreboard() {
    const container = document.getElementById('mexicoScoreboard');
    container.innerHTML = '<h4>📊 Scores deze ronde:</h4>';
    
    mexicoState.scores.forEach(score => {
        const div = document.createElement('div');
        div.innerHTML = `
            <strong>${score.playerName}:</strong> ${score.dice1} + ${score.dice2} = <strong>${score.score}</strong>
        `;
        container.appendChild(div);
    });
}

// ============================================================================
// BUSSEN SPEL
// ============================================================================

function resetBussenState() {
    bussenState.phase = 'questions';
    bussenState.currentCard = null;
    bussenState.previousCards = [];
    bussenState.questionType = 0;
    bussenState.deck = createDeck();
    bussenState.busCards = [];
    bussenState.currentBusCard = 0;
}

function createDeck() {
    const suits = ['♠', '♥', '♦', '♣'];
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const deck = [];
    
    suits.forEach(suit => {
        ranks.forEach(rank => {
            deck.push({
                suit: suit,
                rank: rank,
                color: (suit === '♥' || suit === '♦') ? 'red' : 'black',
                value: getCardValue(rank)
            });
        });
    });
    
    return shuffleDeck(deck);
}

function getCardValue(rank) {
    if (rank === 'A') return 1;
    if (rank === 'J') return 11;
    if (rank === 'Q') return 12;
    if (rank === 'K') return 13;
    return parseInt(rank);
}

function shuffleDeck(deck) {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function setupBussenGame() {
    // Reset UI
    document.getElementById('questionPhase').style.display = 'block';
    document.getElementById('busPhase').style.display = 'none';
    document.getElementById('phaseIndicator').textContent = 'Fase 1: Vragen';
    document.getElementById('bussenResults').innerHTML = '';
    
    // Start met eerste vraag
    nextQuestion();
}

function nextQuestion() {
    if (bussenState.deck.length === 0) {
        startBusPhase();
        return;
    }
    
    // Trek nieuwe kaart
    bussenState.currentCard = bussenState.deck.pop();
    bussenState.previousCards.push(bussenState.currentCard);
    
    // Update kaart display
    updateCardDisplay();
    
    // Stel vraag
    setQuestion();
}

function updateCardDisplay() {
    const cardElement = document.getElementById('currentCard');
    const card = bussenState.currentCard;
    
    cardElement.textContent = `${card.rank}${card.suit}`;
    cardElement.className = `card ${card.color}`;
}

function setQuestion() {
    const questionTypes = [
        'Is de volgende kaart rood of zwart?',
        'Is de volgende kaart hoger of lager dan de vorige?',
        'Is de volgende kaart binnen of buiten de twee vorige?',
        'Welke kleur heeft de volgende kaart?'
    ];
    
    const questionText = document.getElementById('questionText');
    const answerButtons = document.querySelector('.answer-buttons');
    
    if (bussenState.questionType === 0) {
        questionText.textContent = 'Is de volgende kaart rood of zwart?';
        answerButtons.innerHTML = `
            <button class="btn btn-answer" onclick="answerQuestion('rood')">🔴 Rood</button>
            <button class="btn btn-answer" onclick="answerQuestion('zwart')">⚫ Zwart</button>
        `;
    } else if (bussenState.questionType === 1) {
        questionText.textContent = 'Is de volgende kaart hoger of lager dan de vorige?';
        answerButtons.innerHTML = `
            <button class="btn btn-answer" onclick="answerQuestion('hoger')">⬆️ Hoger</button>
            <button class="btn btn-answer" onclick="answerQuestion('lager')">⬇️ Lager</button>
        `;
    } else if (bussenState.questionType === 2) {
        questionText.textContent = 'Is de volgende kaart binnen of buiten de twee vorige?';
        answerButtons.innerHTML = `
            <button class="btn btn-answer" onclick="answerQuestion('binnen')">📥 Binnen</button>
            <button class="btn btn-answer" onclick="answerQuestion('buiten')">📤 Buiten</button>
        `;
    } else {
        questionText.textContent = 'Welke kleur heeft de volgende kaart?';
        answerButtons.innerHTML = `
            <button class="btn btn-answer" onclick="answerQuestion('klaveren')">♣️ Klaveren</button>
            <button class="btn btn-answer" onclick="answerQuestion('harten')">♥️ Harten</button>
            <button class="btn btn-answer" onclick="answerQuestion('schoppen')">♠️ Schoppen</button>
            <button class="btn btn-answer" onclick="answerQuestion('ruiten')">♦️ Ruiten</button>
        `;
    }
}

function answerQuestion(answer) {
    const card = bussenState.currentCard;
    let correct = false;
    
    // Check antwoord
    if (bussenState.questionType === 0) {
        correct = (answer === 'rood' && card.color === 'red') || 
                 (answer === 'zwart' && card.color === 'black');
    } else if (bussenState.questionType === 1) {
        const prevCard = bussenState.previousCards[bussenState.previousCards.length - 2];
        correct = (answer === 'hoger' && card.value > prevCard.value) || 
                 (answer === 'lager' && card.value < prevCard.value);
    } else if (bussenState.questionType === 2) {
        const prev1 = bussenState.previousCards[bussenState.previousCards.length - 2];
        const prev2 = bussenState.previousCards[bussenState.previousCards.length - 3];
        const min = Math.min(prev1.value, prev2.value);
        const max = Math.max(prev1.value, prev2.value);
        correct = (answer === 'binnen' && card.value >= min && card.value <= max) || 
                 (answer === 'buiten' && (card.value < min || card.value > max));
    } else {
        const suitNames = {
            '♣': 'klaveren',
            '♥': 'harten', 
            '♠': 'schoppen',
            '♦': 'ruiten'
        };
        correct = answer === suitNames[card.suit];
    }
    
    // Toon resultaat
    showAnswerResult(correct, card);
    
    // Update scores
    if (!correct) {
        // Willekeurige speler moet drinken
        const randomPlayer = gameState.players[Math.floor(Math.random() * gameState.players.length)];
        addScore(randomPlayer.id, 1);
    }
    
    // Volgende vraag
    bussenState.questionType = (bussenState.questionType + 1) % 4;
    setTimeout(() => {
        nextQuestion();
    }, 2000);
}

function showAnswerResult(correct, card) {
    const resultsDiv = document.getElementById('bussenResults');
    const resultClass = correct ? 'correct' : 'incorrect';
    const resultText = correct ? '✅ Correct!' : '❌ Fout!';
    
    resultsDiv.innerHTML = `
        <div class="answer-result ${resultClass}">
            <p>${resultText}</p>
            <p>Kaart was: ${card.rank}${card.suit}</p>
            ${!correct ? `<p>Drink 1 ${gameState.settings.drinkUnit}!</p>` : ''}
        </div>
    `;
}

function startBusPhase() {
    bussenState.phase = 'bus';
    
    // Maak bus kaarten (laatste 10 kaarten)
    bussenState.busCards = bussenState.deck.slice(-10);
    
    // Update UI
    document.getElementById('questionPhase').style.display = 'none';
    document.getElementById('busPhase').style.display = 'block';
    document.getElementById('phaseIndicator').textContent = 'Fase 2: De Bus';
    
    // Maak piramide
    createBusPyramid();
}

function createBusPyramid() {
    const container = document.getElementById('busPyramid');
    container.innerHTML = '';
    
    const rows = 4;
    let cardIndex = 0;
    
    for (let row = 0; row < rows; row++) {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'bus-row';
        
        for (let col = 0; col <= row; col++) {
            if (cardIndex < bussenState.busCards.length) {
                const cardDiv = document.createElement('div');
                cardDiv.className = 'bus-card';
                cardDiv.textContent = '?';
                cardDiv.id = `bus-card-${cardIndex}`;
                rowDiv.appendChild(cardDiv);
                cardIndex++;
            }
        }
        
        container.appendChild(rowDiv);
    }
}

function flipBusCard() {
    if (bussenState.currentBusCard >= bussenState.busCards.length) {
        showBusComplete();
        return;
    }
    
    const card = bussenState.busCards[bussenState.currentBusCard];
    const cardElement = document.getElementById(`bus-card-${bussenState.currentBusCard}`);
    
    // Toon kaart
    cardElement.textContent = `${card.rank}${card.suit}`;
    cardElement.classList.add('flipped');
    cardElement.style.color = card.color === 'red' ? '#ff6b6b' : '#333';
    
    // Check of spelers deze kaart hebben (vereenvoudigd - willekeurig)
    const hasCard = Math.random() < 0.3; // 30% kans dat iemand de kaart heeft
    
    if (hasCard) {
        cardElement.classList.add('matched');
        const randomPlayer = gameState.players[Math.floor(Math.random() * gameState.players.length)];
        addScore(randomPlayer.id, -1); // Negatieve score = uitdelen
        
        // Toon melding
        showNotification(`${randomPlayer.name} heeft de kaart! Deel uit! 🍻`);
    }
    
    bussenState.currentBusCard++;
    
    // Speel geluid
    if (gameState.settings.soundEnabled) {
        playSound('card');
    }
}

function showBusComplete() {
    const resultsDiv = document.getElementById('bussenResults');
    resultsDiv.innerHTML = `
        <h3>🚌 Bus compleet!</h3>
        <p>Alle kaarten zijn omgedraaid!</p>
        <button class="btn btn-primary" onclick="resetBussenGame()">Nieuwe bus</button>
    `;
}

function resetBus() {
    resetBussenState();
    setupBussenGame();
}

function resetBussenGame() {
    resetBussenState();
    setupBussenGame();
}

function nextCard() {
    nextQuestion();
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
        confetti.style.animationDelay = Math.random() * 3 + 's';
        confetti.style.animationDuration = (Math.random() * 3 + 2) + 's';
        container.appendChild(confetti);
    }
    
    // Verwijder confetti na animatie
    setTimeout(() => {
        container.innerHTML = '';
    }, 5000);
}

function showNotification(message) {
    // Maak tijdelijke notificatie
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #4ecdc4;
        color: white;
        padding: 15px 30px;
        border-radius: 25px;
        font-weight: bold;
        z-index: 2000;
        animation: slideDown 0.3s ease-out;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Verwijder na 3 seconden
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function playSound(soundType) {
    // Eenvoudige geluid simulatie met Web Audio API
    if (!gameState.settings.soundEnabled) return;
    
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Verschillende frequenties voor verschillende geluiden
    let frequency = 440; // Standaard A-noot
    if (soundType === 'dice') frequency = 523; // C-noot
    else if (soundType === 'card') frequency = 659; // E-noot
    
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
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
    
    // Enter toets voor knoppen
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
        from {
            transform: translateX(-50%) translateY(-100%);
            opacity: 0;
        }
        to {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
        }
    }
    
    .answer-result {
        padding: 15px;
        border-radius: 10px;
        margin: 10px 0;
        text-align: center;
        font-weight: bold;
    }
    
    .answer-result.correct {
        background: #d4edda;
        color: #155724;
        border: 2px solid #c3e6cb;
    }
    
    .answer-result.incorrect {
        background: #f8d7da;
        color: #721c24;
        border: 2px solid #f5c6cb;
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
    
    console.log('🔄 Starting rooms auto-refresh (every 10 seconds)');
    
    roomsAutoRefreshInterval = setInterval(() => {
        // Only refresh if we're currently on the rooms tab
        const roomsTab = document.getElementById('roomsTab');
        if (roomsTab && roomsTab.classList.contains('active')) {
            console.log('🔄 Auto-refreshing rooms...');
            if (window.simpleLobby && window.simpleLobby.refreshRooms) {
                window.simpleLobby.refreshRooms(); // Use new simple lobby function
            }
        }
    }, 10000); // Every 10 seconds
}

function stopRoomsAutoRefresh() {
    if (roomsAutoRefreshInterval) {
        console.log('⏹️ Stopping rooms auto-refresh');
        clearInterval(roomsAutoRefreshInterval);
        roomsAutoRefreshInterval = null;
    }
}

console.log('🎮 Drankspel Party Multiplayer JavaScript geladen!');
