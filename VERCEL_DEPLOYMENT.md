# 🚀 Vercel Deployment Guide

Complete guide voor het deployen van de Drankspel Multiplayer applicatie op Vercel.

## 📋 Pre-Deployment Checklist

### 1. Database Schema Installeren
```bash
# Ga naar https://supabase.com/dashboard
# Open SQL Editor
# Kopieer en plak supabase_schema.sql
# Klik Run
```

### 2. Dependencies Installeren (Lokaal)
```bash
npm install
```

### 3. Lokaal Testen
```bash
npm start
# Test op http://localhost:3000
```

## 🚀 Vercel Deployment

### **Optie A: Vercel CLI (Aanbevolen)**

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Login to Vercel
vercel login

# 3. Deploy
vercel

# 4. Follow prompts:
# - Set up and deploy? Y
# - Which scope? (your account)
# - Link to existing project? N
# - Project name? drankspel-multiplayer
# - Directory? ./
# - Override settings? N
```

### **Optie B: GitHub Integration**

1. **Push naar GitHub:**
```bash
git add .
git commit -m "Ready for Vercel deployment"
git push origin main
```

2. **Vercel Dashboard:**
   - Ga naar [vercel.com](https://vercel.com)
   - Klik "New Project"
   - Import from GitHub
   - Selecteer je repository
   - Deploy

## ⚙️ Vercel Configuration

### **vercel.json** (Al aangemaakt)
```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "server.js"
    }
  ],
  "env": {
    "SUPABASE_URL": "https://tmqnpdtbldewusevrgxc.supabase.co",
    "SUPABASE_ANON_KEY": "your-anon-key"
  }
}
```

### **Environment Variables**
De Supabase credentials zijn al in `vercel.json` gezet, maar je kunt ze ook in de Vercel dashboard instellen:

1. Ga naar je project in Vercel dashboard
2. Settings → Environment Variables
3. Add:
   - `SUPABASE_URL` = `https://tmqnpdtbldewusevrgxc.supabase.co`
   - `SUPABASE_ANON_KEY` = `your-anon-key`

## 🔧 Post-Deployment

### 1. **Test de Applicatie**
- Ga naar je Vercel URL
- Test alle functionaliteiten
- Controleer database connectie

### 2. **Database Verificatie**
- Ga naar Supabase dashboard
- Controleer of er data wordt opgeslagen
- Test room creation en player joining

### 3. **CORS Settings**
Als je CORS errors krijgt:
1. Ga naar Supabase dashboard
2. Settings → API
3. Add je Vercel domain aan allowed origins:
   - `https://your-app.vercel.app`
   - `https://your-app-git-main.vercel.app`

## 📊 Monitoring

### **Vercel Dashboard**
- Monitor deployments
- Check function logs
- View performance metrics

### **Supabase Dashboard**
- Monitor database usage
- Check real-time connections
- View query performance

## 🐛 Troubleshooting

### **Common Issues:**

**"Module not found"**
```bash
# Check package.json dependencies
npm install
```

**"Database connection failed"**
- Check Supabase credentials
- Verify database schema is installed
- Check CORS settings

**"Socket.IO not working"**
- Check Vercel function logs
- Verify WebSocket support
- Check network connectivity

### **Debug Mode:**
```bash
# Local debugging
npm run dev

# Check Vercel logs
vercel logs
```

## 🎯 Production Optimizations

### **Performance:**
- Database connection pooling
- Caching strategies
- CDN optimization

### **Security:**
- Environment variables
- CORS configuration
- Rate limiting

### **Monitoring:**
- Error tracking
- Performance monitoring
- User analytics

## 📱 Mobile Testing

### **QR Code Joining:**
1. Host een game op desktop
2. Scan QR code met telefoon
3. Test mobile responsiveness

### **Cross-Platform:**
- Test op verschillende browsers
- Test op iOS/Android
- Test real-time sync

## 🎉 Success!

Na deployment heb je:
- ✅ **Live multiplayer game** op Vercel
- ✅ **Persistent database** via Supabase
- ✅ **Real-time synchronization**
- ✅ **Mobile responsive design**
- ✅ **QR code joining**
- ✅ **Complete analytics**

**Je applicatie is nu live en klaar voor gebruik! 🍻🎉**

## 📞 Support

Voor problemen:
- Check Vercel function logs
- Check Supabase dashboard
- Test lokaal eerst
- Check browser console

**Happy coding! 🚀**
