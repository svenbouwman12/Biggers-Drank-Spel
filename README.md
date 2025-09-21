# 🎉 Drankspel Party 🍻

[![Live Demo](https://img.shields.io/badge/Live%20Demo-🎮%20Play%20Now-green?style=for-the-badge)](https://your-username.github.io/drankspel-party)
[![Supabase](https://img.shields.io/badge/Supabase-Realtime%20Database-orange?style=for-the-badge&logo=supabase)](https://supabase.com)
[![Vanilla JS](https://img.shields.io/badge/JavaScript-Vanilla%20ES6+-yellow?style=for-the-badge&logo=javascript)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

Een volledig werkende single-page webapp voor drie populaire drankspelen! Perfect voor feestjes en gezellige avonden. **Nu met multiplayer lobby systeem!**

## ✨ Features

- 🏠 **Multiplayer Lobby System** - Speel samen online
- 🎮 **Drie Drankspelen** - Paardenrace, Mexico, en Bussen
- ⚡ **Real-time Updates** - Via Supabase polling
- 📱 **Responsive Design** - Werkt op alle apparaten
- 💾 **Local Storage** - Instellingen blijven bewaard
- 🔒 **Veilig & Verantwoordelijk** - Volwassenen 18+

## 🚀 Hoe openen

1. **Lokaal openen**: Dubbelklik op `index.html` in je bestandsverkenner
2. **Via browser**: Sleep `index.html` naar je webbrowser venster
3. **Direct**: Open `index.html` met je favoriete webbrowser

De app werkt volledig lokaal - geen internetverbinding nodig voor lokale spelen!

## 🏠 Multiplayer Lobby Systeem

### Nieuwe lobby maken
1. Klik op **"🏠 Lobby"** op het startscherm
2. Vul je naam en room naam in
3. Kies het spel dat je wilt spelen
4. Stel het maximum aantal spelers in
5. Klik **"🏠 Lobby maken"**
6. Deel de **room code** met je vrienden!

### Lobby joinen
1. Klik op **"🏠 Lobby"** op het startscherm
2. Ga naar de **"Join lobby"** tab
3. Vul je naam en de **room code** in
4. Klik **"🚪 Join lobby"**

### In de lobby
- **Host**: Kan het spel starten wanneer iedereen klaar is
- **Spelers**: Kunnen zien wie er in de lobby zit
- **Room code**: Wordt getoond voor het delen met vrienden
- **Spel type**: Wordt getoond zodat iedereen weet wat er gespeeld wordt

### Spel starten
- **Minimaal 2 spelers** nodig om te starten
- **Alleen de host** kan het spel starten
- Alle spelers moeten **"Klaar"** zijn
- Het spel start automatisch voor alle spelers

## 🎮 Hoe spelen

### Startscherm
- **🏠 Lobby**: Maak of join een multiplayer lobby
- **🎮 Lokaal spelen**: Speel alleen of met vrienden op dezelfde computer
- **📖 Spelregels bekijken**: Lees de regels van alle spelen
- **⚙️ Instellingen**: Pas het aantal spelers en andere opties aan

### Menu navigatie
- Gebruik de knoppen om tussen schermen te navigeren
- **Escape** toets: Ga terug naar vorige scherm
- **Enter** toets: Activeer de geselecteerde knop

## 🎲 Beschikbare spelen

### 🏇 Paardenrace
- **Doel**: Wed op paarden en kijk wie als eerste de finish bereikt
- **Mechaniek**: Gooi een dobbelsteen (1-6) → het overeenkomstige paard schuift vooruit
- **Winnaar**: Mag 1 drankje uitdelen
- **Verliezers**: Drinken 2 drankjes

### 🎲 Mexico
- **Doel**: Krijg de hoogste score met twee dobbelstenen
- **Scoring**: Grootste cijfer + kleinste cijfer (bijv. 4+2 = 42)
- **Mexico**: 21 is altijd de hoogste score (1+1)
- **Laagste score**: Moet drinken
- **Mexico gooien**: Mag 2 drankjes uitdelen

### 🃏 Bussen
- **Fase 1**: Vraag en antwoord met kaarten
  - Rood/zwart raden
  - Hoger/lager dan vorige kaart
  - Binnen/buiten twee vorige kaarten
  - Kleur raden (klaveren, harten, schoppen, ruiten)
- **Fase 2**: De bus (piramide van kaarten)
  - Kaarten worden omgedraaid
  - Heb je de kaart? Deel drankjes uit!

## ⚙️ Instellingen

### Spelers configuratie
- **Aantal spelers**: 2-8 spelers (standaard: 4)
- **Namen**: Pas speler namen aan (standaard: Speler 1, Speler 2, etc.)

### Drink instellingen
- **Eenheid**: Kies tussen "slokken", "shots", of "anders"
- **Scorebord**: Houdt drankpunten bij per speler
- **Reset**: Reset alle scores met de reset-knop

### Weergave opties
- **Animatie snelheid**: Langzaam, standaard, of snel
- **Geluid**: Aan/uit voor dobbelsteen en kaart geluiden

### Opslag
- Alle instellingen en scores worden automatisch opgeslagen in `localStorage`
- Bij herladen van de pagina blijven alle instellingen behouden

## 🎨 Features

### Responsive design
- Werkt perfect op desktop, tablet en mobiel
- Touch-vriendelijke knoppen en interface
- Automatische aanpassing aan schermgrootte

### Animaties en effecten
- Dobbelsteen roll animaties
- Paarden bewegen over de racebaan
- Kaarten flip effecten
- Confetti bij overwinningen
- Smooth transitions tussen schermen

### Toegankelijkheid
- Volledige toetsenbord navigatie
- Hoog contrast ondersteuning
- Leesbare fonts en kleuren
- Screen reader vriendelijk

## 🔧 Technische details

### Technologieën
- **HTML5**: Semantische structuur
- **CSS3**: Responsive design, animaties, gradients
- **Vanilla JavaScript**: Geen frameworks, volledig lokaal
- **localStorage**: Persistente opslag van instellingen

### Browser ondersteuning
- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

### Bestandsstructuur
```
drankspel-party/
├── index.html          # Hoofdpagina structuur met lobby interface
├── styles.css          # Volledige styling, animaties en lobby CSS
├── app.js             # Spel logica, WebSocket simulatie en core functies
├── lobby.js           # Lobby management en multiplayer functies
└── README.md          # Deze documentatie
```

## ⚠️ Veiligheid en verantwoordelijkheid

**BELANGRIJK**: Deze app is bedoeld voor volwassenen (18+) en moet verantwoord gebruikt worden.

### Veiligheidsrichtlijnen
- Drink altijd met mate
- Zorg voor voldoende water en voedsel
- Speel niet onder invloed van drugs
- Respecteer anderen en hun grenzen
- Zorg voor een veilige omgeving

### Disclaimer
Deze app is alleen bedoeld voor entertainment doeleinden. De makers zijn niet verantwoordelijk voor misbruik of overmatig alcoholgebruik. Gebruik altijd je gezond verstand en speel verantwoordelijk.

## 🚀 Toekomstige uitbreidingen

### Geplande features
- **Echte WebSocket server**: Volledige online multiplayer implementatie
- **Meer spelen**: Extra drankspelen toevoegen
- **Custom regels**: Aanpasbare spelregels per spel
- **Thema's**: Verschillende visuele thema's
- **Statistieken**: Uitgebreide spelstatistieken
- **Geluiden**: Meer geluidseffecten en muziek
- **Chat systeem**: Berichten versturen tijdens het spelen
- **Spectator mode**: Toekijken bij spelen

### Multiplayer implementatie
De huidige implementatie gebruikt simulatie voor demo doeleinden. Voor echte online multiplayer kunnen de volgende technologieën gebruikt worden:
- **WebSockets**: Real-time communicatie tussen spelers
- **WebRTC**: Peer-to-peer verbindingen voor lag-vrije games
- **Firebase**: Backend services en real-time database
- **Socket.io**: Eenvoudige WebSocket implementatie
- **Node.js server**: Custom backend voor lobby management

## 🐛 Problemen oplossen

### Veelgestelde problemen

**App laadt niet**
- Controleer of alle bestanden aanwezig zijn
- Probeer een andere browser
- Controleer browser console voor foutmeldingen

**Instellingen worden niet opgeslagen**
- Controleer of localStorage is ingeschakeld
- Probeer incognito/privé modus uit te schakelen
- Controleer browser instellingen

**Animaties werken niet**
- Controleer of hardware acceleratie is ingeschakeld
- Probeer andere animatie snelheid instelling
- Controleer browser performance instellingen

### Browser specifieke issues

**Safari**: Mogelijk problemen met localStorage in privé modus
**Firefox**: Controleer privacy instellingen voor localStorage
**Chrome**: Geen bekende problemen

## 📞 Support

Voor vragen, bugs of suggesties:
1. Controleer eerst deze README
2. Controleer browser console voor foutmeldingen
3. Test in verschillende browsers
4. Reset instellingen via browser localStorage

## 📄 Licentie

Deze app is open source en vrij te gebruiken voor persoonlijke doeleinden. 

---

**Geniet van het spel en speel verantwoordelijk! 🎉🍻**
