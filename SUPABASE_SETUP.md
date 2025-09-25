# 🗄️ Supabase Database Setup

Complete setup instructies voor de Supabase database integratie met de Drankspel Multiplayer applicatie.

## 🚀 Quick Setup

### 1. Supabase Project Aanmaken

1. Ga naar [supabase.com](https://supabase.com)
2. Maak een nieuw project aan
3. Noteer je **Project URL** en **API Key**

### 2. Database Schema Installeren

1. Ga naar je Supabase dashboard
2. Klik op **SQL Editor**
3. Kopieer en plak de complete `supabase_schema.sql` code
4. Klik op **Run** om het schema aan te maken

### 3. Environment Variables

Maak een `.env` bestand in je project root:

```bash
# Supabase Configuration
SUPABASE_URL=your-supabase-project-url
SUPABASE_ANON_KEY=your-supabase-anon-key

# Optional: Database URL for direct connection
DATABASE_URL=your-database-connection-string
```

### 4. Dependencies Installeren

```bash
npm install @supabase/supabase-js
```

## 📊 Database Schema Overzicht

### 🏠 **Rooms Table**
- **code**: Unieke 6-karakter room code
- **host_name**: Naam van de host
- **game_type**: Type game (mixed, mostLikelyTo, etc.)
- **status**: Lobby, playing, finished, closed
- **max_players**: Maximum aantal spelers
- **current_players**: Huidige aantal spelers

### 👥 **Players Table**
- **socket_id**: Socket.IO connection ID
- **player_name**: Naam van de speler
- **avatar**: Emoji avatar
- **is_host**: Is de speler de host?
- **score**: Huidige score
- **position**: Finale positie in het spel

### 🎮 **Game Events Table**
- **event_type**: Type event (vote, answer, tap, etc.)
- **event_data**: JSON data van het event
- **round_number**: Huidige ronde
- **game_phase**: Lobby, playing, results

### 🗳️ **Votes Table**
- **vote_data**: JSON van de stem/antwoord
- **vote_type**: Type stem (player_vote, truth_drink, etc.)
- **response_time**: Tijd in milliseconden
- **is_correct**: Correct antwoord (voor quiz)

### 📊 **Game Statistics Table**
- **total_score**: Totale score
- **rounds_played**: Aantal gespeelde rondes
- **rounds_won**: Aantal gewonnen rondes
- **average_response_time**: Gemiddelde reactietijd
- **accuracy**: Percentage correcte antwoorden

## 🔧 Server Integration

### 1. Supabase Client Initialiseren

```javascript
// server.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);
```

### 2. Database Functies Toevoegen

```javascript
// Import database functions
const db = require('./supabase_integration');

// In je socket handlers:
socket.on('createRoom', async (data) => {
    try {
        // Create room in database
        const room = await db.createRoom({
            code: roomCode,
            hostName: data.hostName,
            hostId: socket.id,
            gameType: data.gameType
        });
        
        // Continue with existing logic...
    } catch (error) {
        console.error('Database error:', error);
    }
});
```

### 3. Real-time Updates

```javascript
// Log game events
socket.on('submitVote', async (data) => {
    try {
        // Log vote in database
        await db.logVote(currentRoom, socket.id, {
            vote: data.vote,
            voteType: 'player_vote',
            roundNumber: gameState.round,
            responseTime: Date.now() - gameState.startTime
        });
        
        // Continue with existing logic...
    } catch (error) {
        console.error('Database error:', error);
    }
});
```

## 📈 Statistics & Analytics

### 1. Room Statistics

```javascript
// Get room statistics
const stats = await db.getRoomStatistics(roomCode);
console.log('Room stats:', stats);
```

### 2. Player Achievements

```javascript
// Award achievement
await db.awardAchievement(socketId, 'fastest_tap', {
    points: 50,
    description: 'Fastest tap in the game!'
});
```

### 3. Game Statistics

```javascript
// Update game statistics
await db.updateGameStatistics(roomCode, {
    [socketId]: {
        totalScore: 150,
        roundsPlayed: 5,
        roundsWon: 2,
        averageResponseTime: 1200,
        accuracy: 85.5
    }
});
```

## 🎯 Custom Questions

### 1. Vragen Toevoegen

```javascript
// Add custom question
await db.addCustomQuestion({
    createdBy: 'admin',
    gameType: 'mostLikelyTo',
    questionText: 'Wie zou het eerst een miljoen verdienen?',
    category: 'funny',
    difficulty: 'medium',
    isApproved: true
});
```

### 2. Vragen Ophalen

```javascript
// Get custom questions
const questions = await db.getCustomQuestions('mostLikelyTo', 'funny');
```

## 🧹 Maintenance

### 1. Cleanup Old Data

```javascript
// Run cleanup (recommended daily)
await db.cleanupOldData();
```

### 2. Database Monitoring

```sql
-- Check active rooms
SELECT * FROM active_rooms;

-- Check player statistics
SELECT * FROM player_stats;

-- Check game type popularity
SELECT * FROM game_type_stats;
```

## 🔒 Security & RLS

### 1. Row Level Security

Het schema heeft RLS (Row Level Security) ingeschakeld voor alle tabellen. Dit betekent:

- **Rooms**: Iedereen kan lezen, alleen host kan updaten
- **Players**: Spelers kunnen hun eigen data beheren
- **Votes**: Spelers kunnen hun eigen stemmen beheren
- **Statistics**: Iedereen kan lezen, alleen systeem kan schrijven

### 2. API Keys

- **Anon Key**: Voor client-side operaties
- **Service Role Key**: Voor server-side operaties (niet in client code!)

## 📱 Client-side Integration

### 1. Supabase Client (Optional)

```javascript
// public/script.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'your-supabase-url',
    'your-supabase-anon-key'
);

// Get room statistics
async function getRoomStats(roomCode) {
    const { data, error } = await supabase
        .from('rooms')
        .select('*, players(*)')
        .eq('code', roomCode)
        .single();
    
    return data;
}
```

## 🚀 Deployment

### 1. Environment Variables

Zorg dat je environment variables correct zijn ingesteld:

```bash
# Production
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

### 2. Database Migrations

Voor productie, gebruik Supabase migrations:

```bash
# Create migration
supabase migration new add_game_statistics

# Apply migration
supabase db push
```

## 🐛 Troubleshooting

### Common Issues:

**"Room not found"**
- Check of de room code correct is
- Check of de room nog actief is

**"Player not found"**
- Check of de socket ID correct is
- Check of de speler nog in de room zit

**"Database connection failed"**
- Check je Supabase URL en API key
- Check je internet verbinding

### Debug Mode:

```javascript
// Enable debug logging
process.env.DEBUG = 'supabase:*';
```

## 📊 Database Views

### 1. Active Rooms
```sql
SELECT * FROM active_rooms;
```

### 2. Player Statistics
```sql
SELECT * FROM player_stats;
```

### 3. Game Type Popularity
```sql
SELECT * FROM game_type_stats;
```

## 🎯 Performance Tips

### 1. Indexes
Het schema heeft al geoptimaliseerde indexes voor:
- Room codes
- Player socket IDs
- Event timestamps
- Vote types

### 2. Cleanup
Run dagelijks cleanup om oude data te verwijderen:
```javascript
await db.cleanupOldData();
```

### 3. Connection Pooling
Supabase heeft automatische connection pooling, maar je kunt het optimaliseren:

```javascript
const supabase = createClient(url, key, {
    db: { schema: 'public' },
    auth: { persistSession: false }
});
```

---

**🎉 Je database is nu klaar voor de Drankspel Multiplayer applicatie!**

Voor vragen of problemen, check de [Supabase documentatie](https://supabase.com/docs) of de GitHub issues.
