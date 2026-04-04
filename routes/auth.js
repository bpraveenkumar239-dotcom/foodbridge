const express = require('express');
const router  = express.Router();
const User    = require('../models/User');

// ── Helpers ──────────────────────────────────────────────────────────────────
function redirectByRole(res, role) {
  if (role === 'donor') return res.redirect('/donor/dashboard');
  if (role === 'ngo')   return res.redirect('/ngo/dashboard');
  if (role === 'admin') return res.redirect('/admin/dashboard');
  res.redirect('/login');
}

// ── Login ─────────────────────────────────────────────────────────────────────
router.get('/login', (req, res) => {
  if (req.session.user) return redirectByRole(res, req.session.user.role);
  res.render('auth/login', { error: null, success: null });
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.render('auth/login', { error: 'Invalid email or password', success: null });
    }
    if (user.isBanned) {
      return res.render('auth/login', {
        error: `Your account has been suspended. ${user.banReason ? 'Reason: ' + user.banReason : ''}`,
        success: null
      });
    }
    req.session.user = { id: user._id, name: user.name, email: user.email, role: user.role, organization: user.organization };
    redirectByRole(res, user.role);
  } catch (err) {
    res.render('auth/login', { error: 'Login failed. Please try again.', success: null });
  }
});

// ── Register ─────────────────────────────────────────────────────────────────
router.get('/register', (req, res) => {
  if (req.session.user) return redirectByRole(res, req.session.user.role);
  res.render('auth/register', { error: null });
});

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, confirmPassword, role, organization, phone, address } = req.body;
    if (password !== confirmPassword) return res.render('auth/register', { error: 'Passwords do not match' });
    if (role === 'admin') return res.render('auth/register', { error: 'Invalid role selection' });
    if (await User.findOne({ email })) return res.render('auth/register', { error: 'Email already registered' });
    await new User({ name, email, password, role, organization, phone, address }).save();
    res.render('auth/login', { error: null, success: 'Registration successful! Please login.' });
  } catch (err) {
    res.render('auth/register', { error: 'Registration failed. Please try again.' });
  }
});

// ── Logout ────────────────────────────────────────────────────────────────────
router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;
