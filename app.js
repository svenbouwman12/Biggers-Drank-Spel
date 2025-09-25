// ============================================================================
// DRANKSPEL PARTY - Fresh Start JavaScript
// ============================================================================

// Game State
let gameState = {
    currentGame: null,
    players: [],
    isMultiplayer: false
};

// Paardenrace Game State
let raceState = {
    phase: 'betting', // 'betting', 'racing', 'results'
    bettingTimer: 10,
    bettingInterval: null,
    cardDrawInterval: null,
    cardDrawDelay: 2000,
    playerBets: {},
    horses: {
        '♠': 0, '♥': 0, '♦': 0, '♣': 0
    },
    trackLength: 7,
    trackCards: [],
    revealedCards: 0,
    drawPile: [],
    gameOver: false,
    winner: null,
    currentCard: null,
    isHost: true
};

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🎉 Drankspel Party geladen!');
    
    // Initialize Supabase if available
    if (window.simpleSupabase) {
        window.simpleSupabase.initialize();
    }
    
    // Initialize lobby if available
    if (window.simpleLobby) {
        window.simpleLobby.initialize();
    }
    
    // Show start screen
    showStartScreen();
});

// ============================================================================
// SCREEN NAVIGATION
// ============================================================================

function showScreen(screenId) {
    console.log(`📱 Switching to screen: ${screenId}`);
    
    // Hide all screens
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => screen.classList.remove('active'));
    
    // Show target screen
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
        console.log(`📱 Screen switched to: ${screenId}`);
    } else {
        console.error(`❌ Screen not found: ${screenId}`);
    }
}

function showStartScreen() {
    showScreen('startScreen');
}

// ============================================================================
// GAME MANAGEMENT
// ============================================================================

function startGame(gameType) {
    console.log(`🎮 Starting game: ${gameType}`);
    
    gameState.currentGame = gameType;
    
    // Initialize players for single player mode
    if (!gameState.isMultiplayer && gameState.players.length === 0) {
        initializePlayers();
    }
    
    if (gameType === 'paardenrace') {
        startPaardenrace();
    } else {
        console.log('Unknown game type:', gameType);
    }
}

function initializePlayers() {
    console.log('👥 Initializing players for single player mode');
    
    gameState.players = [
        { id: 'player_1', name: 'Speler 1', score: 0, isHost: true },
        { id: 'player_2', name: 'Speler 2', score: 0, isHost: false },
        { id: 'player_3', name: 'Speler 3', score: 0, isHost: false },
        { id: 'player_4', name: 'Speler 4', score: 0, isHost: false }
    ];
    
    console.log(`👥 Initialized ${gameState.players.length} players`);
}

// ============================================================================
// PAARDENRACE GAME
// ============================================================================

function startPaardenrace() {
    console.log('🏇 Starting Paardenrace game');
    
    showScreen('paardenraceGame');
    resetRaceState();
    startBettingPhase();
}

function resetRaceState() {
    console.log('🔄 Resetting race state');
    
    raceState.phase = 'betting';
    raceState.bettingTimer = 10;
    raceState.bettingInterval = null;
    raceState.cardDrawInterval = null;
    raceState.playerBets = {};
    raceState.horses = { '♠': 0, '♥': 0, '♦': 0, '♣': 0 };
    raceState.trackCards = [];
    raceState.revealedCards = 0;
    raceState.drawPile = [];
    raceState.gameOver = false;
    raceState.winner = null;
    raceState.currentCard = null;
    raceState.isHost = true;
    
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

function startBettingPhase() {
    console.log('💰 Starting betting phase');
    
    // Reset bet counters
    ['♠', '♥', '♦', '♣'].forEach(suit => {
        const suitName = suit === '♠' ? 'spades' : 
                        suit === '♥' ? 'hearts' :
                        suit === '♦' ? 'diamonds' : 'clubs';
        
        const countElement = document.getElementById(`bet-${suitName}`);
        const playersElement = document.getElementById(`bet-players-${suitName}`);
        
        if (countElement) countElement.textContent = '0';
        if (playersElement) playersElement.textContent = '';
    });
    
    // Start betting timer
    raceState.bettingTimer = 10;
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
        if (raceState.bettingTimer <= 3) {
            timerElement.style.background = 'linear-gradient(135deg, #e74c3c, #c0392b)';
        } else if (raceState.bettingTimer <= 6) {
            timerElement.style.background = 'linear-gradient(135deg, #f39c12, #e67e22)';
        } else {
            timerElement.style.background = 'linear-gradient(135deg, #e74c3c, #c0392b)';
        }
    }
}

function placeBet(suit) {
    console.log('💰 Placing bet on suit:', suit);
    
    if (raceState.phase !== 'betting') {
        console.log('❌ Not in betting phase');
        return;
    }
    
    if (raceState.bettingTimer <= 0) {
        console.log('❌ Betting phase has ended');
        return;
    }
    
    const currentPlayer = gameState.players[0];
    if (!currentPlayer) {
        console.log('❌ No current player found');
        return;
    }
    
    // Place the bet
    raceState.playerBets[currentPlayer.id] = suit;
    console.log(`💰 ${currentPlayer.name} bet on ${suit}`);
    
    // Update UI
    updateBetCounts();
    
    // Visual feedback
    const horseCard = document.querySelector(`[data-suit="${suit}"]`);
    if (horseCard) {
        horseCard.classList.add('bet-placed');
        setTimeout(() => {
            horseCard.classList.remove('bet-placed');
        }, 1000);
    }
}

