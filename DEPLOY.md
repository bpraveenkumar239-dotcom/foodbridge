# 🚀 FoodBridge — Deploy Guide (Free + Permanent)

## One-Time Setup (takes ~20 minutes)

### 1. MongoDB Atlas (Free Database)
1. Go to https://mongodb.com/cloud/atlas → Sign up
2. Create FREE M0 cluster (Mumbai region)
3. Database Access → Add User: `foodbridge` / `YourPassword123`
4. Network Access → Allow from Anywhere (0.0.0.0/0)
5. Clusters → Connect → Drivers → Copy connection string

### 2. GitHub (Code Repository)
```bash
cd leftover-food-mgmt
git init
git add .
git commit -m "FoodBridge v1.0"
```
- Go to github.com → New Repository → foodbridge → Public
```bash
git remote add origin https://github.com/YOURNAME/foodbridge.git
git branch -M main
git push -u origin main
```

### 3. Render (Free Hosting)
1. Go to https://render.com → Sign up with GitHub
2. New → Web Service → Connect "foodbridge" repo
3. Settings:
   - Name: foodbridge
   - Region: Singapore
   - Build Command: `npm install`
   - Start Command: `node server.js`
   - Plan: FREE
4. Environment Variables:
   ```
   MONGODB_URI    = mongodb+srv://foodbridge:YourPassword@cluster0.xxx.mongodb.net/foodbridge
   SESSION_SECRET = any_long_random_string_here
   PORT           = 10000
   NODE_ENV       = production
   ```
5. Click "Create Web Service"
6. Your URL: https://foodbridge.onrender.com

### 4. Create Admin Account
```bash
# Set MONGODB_URI in your local .env to the Atlas URL, then:
node scripts/create-admin.js
```

### 5. Install as App
- **Android**: Chrome → ⋮ menu → Add to Home Screen
- **iPhone**: Safari → Share → Add to Home Screen
- **PC**: Chrome → address bar install icon → Install

---

## Every Time You Update the App

```bash
# 1. Make your code changes

# 2. Bump version (triggers update notification on all devices)
npm run bump

# 3. Push to GitHub (Render auto-deploys in ~2 minutes)
git add .
git commit -m "describe your changes"
git push

# OR do all in one command:
npm run deploy
```

### What happens automatically:
1. GitHub receives your push
2. Render detects the change → rebuilds and redeploys (~2 min)
3. Users who open the app see: **"🔄 Update Available!"** banner
4. They click **"Update Now"** → app refreshes with new version
5. Users who click **"Later"** get the banner again next time

---

## Free Tier Limits

| Service | Free Limit | Notes |
|---|---|---|
| MongoDB Atlas M0 | 512MB storage | Enough for 100,000+ donations |
| Render Free | 750 hours/month | App sleeps after 15min inactivity |
| Render Sleep | Wakes in ~30s | First request after sleep is slow |

### Fix Render Sleep (Keep app always awake - free)
1. Go to https://uptimerobot.com → Sign up free
2. New Monitor → HTTP → URL: `https://foodbridge.onrender.com/health`
3. Check interval: Every 10 minutes
4. This pings your app every 10min → keeps it awake 24/7

---

## Troubleshooting

**MongoDB not connecting:**
- Check Network Access allows 0.0.0.0/0
- Verify password has no special characters (use alphanumeric)

**GPS not working on phone:**
- Must use HTTPS (Render provides this automatically)
- On iPhone: Settings → Privacy → Location Services → Chrome/Safari → Allow

**App not updating:**
- Clear app data: Settings → Apps → Chrome → Clear Cache
- Or: Long press app icon → App Info → Clear Cache

**Render deploy failed:**
- Check Render logs for error
- Common fix: make sure `PORT = 10000` in env vars
