# 🚀 Supabase Setup Instructies

## Stap 1: Database Schema Aanmaken

1. Ga naar je Supabase dashboard: https://supabase.com/dashboard
2. Selecteer je project: `tmqnpdtbldewusevrgxc`
3. Ga naar **SQL Editor** in het linker menu
4. Klik op **"New Query"**
5. Kopieer en plak de volledige inhoud van `database_schema.sql`
6. Klik op **"Run"** om het schema aan te maken

## Stap 2: Real-time (Optioneel)

**⚠️ Opmerking**: Supabase Replication is nog in Early Access. De app gebruikt nu **polling** voor updates.

**Als je toch real-time wilt gebruiken:**
1. Ga naar **Database** → **Replication** in het linker menu
2. Zorg ervoor dat **"Replication"** is ingeschakeld
3. Controleer of de volgende tabellen zijn toegevoegd aan real-time:
   - `rooms`
   - `players` 
   - `game_actions`
   - `game_states`

**Polling mode (Aanbevolen):**
- De app controleert elke 3 seconden op updates
- Werkt zonder Early Access features
- Voldoende responsief voor drankspelen

## Stap 3: Row Level Security Controleren

1. Ga naar **Authentication** → **Policies** in het linker menu
2. Controleer of alle policies correct zijn aangemaakt
3. Test de policies door een test query uit te voeren

## Stap 4: Test de Verbinding

1. Open `index.html` in je browser
2. Ga naar **"🏠 Lobby"**
3. Probeer een lobby aan te maken
4. Controleer de browser console voor eventuele fouten

## Troubleshooting

### Veelvoorkomende Problemen:

**"Permission denied" errors:**
- Controleer of Row Level Security policies correct zijn ingesteld
- Zorg ervoor dat de anon key correct is geconfigureerd

**Real-time werkt niet:**
- Controleer of Replication is ingeschakeld
- Controleer of tabellen zijn toegevoegd aan real-time publication

**Database connection errors:**
- Controleer of de Supabase URL en anon key correct zijn
- Controleer of je project actief is

### Test Queries:

```sql
-- Test rooms table
SELECT * FROM rooms LIMIT 5;

-- Test players table  
SELECT * FROM players LIMIT 5;

-- Test real-time
SELECT * FROM rooms_with_players;
```

## Klaar! 🎉

Je Supabase database is nu klaar voor gebruik met de Drankspel Party webapp!

De webapp zal automatisch verbinding maken met je Supabase database en real-time multiplayer functionaliteit bieden.
