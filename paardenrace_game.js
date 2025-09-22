// ============================================================================
// PAARDENRACE GAME LOGIC - Complete Implementation
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
                broadcastBettingUpdate();
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

function placeBet(suit) {
    if (raceState.phase !== 'betting') return;
    
    // Get current player ID
    const playerId = currentPlayer ? currentPlayer.id : 'single_player';
    const playerName = currentPlayer ? currentPlayer.name : 'Speler';
    
    // Place bet
    raceState.playerBets[playerId] = suit;
    
    console.log(`🎯 ${playerName} bet on ${suit}`);
    
    // Update UI
    updateBetCounts();
    
    // Visual feedback
    const horseCards = document.querySelectorAll('.horse-card');
    horseCards.forEach(card => {
        card.classList.remove('selected');
        if (card.dataset.suit === suit) {
            card.classList.add('selected');
        }
    });
    
    // Broadcast betting update if multiplayer (throttled)
    const now = Date.now();
    if (window.simpleSupabase && gameState.isMultiplayer && 
        now - raceState.lastBettingUpdate > 500) {
        broadcastBettingUpdate();
        raceState.lastBettingUpdate = now;
    }
}

function updateBetCounts() {
    const betCounts = { '♠': 0, '♥': 0, '♦': 0, '♣': 0 };
    const betPlayers = { '♠': [], '♥': [], '♦': [], '♣': [] };
    
    // Count bets and collect player names
    Object.entries(raceState.playerBets).forEach(([playerId, suit]) => {
        betCounts[suit]++;
        // Find player name
        const player = gameState.players.find(p => p.id === playerId);
        if (player) {
            betPlayers[suit].push(player.name);
        } else if (playerId === 'single_player') {
            betPlayers[suit].push('Speler');
        }
    });
    
    // Update UI
    Object.keys(betCounts).forEach(suit => {
        const suitName = suit === '♠' ? 'spades' : 
                        suit === '♥' ? 'hearts' :
                        suit === '♦' ? 'diamonds' : 'clubs';
        
        // Update count
        const countElement = document.getElementById(`bet-${suitName}`);
        if (countElement) {
            countElement.textContent = betCounts[suit];
        }
        
        // Update player names
        const playersElement = document.getElementById(`bet-players-${suitName}`);
        if (playersElement) {
            if (betPlayers[suit].length > 0) {
                playersElement.textContent = betPlayers[suit].join(', ');
            } else {
                playersElement.textContent = '';
            }
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
        broadcastRaceStart();
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

function createTrackCards() {
    // Generate random track cards (excluding aces)
    const suits = ['♠', '♥', '♦', '♣'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    
    raceState.trackCards = [];
    for (let i = 0; i < raceState.trackLength; i++) {
        const suit = suits[Math.floor(Math.random() * suits.length)];
        const rank = ranks[Math.floor(Math.random() * ranks.length)];
        raceState.trackCards.push({ suit, rank });
    }
    
    // Create track card UI elements
    const trackContainer = document.getElementById('trackCards');
    if (trackContainer) {
        trackContainer.innerHTML = '';
        raceState.trackCards.forEach((card, index) => {
            const cardElement = document.createElement('div');
            cardElement.className = 'track-card hidden';
            cardElement.dataset.suit = card.suit;
            cardElement.dataset.rank = card.rank;
            cardElement.textContent = '?';
            trackContainer.appendChild(cardElement);
        });
    }
    
    setupAceCards();
}

function setupAceCards() {
    // Setup ace cards with proper styling
    const aces = ['♠', '♥', '♦', '♣'];
    aces.forEach(suit => {
        const horseElement = document.getElementById(`horse-${suit === '♠' ? 'spades' : 
                                                       suit === '♥' ? 'hearts' :
                                                       suit === '♦' ? 'diamonds' : 'clubs'}`);
        if (horseElement) {
            horseElement.dataset.suit = suit;
            horseElement.textContent = suit;
            
            // Add color classes
            if (suit === '♥' || suit === '♦') {
                horseElement.classList.add('red');
            } else {
                horseElement.classList.add('black');
            }
        }
    });
}

function createDrawPile() {
    // Create full deck (52 cards)
    const suits = ['♠', '♥', '♦', '♣'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    
    raceState.drawPile = [];
    suits.forEach(suit => {
        ranks.forEach(rank => {
            raceState.drawPile.push({ suit, rank });
        });
    });
    
    // Remove track cards and aces from draw pile
    raceState.trackCards.forEach(trackCard => {
        const index = raceState.drawPile.findIndex(card => 
            card.suit === trackCard.suit && card.rank === trackCard.rank);
        if (index !== -1) {
            raceState.drawPile.splice(index, 1);
        }
    });
    
    // Remove aces
    const aces = ['♠', '♥', '♦', '♣'];
    aces.forEach(suit => {
        const index = raceState.drawPile.findIndex(card => 
            card.suit === suit && card.rank === 'A');
        if (index !== -1) {
            raceState.drawPile.splice(index, 1);
        }
    });
    
    // Shuffle draw pile
    for (let i = raceState.drawPile.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [raceState.drawPile[i], raceState.drawPile[j]] = [raceState.drawPile[j], raceState.drawPile[i]];
    }
    
    console.log(`Created draw pile with ${raceState.drawPile.length} cards`);
}

function startAutomaticCardDrawing() {
    console.log('🎴 Starting automatic card drawing');
    console.log('🎴 Draw pile size:', raceState.drawPile.length);
    
    // Clear any existing interval
    if (raceState.cardDrawInterval) {
        clearInterval(raceState.cardDrawInterval);
    }
    
    // Start drawing cards automatically
    raceState.cardDrawInterval = setInterval(() => {
        console.log('🎴 Interval tick - Phase:', raceState.phase, 'GameOver:', raceState.gameOver, 'DrawPile:', raceState.drawPile.length);
        
        if (raceState.phase === 'racing' && !raceState.gameOver && raceState.drawPile.length > 0) {
            console.log('🎴 Drawing card automatically');
            drawRaceCard();
            
            // Broadcast card to other players if multiplayer
            if (window.simpleSupabase && raceState.isHost && gameState.isMultiplayer) {
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
    if (raceState.cardDrawInterval) {
        clearInterval(raceState.cardDrawInterval);
        raceState.cardDrawInterval = null;
        console.log('🎴 Automatic card drawing stopped');
    }
}

function drawRaceCard() {
    if (raceState.drawPile.length === 0) {
        console.log('🎴 No more cards to draw');
        return;
    }
    
    // Draw card from pile
    const card = raceState.drawPile.shift();
    raceState.currentCard = card;
    raceState.drawnCards++;
    
    console.log(`🎴 Drew card: ${card.rank} ${card.suit}`);
    console.log(`🎴 Remaining cards: ${raceState.drawPile.length}`);
    
    // Update current card UI
    updateCurrentCardDisplay(card);
    
    // Move corresponding horse
    moveHorse(card.suit, 'forward');
    
    // Check for track card reveals
    checkTrackCardReveal();
    
    // Check for race winner
    checkRaceWinner();
    
    // Play sound
    if (gameState.settings.soundEnabled) {
        playSound('card');
    }
}

function updateCurrentCardDisplay(card) {
    const cardElement = document.getElementById('currentCard');
    const descriptionElement = document.getElementById('cardDescription');
    
    if (cardElement) {
        cardElement.textContent = card.rank + ' ' + card.suit;
        cardElement.dataset.suit = card.suit;
        cardElement.dataset.rank = card.rank;
        
        // Add color class
        cardElement.classList.remove('red', 'black');
        if (card.suit === '♥' || card.suit === '♦') {
            cardElement.classList.add('red');
        } else {
            cardElement.classList.add('black');
        }
    }
    
    if (descriptionElement) {
        descriptionElement.textContent = `${card.rank} ${card.suit} - ${card.suit} paard beweegt vooruit!`;
    }
}

function moveHorse(suit, direction) {
    console.log(`🐎 Moving horse ${suit} ${direction} from position ${raceState.horses[suit]}`);
    
    if (direction === 'forward') {
        raceState.horses[suit]++;
    } else if (direction === 'backward') {
        raceState.horses[suit] = Math.max(0, raceState.horses[suit] - 1);
    }
    
    // Get horse element
    const horseElement = document.getElementById(`horse-${suit === '♠' ? 'spades' : 
                                                       suit === '♥' ? 'hearts' :
                                                       suit === '♦' ? 'diamonds' : 'clubs'}`);
    
    if (horseElement) {
        // Remove any existing animation classes
        horseElement.classList.remove('moving', 'backwards');
        
        // Add appropriate animation class
        if (direction === 'forward') {
            horseElement.classList.add('moving');
        } else if (direction === 'backward') {
            horseElement.classList.add('backwards');
        }
        
        // Update visual position
        updateHorsePosition(horseElement, raceState.horses[suit]);
        
        // Remove animation class after animation completes
        setTimeout(() => {
            horseElement.classList.remove('moving', 'backwards');
        }, 600);
    }
    
    console.log(`🐎 Horse ${suit} now at position ${raceState.horses[suit]}`);
}

function updateHorsePosition(horseElement, position) {
    if (!horseElement) return;
    
    console.log(`📍 Updating horse position to ${position}`);
    
    // Calculate horizontal offset based on position
    const trackWidth = 450;
    const maxPosition = raceState.trackLength;
    const offset = Math.min((position / maxPosition) * trackWidth, trackWidth);
    
    // Get current position to prevent jumping
    const currentTransform = horseElement.style.transform || '';
    const currentOffset = parseFloat(currentTransform.match(/translateX\(([^)]+)\)/)?.[1] || '0');
    
    console.log(`📍 Current offset: ${currentOffset}, New offset: ${offset}`);
    
    // Only apply transition if position actually changed
    if (Math.abs(currentOffset - offset) > 1) {
        horseElement.style.transition = 'transform 0.4s ease-out';
        horseElement.style.transform = `translateX(${offset}px)`;
    }
    
    // Add visual feedback for position
    if (position >= maxPosition) {
        horseElement.style.boxShadow = '0 0 20px #f39c12, 0 0 40px #f39c12';
        horseElement.style.zIndex = '10';
        console.log(`🏆 Horse reached finish line!`);
    } else {
        horseElement.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
        horseElement.style.zIndex = '1';
    }
}

function checkTrackCardReveal() {
    // Check if all horses have passed the current track position
    const minPosition = Math.min(...Object.values(raceState.horses));
    
    if (minPosition > raceState.revealedCards && raceState.revealedCards < raceState.trackLength) {
        raceState.revealedCards++;
        const trackCard = raceState.trackCards[raceState.revealedCards - 1];
        
        console.log(`🎴 Revealing track card ${raceState.revealedCards}: ${trackCard.rank} ${trackCard.suit}`);
        
        // Reveal the track card
        const trackCards = document.querySelectorAll('.track-card');
        if (trackCards[raceState.revealedCards - 1]) {
            const cardElement = trackCards[raceState.revealedCards - 1];
            cardElement.classList.remove('hidden');
            cardElement.classList.add('revealed');
            cardElement.textContent = trackCard.rank + ' ' + trackCard.suit;
            cardElement.dataset.suit = trackCard.suit;
            cardElement.dataset.rank = trackCard.rank;
            
            // Add color class
            if (trackCard.suit === '♥' || trackCard.suit === '♦') {
                cardElement.classList.add('red');
            } else {
                cardElement.classList.add('black');
            }
        }
        
        // Move corresponding horse backward
        moveHorse(trackCard.suit, 'backward');
        console.log(`🐎 ${trackCard.suit} horse moved backward due to track card reveal`);
    }
}

function checkRaceWinner() {
    // Check if any horse has reached the finish line
    const maxPosition = raceState.trackLength;
    const winner = Object.keys(raceState.horses).find(suit => raceState.horses[suit] >= maxPosition);
    
    if (winner && !raceState.gameOver) {
        raceState.gameOver = true;
        raceState.winner = winner;
        
        console.log(`🏆 Race finished! Winner: ${winner}`);
        
        // Stop automatic drawing
        stopAutomaticCardDrawing();
        
        // Disable draw button
        const drawButton = document.getElementById('drawCard');
        if (drawButton) {
            drawButton.disabled = true;
            drawButton.textContent = 'Race Beëindigd';
        }
        
        // Show results after a short delay
        setTimeout(() => {
            showRaceResults();
        }, 1000);
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
    
    // Calculate winners and losers
    const winners = Object.entries(raceState.playerBets)
        .filter(([playerId, suit]) => suit === raceState.winner)
        .map(([playerId, suit]) => {
            const player = gameState.players.find(p => p.id === playerId);
            return player ? player.name : 'Speler';
        });
    
    const losers = Object.entries(raceState.playerBets)
        .filter(([playerId, suit]) => suit !== raceState.winner)
        .map(([playerId, suit]) => {
            const player = gameState.players.find(p => p.id === playerId);
            return player ? player.name : 'Speler';
        });
    
    // Update scores
    winners.forEach(playerName => {
        const player = gameState.players.find(p => p.name === playerName);
        if (player) {
            player.score += 1; // Winners can distribute drinks
        }
    });
    
    losers.forEach(playerName => {
        const player = gameState.players.find(p => p.name === playerName);
        if (player) {
            player.score += 2; // Losers drink
        }
    });
    
    // Update scoreboard
    updateScoreboard();
    saveScoreboard();
    
    // Display results
    const resultsElement = document.getElementById('raceResults');
    if (resultsElement) {
        resultsElement.innerHTML = `
            <h3>🏆 Race Uitslag</h3>
            <div class="winner-display">
                <strong>Winnaar: ${raceState.winner}</strong>
            </div>
            <div class="drink-rules">
                <p><strong>Winnaars (kunnen uitdelen):</strong> ${winners.length > 0 ? winners.join(', ') : 'Geen'}</p>
                <p><strong>Verliezers (moeten drinken):</strong> ${losers.length > 0 ? losers.join(', ') : 'Geen'}</p>
            </div>
        `;
    }
    
    // Create confetti for winners
    if (winners.length > 0) {
        createConfetti();
    }
    
    // Play win sound
    if (gameState.settings.soundEnabled) {
        playSound('win');
    }
}

function resetRaceGame() {
    console.log('🔄 Resetting race game');
    resetRaceState();
    startBettingPhase();
}

// ============================================================================
// MULTIPLAYER SYNCHRONIZATION
// ============================================================================

function broadcastBettingUpdate() {
    if (!window.simpleSupabase || !gameState.isMultiplayer) return;
    
    const eventData = {
        room_code: currentRoom ? currentRoom.code : 'unknown',
        event_type: 'betting_update',
        event_data: {
            type: 'betting_update',
            playerBets: raceState.playerBets,
            bettingTimer: raceState.bettingTimer,
            timestamp: Date.now()
        }
    };
    
    console.log('📡 Broadcasting betting update');
    window.simpleSupabase.addGameEvent(eventData);
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
        }
    };
    
    console.log('📡 Broadcasting race start');
    window.simpleSupabase.addGameEvent(eventData);
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
        }
    };
    
    console.log('📡 Broadcasting race card:', card);
    window.simpleSupabase.addGameEvent(eventData);
}

function handleBettingUpdateBroadcast(eventData) {
    if (!eventData || eventData.type !== 'betting_update') return;
    
    console.log('📥 Received betting update broadcast');
    
    // Only update timer if we're not the host (host controls the timer)
    if (!raceState.isHost) {
        raceState.bettingTimer = eventData.bettingTimer;
        updateBettingTimer();
    }
    
    // Always update betting state
    raceState.playerBets = { ...eventData.playerBets };
    
    // Update UI
    updateBetCounts();
}

function handleRaceStartBroadcast(eventData) {
    if (!eventData || eventData.type !== 'race_start') return;
    
    console.log('📥 Received race start broadcast');
    
    // Don't process if we're already in racing phase (prevents duplicate execution)
    if (raceState.phase === 'racing') {
        console.log('📥 Already in racing phase, skipping race start broadcast');
        return;
    }
    
    // Update race state
    raceState.trackCards = eventData.trackCards;
    raceState.raceSeed = eventData.raceSeed;
    raceState.playerBets = { ...eventData.playerBets };
    
    // Create track cards UI
    createTrackCardsFromBroadcast();
    
    // Start race phase
    startRacePhase();
}

function createTrackCardsFromBroadcast() {
    const trackContainer = document.getElementById('trackCards');
    if (trackContainer) {
        trackContainer.innerHTML = '';
        raceState.trackCards.forEach((card, index) => {
            const cardElement = document.createElement('div');
            cardElement.className = 'track-card hidden';
            cardElement.dataset.suit = card.suit;
            cardElement.dataset.rank = card.rank;
            cardElement.textContent = '?';
            trackContainer.appendChild(cardElement);
        });
    }
    setupAceCards();
}

function handleRaceCardBroadcast(eventData) {
    if (!eventData || eventData.type !== 'race_card') return;
    
    console.log('📥 Received race card broadcast:', eventData.card);
    
    // Update race state from broadcast - exact sync
    raceState.currentCard = eventData.card;
    raceState.horses = { ...eventData.horses }; // Deep copy to ensure sync
    raceState.revealedCards = eventData.revealedCards;
    raceState.gameOver = eventData.gameOver;
    raceState.winner = eventData.winner;
    raceState.drawnCards++;
    
    // Update UI
    updateCurrentCardDisplay(eventData.card);
    
    // Force update horse positions to match broadcast
    Object.keys(raceState.horses).forEach(suit => {
        const horseElement = document.getElementById(`horse-${suit === '♠' ? 'spades' : 
                                                       suit === '♥' ? 'hearts' :
                                                       suit === '♦' ? 'diamonds' : 'clubs'}`);
        if (horseElement) {
            updateHorsePosition(horseElement, raceState.horses[suit]);
        }
    });
    
    // Update track cards if any were revealed
    if (eventData.revealedCards > raceState.revealedCards) {
        updateTrackCardsFromBroadcast(eventData);
    }
    
    // Check if game is over
    if (eventData.gameOver && eventData.winner) {
        raceState.gameOver = true;
        raceState.winner = eventData.winner;
        
        // Stop any local automatic drawing
        stopAutomaticCardDrawing();
        
        // Disable draw button
        const drawButton = document.getElementById('drawCard');
        if (drawButton) {
            drawButton.disabled = true;
            drawButton.textContent = 'Race Beëindigd';
        }
        
        // Show results
        setTimeout(() => {
            showRaceResults();
        }, 1000);
    }
}

function updateTrackCardsFromBroadcast(eventData) {
    // Update revealed track cards based on broadcast
    const trackCards = document.querySelectorAll('.track-card');
    for (let i = 0; i < eventData.revealedCards && i < trackCards.length; i++) {
        const cardElement = trackCards[i];
        const trackCard = raceState.trackCards[i];
        
        if (!cardElement.classList.contains('revealed')) {
            cardElement.classList.remove('hidden');
            cardElement.classList.add('revealed');
            cardElement.textContent = trackCard.rank + ' ' + trackCard.suit;
            cardElement.dataset.suit = trackCard.suit;
            cardElement.dataset.rank = trackCard.rank;
            
            // Add color class
            if (trackCard.suit === '♥' || trackCard.suit === '♦') {
                cardElement.classList.add('red');
            } else {
                cardElement.classList.add('black');
            }
        }
    }
}

function handleRaceGameEvent(event) {
    console.log('🎮 Handling race game event:', event.event_type);
    
    const eventData = event.event_data;
    
    switch (event.event_type) {
        case 'race_card':
            handleRaceCardBroadcast(eventData);
            break;
        case 'betting_update':
            handleBettingUpdateBroadcast(eventData);
            break;
        case 'race_start':
            handleRaceStartBroadcast(eventData);
            break;
        default:
            console.log('Unknown race game event:', event.event_type);
    }
}
