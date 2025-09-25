# 🚀 Vercel Dashboard Deployment Setup

Stap-voor-stap instructies voor het deployen via de Vercel dashboard.

## 📋 Deployment Stappen

### **Stap 1: Vercel Dashboard**
1. Ga naar [vercel.com](https://vercel.com)
2. Klik **"Sign up"** of **"Log in"**
3. Kies **"Continue with GitHub"**

### **Stap 2: Import Project**
1. Klik **"New Project"**
2. Klik **"Import Git Repository"**
3. Zoek naar **"Biggers-Drank-Spel"**
4. Klik **"Import"** naast `svenbouwman12/Biggers-Drank-Spel`

### **Stap 3: Configure Project**
```
Project Name: drankspel-multiplayer
Framework Preset: Other
Root Directory: ./
Build Command: (leave empty)
Output Directory: (leave empty)
Install Command: npm install
```

### **Stap 4: Environment Variables**
In de **Environment Variables** sectie, voeg toe:

```
Name: SUPABASE_URL
Value: https://tmqnpdtbldewusevrgxc.supabase.co

Name: SUPABASE_ANON_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtcW5wZHRibGRld3VzZXZyZ3hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0NTYzNDMsImV4cCI6MjA3NDAzMjM0M30.0YsgPSlp-_Egj72t7e5wZRIWxQWXIouvGY_jXHLS1Ys
```

### **Stap 5: Deploy**
1. Klik **"Deploy"**
2. Wacht op deployment (2-3 minuten)
3. Klik op de **deployment URL**

## 🔧 Post-Deployment Configuration

### **1. Database Schema Installeren**
1. Ga naar [supabase.com/dashboard](https://supabase.com/dashboard)
2. Selecteer je project
3. Ga naar **SQL Editor**
4. Kopieer de hele inhoud van `supabase_schema.sql`
5. Plak het in de SQL Editor
6. Klik **"Run"**

### **2. CORS Settings**
1. Ga naar [supabase.com/dashboard](https://supabase.com/dashboard)
2. Selecteer je project
3. Ga naar **Settings → API**
4. Add je Vercel domain aan **allowed origins**:
   ```
   https://drankspel-multiplayer.vercel.app
   https://drankspel-multiplayer-git-main.vercel.app
   ```

### **3. Test Application**
1. Open je Vercel URL
2. Test alle functionaliteiten:
   - Host een game
   - Join met een andere browser
   - Test alle mini-games
   - Controleer database logging

## 🐛 Troubleshooting

### **"Build Failed"**
- Check of alle dependencies correct zijn
- Verify Node.js version (>=16)
- Check build logs in Vercel dashboard

### **"Database Connection Failed"**
- Verify Supabase credentials
- Check of database schema is geïnstalleerd
- Verify CORS settings

### **"WebSocket Errors"**
- Check of `script-vercel.js` wordt gebruikt
- Verify polling system is actief
- Check API endpoints

## ✅ Success!

Na deployment heb je:
- ✅ **Live multiplayer game** op Vercel
- ✅ **Persistent database** via Supabase
- ✅ **Real-time synchronization**
- ✅ **Mobile responsive design**
- ✅ **QR code joining**

**Je applicatie is nu live! 🎉🍻**
