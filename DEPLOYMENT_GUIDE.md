# 🚀 GitHub to Vercel Deployment Guide

Complete guide voor het deployen van de Drankspel Multiplayer applicatie van GitHub naar Vercel.

## 📋 Pre-Deployment Checklist

### ✅ 1. Database Schema Installeren
```bash
# Ga naar https://supabase.com/dashboard
# Open SQL Editor
# Kopieer en plak supabase_schema.sql
# Klik Run
```

### ✅ 2. GitHub Repository Ready
- [x] Code is gepusht naar GitHub
- [x] Alle bestanden zijn gecommit
- [x] Repository is publiek of je hebt Vercel Pro

## 🚀 Vercel Deployment (3 Methoden)

### **Methode 1: Vercel Dashboard (Aanbevolen)**

#### **Stap 1: Vercel Account**
1. Ga naar [vercel.com](https://vercel.com)
2. Klik **"Sign up"** of **"Log in"**
3. Kies **"Continue with GitHub"**

#### **Stap 2: Import Project**
1. Klik **"New Project"**
2. Klik **"Import Git Repository"**
3. Selecteer **"svenbouwman12/Biggers-Drank-Spel"**
4. Klik **"Import"**

#### **Stap 3: Configure Project**
```
Project Name: drankspel-multiplayer
Framework Preset: Other
Root Directory: ./
Build Command: (leave empty)
Output Directory: (leave empty)
Install Command: npm install
```

#### **Stap 4: Environment Variables**
In de **Environment Variables** sectie:
```
SUPABASE_URL = https://tmqnpdtbldewusevrgxc.supabase.co
SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtcW5wZHRibGRld3VzZXZyZ3hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0NTYzNDMsImV4cCI6MjA3NDAzMjM0M30.0YsgPSlp-_Egj72t7e5wZRIWxQWXIouvGY_jXHLS1Ys
```

#### **Stap 5: Deploy**
1. Klik **"Deploy"**
2. Wacht op deployment (2-3 minuten)
3. Klik op de **deployment URL**

---

### **Methode 2: Vercel CLI**

#### **Stap 1: Install Vercel CLI**
```bash
npm i -g vercel
```

#### **Stap 2: Login**
```bash
vercel login
```

#### **Stap 3: Deploy**
```bash
# In je project directory
vercel

# Follow prompts:
# Set up and deploy? Y
# Which scope? (your account)
# Link to existing project? N
# Project name? drankspel-multiplayer
# Directory? ./
# Override settings? N
```

#### **Stap 4: Environment Variables**
```bash
vercel env add SUPABASE_URL
# Enter: https://tmqnpdtbldewusevrgxc.supabase.co

vercel env add SUPABASE_ANON_KEY
# Enter: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtcW5wZHRibGRld3VzZXZyZ3hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0NTYzNDMsImV4cCI6MjA3NDAzMjM0M30.0YsgPSlp-_Egj72t7e5wZRIWxQWXIouvGY_jXHLS1Ys
```

---

### **Methode 3: GitHub Actions (Advanced)**

#### **Stap 1: Create .github/workflows/vercel.yml**
```yaml
name: Deploy to Vercel
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
          working-directory: ./
```

#### **Stap 2: Add Secrets to GitHub**
In je GitHub repository:
1. Settings → Secrets and variables → Actions
2. Add secrets:
   - `VERCEL_TOKEN`
   - `ORG_ID`
   - `PROJECT_ID`

---

## 🔧 Post-Deployment Configuration

### **1. CORS Settings (Supabase)**
1. Ga naar [supabase.com/dashboard](https://supabase.com/dashboard)
2. Selecteer je project
3. Settings → API
4. Add je Vercel domain aan **allowed origins**:
   ```
   https://drankspel-multiplayer.vercel.app
   https://drankspel-multiplayer-git-main.vercel.app
   ```

### **2. Domain Configuration**
1. Ga naar je Vercel project dashboard
2. Settings → Domains
3. Add custom domain (optioneel):
   ```
   drankspel.com
   ```

### **3. Environment Variables Check**
In Vercel dashboard:
1. Settings → Environment Variables
2. Verify:
   - `SUPABASE_URL` ✅
   - `SUPABASE_ANON_KEY` ✅

---

## 🧪 Testing Deployment

### **1. Basic Functionality**
```bash
# Test URL: https://your-app.vercel.app
1. Open de URL
2. Host een game
3. Join met een andere browser
4. Test alle mini-games
```

### **2. Database Integration**
```bash
# Check Supabase dashboard:
1. Tables → rooms (should have data)
2. Tables → players (should have data)
3. Tables → game_events (should have data)
```

### **3. Real-time Features**
```bash
# Test polling system:
1. Open browser console
2. Check for polling requests every second
3. Verify no WebSocket errors
4. Test vote submission
```

---

## 🐛 Troubleshooting

### **Common Issues:**

#### **"Build Failed"**
```bash
# Check:
1. package.json dependencies
2. Node.js version (>=16)
3. Build logs in Vercel dashboard
```

#### **"Database Connection Failed"**
```bash
# Check:
1. Supabase credentials correct
2. CORS settings updated
3. Database schema installed
```

#### **"WebSocket Errors"**
```bash
# Check:
1. Using script-vercel.js (not script.js)
2. Polling system active
3. API endpoints working
```

#### **"404 on API Routes"**
```bash
# Check:
1. vercel.json routing
2. API endpoints in server.js
3. Function timeout settings
```

---

## 📊 Monitoring & Analytics

### **Vercel Dashboard**
- **Deployments** - View deployment history
- **Functions** - Monitor API performance
- **Analytics** - User traffic and usage

### **Supabase Dashboard**
- **Database** - Query performance
- **Auth** - User authentication
- **Realtime** - Connection monitoring

### **Performance Optimization**
```bash
# Vercel Analytics
1. Enable Vercel Analytics
2. Monitor Core Web Vitals
3. Optimize bundle size
```

---

## 🎯 Production Checklist

### **Pre-Launch:**
- [ ] Database schema installed
- [ ] Environment variables set
- [ ] CORS configured
- [ ] Domain configured
- [ ] SSL certificate active

### **Post-Launch:**
- [ ] All features tested
- [ ] Mobile responsive
- [ ] Real-time sync working
- [ ] Database logging active
- [ ] Error monitoring setup

---

## 🚀 Success!

Na deployment heb je:
- ✅ **Live multiplayer game** op Vercel
- ✅ **Persistent database** via Supabase
- ✅ **Real-time synchronization**
- ✅ **Mobile responsive design**
- ✅ **QR code joining**
- ✅ **Complete analytics**

**Je applicatie is nu live en klaar voor gebruik! 🍻🎉**

---

## 📞 Support

Voor problemen:
- Check Vercel function logs
- Check Supabase dashboard
- Test lokaal eerst
- Check browser console

**Happy deploying! 🚀**
