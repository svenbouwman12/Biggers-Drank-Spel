# 🍻 Drankspel Multiplayer

Een moderne multiplayer online drankspel applicatie met lobby, join-code en mini-games. Gebouwd met Node.js, Express, Socket.IO en een glass/liquid design.

## 🎯 Features

### 🏠 Lobby & Join
- **Host een game** → Krijg een unieke 4-karakter code
- **Join met code** → Spelers kunnen via code + nickname joinen
- **Random avatars** → Elke speler krijgt een unieke avatar
- **Real-time lobby** → Zie alle spelers live
- **QR code** → Host kan QR code tonen voor makkelijk joinen

### 🎮 Mini-Games
- **🗳️ Most Likely To** → Stem op wie het meest waarschijnlijk is
- **🍺 Truth or Drink** → Kies tussen waarheid of drinken
- **⚡ Speed Tap** → Wie klikt het snelst?
- **🧠 Quiz** → Multiple-choice vragen met timer

### 🎨 Design
- **Glass/Liquid design** → Transparante boxen met blur effecten
- **Responsive** → Werkt perfect op telefoon en desktop
- **Animaties** → Confetti, countdown, hover effecten
- **Modern UI** → Neon buttons, gradient achtergronden

### ⚡ Real-time Sync
- **Socket.IO** → Alle spelers zien exact dezelfde game state
- **Live updates** → Spelers joinen/verlaten real-time
- **Synchronized games** → Alle mini-games zijn perfect gesynchroniseerd

## 🚀 Quick Start

### **Local Development**

#### 1. Install Dependencies
```bash
npm install
```

#### 2. Setup Supabase Database
```bash
# Option A: Automatic installation
node install_supabase.js

# Option B: Manual installation
# 1. Go to https://supabase.com/dashboard
# 2. Open SQL Editor
# 3. Copy and paste supabase_schema.sql
# 4. Click Run
```

#### 3. Start Server
```bash
npm start
```

#### 4. Open Browser
```
http://localhost:3000
```

### **Production Deployment**

#### **Option A: One-Click Deploy**
```bash
# Run deployment script
./deploy.sh
```

#### **Option B: Vercel Dashboard**
1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import from GitHub: `svenbouwman12/Biggers-Drank-Spel`
4. Deploy

#### **Option C: Vercel CLI**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### **Post-Deployment**
1. **Install Database Schema** in Supabase
2. **Update CORS Settings** in Supabase dashboard
3. **Test Application** at your Vercel URL
4. **Configure Custom Domain** (optional)

## 📁 Project Structure

```
drankspel-multiplayer/
├── server.js              # Node.js + Express + Socket.IO backend
├── package.json           # Dependencies en scripts
├── public/                # Frontend bestanden
│   ├── index.html         # Main HTML (home, lobby, game)
│   ├── style.css          # Glass/liquid design CSS
│   └── script.js          # Frontend JavaScript
└── README.md              # Dit bestand
```

## 🎮 How to Play

### Voor Host:
1. **Start een game** → Voer je naam in en kies game type
2. **Deel de code** → Geef de 6-karakter code aan spelers
3. **Start het spel** → Klik "Start Game" als iedereen er is
4. **Geniet!** → Speel de mini-games en zie de scores

### Voor Spelers:
1. **Join een game** → Voer je naam en room code in
2. **Wacht in lobby** → Tot de host het spel start
3. **Speel mee!** → Stem, antwoord en win punten
4. **Zie resultaten** → Bekijk scores en winnaars

## 🎯 Mini-Games

### 🗳️ Most Likely To
- **Hoe het werkt**: Alle spelers stemmen op wie het meest waarschijnlijk is
- **Scoring**: Winnaars krijgen 10 punten
- **Voorbeeld**: "Wie zou het eerst dronken worden?"

### 🍺 Truth or Drink
- **Hoe het werkt**: Speler krijgt een vraag en kiest "waarheid" of "drink"
- **Scoring**: Geen punten, puur voor fun
- **Voorbeeld**: "Wat is je grootste geheim?"

### ⚡ Speed Tap
- **Hoe het werkt**: Wie klikt het snelst op de knop?
- **Scoring**: Snelste speler krijgt 10 punten
- **Voorbeeld**: "Klik zo snel mogelijk!"

### 🧠 Quiz
- **Hoe het werkt**: Multiple-choice vragen met timer
- **Scoring**: Correcte antwoorden geven 10 punten
- **Voorbeeld**: "Wat is de hoofdstad van Nederland?"

## 🔧 Technical Details

### Backend (server.js)
- **Express** → HTTP server en routes
- **Socket.IO** → Real-time communication
- **Room management** → Unieke codes, player tracking
- **Game logic** → Vote counting, scoring, results

### Frontend (public/)
- **Vanilla JavaScript** → Geen frameworks nodig
- **Socket.IO client** → Real-time updates
- **Responsive CSS** → Mobile-first design
- **Glass effects** → Backdrop-filter en transparantie

### Real-time Events
```javascript
// Room events
createRoom, joinRoom, playerJoined, playerLeft

// Game events  
startGame, gameQuestion, submitVote, gameResults

// UI events
countdown, gameStart, hostChanged
```

## 🎨 Design System

### Colors
- **Primary**: Gradient blues (#667eea → #764ba2)
- **Success**: Green (#00b894)
- **Warning**: Orange (#f39c12)
- **Error**: Red (#e74c3c)

### Glass Effects
- **Background**: `rgba(255, 255, 255, 0.1)`
- **Backdrop**: `blur(20px)`
- **Border**: `rgba(255, 255, 255, 0.2)`
- **Shadow**: `0 8px 32px rgba(0, 0, 0, 0.1)`

### Typography
- **Font**: Segoe UI, system fonts
- **Sizes**: 2.5rem (title), 1.1rem (body), 0.9rem (small)
- **Weights**: 700 (bold), 600 (semi), 300 (light)

## 🚀 Deployment

### Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Heroku
```bash
# Add Procfile
echo "web: node server.js" > Procfile

# Deploy
git push heroku main
```

### Docker
```dockerfile
FROM node:16
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

## 🔧 Development

### Scripts
```bash
npm start          # Start production server
npm run dev        # Start with nodemon (development)
```

### Environment Variables
```bash
PORT=3000          # Server port (default: 3000)
NODE_ENV=production # Environment
```

## 🎯 Future Features

### Geplande uitbreidingen:
- **🎵 Muziek** → Background muziek en geluidseffecten
- **📊 Statistieken** → Uitgebreide player stats
- **🎭 Custom avatars** → Spelers kunnen eigen avatar kiezen
- **📱 PWA** → Progressive Web App functionaliteit
- **🌍 Multi-language** → Ondersteuning voor meerdere talen
- **🎨 Themes** → Verschillende design themes
- **📈 Leaderboards** → Global en room leaderboards

### Database integratie:
- **Supabase** → Voor persistent scores en stats
- **Firebase** → Real-time database
- **MongoDB** → Voor complexe game data

## 🐛 Troubleshooting

### Common Issues:

**"Connection lost"**
- Check internet connection
- Refresh page
- Restart server

**"Room not found"**
- Check room code spelling
- Room might be closed
- Try creating new room

**"Game not starting"**
- Need at least 2 players
- Only host can start
- Check browser console

### Debug Mode:
```javascript
// Enable debug logging
localStorage.setItem('debug', 'socket.io-client:*');
```

## 📄 License

MIT License - Feel free to use for personal and commercial projects.

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📞 Support

- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions
- **Email**: support@drankspel.com

---

**🎉 Have fun and drink responsibly! 🍻**