function updateBetCounts() {
    console.log('💰 Updating bet counts');
    
    const betPlayers = {
        '♠': [], '♥': [], '♦': [], '♣': []
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
            console.log(`Random bet assigned: ${player.name} -> ${randomSuit}`);
        }
    });
    
    // Start race phase
    startRacePhase();
}

function startRacePhase() {
    console.log('🏇 Starting race phase');
    
    raceState.phase = 'racing';
    
    // Hide betting phase, show race phase
    const bettingPhase = document.getElementById('bettingPhase');
    const racePhase = document.getElementById('racePhase');
    
    if (bettingPhase) bettingPhase.classList.remove('active');
    if (racePhase) racePhase.classList.add('active');
    
    // Create track cards
    createTrackCards();
    
    // Create draw pile
    createDrawPile();
    
    // Update UI
    updateBetCounts();
    
    // Start automatic card drawing
        startAutomaticCardDrawing();
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
    
    // Create a full deck (no jokers)
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

function startAutomaticCardDrawing() {
    console.log('🎴 Starting automatic card drawing');
    
    if (raceState.cardDrawInterval) {
        clearInterval(raceState.cardDrawInterval);
        raceState.cardDrawInterval = null;
    }
    
    raceState.cardDrawInterval = setInterval(() => {
        if (raceState.phase === 'racing' && !raceState.gameOver && raceState.drawPile.length > 0) {
            drawRaceCard();
        } else {
            stopAutomaticCardDrawing();
        }
    }, raceState.cardDrawDelay);
}

function stopAutomaticCardDrawing() {
    if (raceState.cardDrawInterval) {
        clearInterval(raceState.cardDrawInterval);
        raceState.cardDrawInterval = null;
        console.log('🎴 Automatic card drawing stopped');
    }
}

function drawRaceCard() {
    console.log('🎴 Drawing race card');
    
    if (raceState.phase !== 'racing' || raceState.gameOver || raceState.drawPile.length === 0) {
        return;
    }
    
    // Draw a card
    const drawnCard = raceState.drawPile.pop();
    raceState.currentCard = drawnCard;
    
    console.log('🎴 Drew card:', drawnCard.rank, drawnCard.suit);
    
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
    
    // Move the corresponding horse
    moveHorse(drawnCard.suit);
    
    // Check for race winner
    checkRaceWinner();
}

function moveHorse(suit) {
    console.log('🐎 Moving horse', suit, 'forward');
    
    // Move horse forward
    raceState.horses[suit]++;
    
    // Update horse position in UI
    updateHorsePosition(suit);
    
    // Check if horse passed a track card
    checkTrackCardReveal();
}

function updateHorsePosition(suit) {
    const horseElement = document.getElementById(`horse-${suit === '♠' ? 'spades' : 
                                                      suit === '♥' ? 'hearts' :
                                                      suit === '♦' ? 'diamonds' : 'clubs'}`);
    
    if (!horseElement) return;
    
    // Add visual feedback
    horseElement.classList.add('moving');
    setTimeout(() => {
        horseElement.classList.remove('moving');
    }, 600);
}

function checkTrackCardReveal() {
    const maxPosition = Math.max(...Object.values(raceState.horses));
    
    if (maxPosition > raceState.revealedCards) {
        raceState.revealedCards = maxPosition;
        
        if (raceState.revealedCards < raceState.trackLength) {
            // Reveal the track card
            const trackCardElement = document.querySelector(`[data-position="${raceState.revealedCards - 1}"]`);
            if (trackCardElement) {
                // Draw a random card for the track
                const trackCard = raceState.drawPile.pop();
                trackCardElement.textContent = trackCard.rank + ' ' + trackCard.suit;
                trackCardElement.classList.add('revealed');
                
                console.log(`🎴 Revealed track card: ${trackCard.rank} ${trackCard.suit}`);
                
                // Move the corresponding horse back
                raceState.horses[trackCard.suit]--;
                updateHorsePosition(trackCard.suit);
            }
        }
    }
}

function checkRaceWinner() {
    // Check if any horse has reached the finish (position 7)
    for (const [suit, position] of Object.entries(raceState.horses)) {
        if (position >= 7) {
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
    const winnerSuitElement = document.getElementById('winnerSuit');
    const winnerMessageElement = document.getElementById('winnerMessage');
    
    if (winnerSuitElement && raceState.winner) {
        winnerSuitElement.textContent = raceState.winner;
    }
    
    if (winnerMessageElement && raceState.winner) {
        winnerMessageElement.textContent = `De ${raceState.winner} aas heeft de race gewonnen!`;
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
    startPaardenrace();
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function showNotification(message, type = 'info') {
    console.log(`📢 ${type.toUpperCase()}: ${message}`);
    // Simple notification - can be enhanced with UI
}

// ============================================================================
// END OF FILE
// ============================================================================