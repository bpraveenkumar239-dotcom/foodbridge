require('dotenv').config();
const express        = require('express');
const mongoose       = require('mongoose');
const session        = require('express-session');
const MongoStore     = require('connect-mongo');
const bodyParser     = require('body-parser');
const methodOverride = require('method-override');
const path           = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// Trust Render/Railway proxy — required for HTTPS, GPS, secure cookies
app.set('trust proxy', 1);

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => { console.log('✅ MongoDB connected'); startCronJobs(); })
  .catch(err => console.error('❌ MongoDB error:', err));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

// Force HTTPS redirect in production
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(301, 'https://' + req.headers.host + req.url);
  }
  next();
});

app.use(session({
  secret: process.env.SESSION_SECRET || 'food_secret_key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7,   // 7 days
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax'
  }
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use((req, res, next) => { res.locals.user = req.session.user || null; next(); });

app.use('/',      require('./routes/auth'));
app.use('/donor', require('./routes/donor'));
app.use('/ngo',   require('./routes/ngo'));
//app.use('/api',   require('./routes/api'));
app.use('/admin', require('./routes/admin'));

app.get('/', (req, res) => {
  const u = req.session.user;
  if (!u) return res.redirect('/login');
  if (u.role === 'donor') return res.redirect('/donor/dashboard');
  if (u.role === 'ngo')   return res.redirect('/ngo/dashboard');
  if (u.role === 'admin') return res.redirect('/admin/dashboard');
  res.redirect('/login');
});

// Health check endpoint (Render uses this to keep app awake)
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Auto-expire cron (every 10 minutes)
function startCronJobs() {
  const Food         = require('./models/Food');
  const Notification = require('./models/Notification');

  async function expireCheck() {
    try {
      const now     = new Date();
      const expired = await Food.find({ status: 'pending', expiresAt: { $lt: now }, isExpired: { $ne: true } });
      for (const f of expired) {
        await Food.findByIdAndUpdate(f._id, { status: 'expired', isExpired: true });
        await Notification.create({
          userEmail: f.donorEmail, type: 'expiry',
          title: '⏰ Donation Expired',
          message: `Your donation "${f.name}" has expired. You can re-list it for other NGOs.`,
          foodId: f._id, foodName: f.name
        });
      }
      if (expired.length) console.log(`⏰ Expired ${expired.length} donation(s)`);
    } catch (e) { console.error('Expiry check error:', e.message); }
  }

  expireCheck();
  setInterval(expireCheck, 10 * 60 * 1000);
}

app.listen(PORT, () => console.log(`🚀 Server → http://localhost:${PORT}`));
