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
    horses: [0, 0, 0, 0, 0, 0], // Positie van elke paard (0-20)
    gameOver: false,
    winner: null
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
    
    // Initialiseer spelers
    initializePlayers();
    
    // Update UI
    updatePlayerCount();
    updateScoreboard();
    
    // Wacht tot pagina volledig geladen is voor Supabase
    window.addEventListener('load', function() {
        setTimeout(() => {
            initializeSupabaseConnection();
        }, 500); // Wacht 500ms extra
    });
    
    console.log('✅ App geïnitialiseerd');
});

function initializeSupabaseConnection() {
    // Check if Supabase is available
    if (typeof window.supabase === 'undefined') {
        console.log('⚠️ Supabase library niet beschikbaar, demo modus');
        initializeWebSocket();
        return;
    }
    
    // Initialiseer Supabase verbinding
    if (window.supabaseClient) {
        try {
            window.supabaseClient.initialize();
            console.log('✅ Supabase verbinding geïnitialiseerd');
        } catch (error) {
            console.log('🔄 Supabase initialisatie gefaald, fallback naar demo modus');
            initializeWebSocket();
        }
    } else {
        // Fallback naar demo modus
        console.log('🔄 Supabase client niet beschikbaar, demo modus');
        initializeWebSocket();
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

function showLobbyTab(tabName) {
    // Verberg alle tabs
    const tabs = document.querySelectorAll('.lobby-tab');
    tabs.forEach(tab => tab.classList.remove('active'));
    
    // Verberg alle tab buttons
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => btn.classList.remove('active'));
    
    // Toon geselecteerde tab
    document.getElementById(tabName + 'LobbyTab').classList.add('active');
    event.target.classList.add('active');
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
    setupRaceTrack();
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
    raceState.horses = [0, 0, 0, 0, 0, 0];
    raceState.gameOver = false;
    raceState.winner = null;
}

function setupRaceTrack() {
    const container = document.getElementById('horses');
    container.innerHTML = '';
    
    // Maak 6 paarden
    for (let i = 0; i < 6; i++) {
        const horse = document.createElement('div');
        horse.className = 'horse';
        horse.innerHTML = '🐎';
        horse.style.top = `${30 + i * 60}px`;
        horse.id = `horse-${i + 1}`;
        container.appendChild(horse);
    }
    
    // Reset resultaten
    document.getElementById('raceResults').innerHTML = '';
    document.getElementById('diceResult').innerHTML = '';
    document.getElementById('rollDice').disabled = false;
}

function rollDiceForRace() {
    if (raceState.gameOver) return;
    
    const dice = Math.floor(Math.random() * 6) + 1;
    const diceElement = document.getElementById('diceResult');
    
    // Toon dobbelsteen animatie
    diceElement.innerHTML = `🎲 ${dice}`;
    
    // Beweeg paard
    moveHorse(dice - 1);
    
    // Check winnaar
    checkRaceWinner();
    
    // Speel geluid als ingeschakeld
    if (gameState.settings.soundEnabled) {
        playSound('dice');
    }
}

function moveHorse(horseIndex) {
    if (raceState.horses[horseIndex] < 20) {
        raceState.horses[horseIndex]++;
        
        const horseElement = document.getElementById(`horse-${horseIndex + 1}`);
        const newPosition = 20 + (raceState.horses[horseIndex] * 30); // 20px start + 30px per stap
        horseElement.style.left = `${newPosition}px`;
        
        // Animatie effect
        horseElement.style.transform = 'scale(1.2)';
        setTimeout(() => {
            horseElement.style.transform = 'scale(1)';
        }, 200);
    }
}

function checkRaceWinner() {
    for (let i = 0; i < raceState.horses.length; i++) {
        if (raceState.horses[i] >= 20) {
            raceState.gameOver = true;
            raceState.winner = i + 1;
            
            // Toon resultaten
            showRaceResults();
            
            // Update scores (voorbeeld - winnaar deelt uit, verliezers drinken)
            addScore(1, -2); // Winnaar deelt uit (negatieve score = uitdelen)
            
            // Confetti effect
            createConfetti();
            
            // Disable dobbelsteen knop
            document.getElementById('rollDice').disabled = true;
            
            break;
        }
    }
}

function showRaceResults() {
    const resultsDiv = document.getElementById('raceResults');
    resultsDiv.innerHTML = `
        <h3>🏁 Race voorbij!</h3>
        <p><strong>Paard ${raceState.winner} heeft gewonnen! 🎉</strong></p>
        <p>Winnaar mag 1 ${gameState.settings.drinkUnit} uitdelen</p>
        <p>Andere spelers drinken 2 ${gameState.settings.drinkUnit}</p>
        <button class="btn btn-primary" onclick="resetRaceGame()">Nieuwe race</button>
    `;
}

function resetRaceGame() {
    resetRaceState();
    setupRaceTrack();
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
// WEBSOCKET EN MULTIPLAYER FUNCTIONALITEIT
// ============================================================================

function initializeWebSocket() {
    // Voor demo doeleinden simuleren we een WebSocket verbinding
    console.log('🔌 Initialiseren WebSocket verbinding...');
    
    // Simuleer verbinding
    setTimeout(() => {
        gameState.connectionStatus = 'connected';
        updateConnectionStatus();
        console.log('✅ WebSocket verbonden (demo modus)');
    }, 1000);
}

function updateConnectionStatus() {
    let statusElement = document.getElementById('connectionStatus');
    if (!statusElement) {
        statusElement = document.createElement('div');
        statusElement.id = 'connectionStatus';
        statusElement.className = 'connection-status';
        document.body.appendChild(statusElement);
    }
    
    const status = gameState.connectionStatus;
    statusElement.className = `connection-status ${status}`;
    
    switch(status) {
        case 'connected':
            statusElement.textContent = '🟢 Verbonden';
            break;
        case 'connecting':
            statusElement.textContent = '🟡 Verbinden...';
            break;
        case 'disconnected':
            statusElement.textContent = '🔴 Verbinding verbroken';
            break;
    }
}

console.log('🎮 Drankspel Party Multiplayer JavaScript geladen!');
