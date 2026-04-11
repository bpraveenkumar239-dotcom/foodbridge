const express = require('express');
const router  = express.Router();
const Food    = require('../models/Food');
const User    = require('../models/User');
const { requireDonor } = require('../middleware/auth');
const { createNotification } = require('../utils/notify');

// ── Dashboard ─────────────────────────────────────────────────────────────
router.get('/dashboard', requireDonor, async (req, res) => {
  try {
    const myDonations = await Food.find({ donorEmail: req.session.user.email });
    const stats = {
      total:     myDonations.length,
      delivered: myDonations.filter(d => d.status === 'delivered').length,
      pending:   myDonations.filter(d => d.status === 'pending').length,
      accepted:  myDonations.filter(d => ['accepted','picked_up'].includes(d.status)).length,
    };
    // Impact estimation: avg 3 people per serving
    const totalServings = myDonations.filter(d => d.servings).reduce((sum, d) => sum + (d.servings || 0), 0);
    const livesImpacted = totalServings * 3;
    const co2Saved = (stats.delivered * 2.5).toFixed(1); // ~2.5 kg CO2 per donation
    res.render('donor/dashboard', { user: req.session.user, stats, livesImpacted, co2Saved });
  } catch (err) {
    res.render('donor/dashboard', { user: req.session.user, stats: { total:0, delivered:0, pending:0, accepted:0 }, livesImpacted: 0, co2Saved: 0 });
  }
});

// ── Donate form ───────────────────────────────────────────────────────────
router.get('/donate', requireDonor, (req, res) => {
  res.render('donor/donate', { user: req.session.user, error: null, prefill: null });
});

// ── Submit donation ───────────────────────────────────────────────────────
router.post('/donate', requireDonor, async (req, res) => {
  try {
    const { foodName, quantity, description, category, tags, servings, expiresAt,
            pickupLocation, pickupLatitude, pickupLongitude } = req.body;

    if (!foodName || !quantity || !pickupLocation) {
      return res.render('donor/donate', { user: req.session.user, error: 'Please fill in all required fields.', prefill: req.body });
    }
    const qNum = parseFloat(quantity);
    if (isNaN(qNum) || qNum < 10) {
      return res.render('donor/donate', { user: req.session.user, error: 'Minimum quantity is 10 servings/kg.', prefill: req.body });
    }

    const donorUser = await User.findOne({ email: req.session.user.email }).select('phone');
    const tagArray  = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];

    const food = new Food({
      name: foodName, quantity, description, category: category || 'other',
      tags: tagArray, servings: parseInt(servings) || null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      pickupLocation,
      pickupLatitude:  parseFloat(pickupLatitude)  || null,
      pickupLongitude: parseFloat(pickupLongitude) || null,
      donorEmail: req.session.user.email,
      donorName:  req.session.user.name,
      donorPhone: donorUser ? donorUser.phone : null
    });
    await food.save();
    res.redirect(`/donor/delivery/${food._id}`);
  } catch (err) {
    console.error(err);
    res.render('donor/donate', { user: req.session.user, error: 'Donation failed. Try again.', prefill: req.body });
  }
});

// ── Re-request (re-list rejected donation) ────────────────────────────────
router.post('/rerequest/:id', requireDonor, async (req, res) => {
  try {
    const original = await Food.findById(req.params.id);
    if (!original || original.donorEmail !== req.session.user.email) return res.redirect('/donor/history');
    if (!['rejected','expired'].includes(original.status)) return res.redirect('/donor/history');

    const donorUser = await User.findOne({ email: req.session.user.email }).select('phone');
    const reNew = new Food({
      name: original.name, quantity: original.quantity, description: original.description,
      category: original.category, tags: original.tags, servings: original.servings,
      pickupLocation: original.pickupLocation, pickupLatitude: original.pickupLatitude,
      pickupLongitude: original.pickupLongitude, deliveryLocation: original.deliveryLocation,
      deliveryLatitude: original.deliveryLatitude, deliveryLongitude: original.deliveryLongitude,
      donorEmail: req.session.user.email, donorName: req.session.user.name,
      donorPhone: donorUser ? donorUser.phone : null,
      reRequestCount: (original.reRequestCount || 0) + 1,
      originalId: original._id
    });
    await reNew.save();
    res.redirect('/donor/history');
  } catch (err) { res.redirect('/donor/history'); }
});

// ── Delivery location ─────────────────────────────────────────────────────
router.get('/delivery/:id', requireDonor, async (req, res) => {
  try {
    const food = await Food.findById(req.params.id);
    if (!food || food.donorEmail !== req.session.user.email) return res.redirect('/donor/history');
    res.render('donor/delivery', { user: req.session.user, food });
  } catch (err) { res.redirect('/donor/history'); }
});

router.post('/delivery/:id', requireDonor, async (req, res) => {
  try {
    const { deliveryLocation, deliveryLatitude, deliveryLongitude } = req.body;
    await Food.findByIdAndUpdate(req.params.id, {
      deliveryLocation,
      deliveryLatitude:  parseFloat(deliveryLatitude)  || null,
      deliveryLongitude: parseFloat(deliveryLongitude) || null
    });
    res.redirect('/donor/history');
  } catch (err) { res.redirect('/donor/history'); }
});

router.get('/skip-delivery/:id', requireDonor, async (req, res) => {
  res.redirect('/donor/history');
});

// ── History ───────────────────────────────────────────────────────────────
router.get('/history', requireDonor, async (req, res) => {
  try {
    const { status, search } = req.query;
    const filter = { donorEmail: req.session.user.email };
    if (status && status !== 'all') filter.status = status;
    if (search) filter.name = { $regex: search, $options: 'i' };
    const donations = await Food.find(filter).sort({ createdAt: -1 });
    res.render('donor/history', { user: req.session.user, donations, query: req.query });
  } catch (err) {
    res.render('donor/history', { user: req.session.user, donations: [], query: {} });
  }
});

// ── Track donation ────────────────────────────────────────────────────────
router.get('/track/:id', requireDonor, async (req, res) => {
  try {
    const food = await Food.findById(req.params.id);
    if (!food || food.donorEmail !== req.session.user.email) return res.redirect('/donor/history');
    res.render('donor/track', { user: req.session.user, food });
  } catch (err) { res.redirect('/donor/history'); }
});

// ── Add note from donor ───────────────────────────────────────────────────
router.post('/note/:id', requireDonor, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) return res.redirect('back');
    const food = await Food.findById(req.params.id);
    if (!food || food.donorEmail !== req.session.user.email) return res.redirect('/donor/history');
    food.notes.push({ author: req.session.user.name, role: 'donor', message: message.trim() });
    await food.save();
    if (food.ngoEmail) {
      await createNotification({ userEmail: food.ngoEmail, type: 'note',
        title: '💬 New Note from Donor',
        message: `${req.session.user.name} left a note on "${food.name}": "${message.trim().substring(0,80)}"`,
        foodId: food._id, foodName: food.name });
    }
    res.redirect('back');
  } catch (err) { res.redirect('/donor/history'); }
});

// ── Rate NGO (after delivery) ─────────────────────────────────────────────
router.post('/rate/:id', requireDonor, async (req, res) => {
  try {
    const { stars, comment } = req.body;
    const food = await Food.findById(req.params.id);
    if (!food || food.donorEmail !== req.session.user.email || food.status !== 'delivered') return res.redirect('/donor/history');
    const already = food.ratings.some(r => r.byEmail === req.session.user.email && r.byRole === 'donor');
    if (!already) {
      food.ratings.push({ byEmail: req.session.user.email, byName: req.session.user.name,
        byRole: 'donor', stars: parseInt(stars) || 5, comment: comment || '' });
      await food.save();
      if (food.ngoEmail) {
        await createNotification({ userEmail: food.ngoEmail, type: 'rating',
          title: '⭐ New Rating Received!',
          message: `${req.session.user.name} rated your delivery of "${food.name}" ${stars} star(s). ${comment ? '"'+comment+'"' : ''}`,
          foodId: food._id, foodName: food.name });
      }
    }
    res.redirect('/donor/history');
  } catch (err) { res.redirect('/donor/history'); }
});

// ── Impact page ───────────────────────────────────────────────────────────
router.get('/impact', requireDonor, async (req, res) => {
  try {
    const donations = await Food.find({ donorEmail: req.session.user.email });
    const delivered = donations.filter(d => d.status === 'delivered');
    const totalServings    = donations.reduce((s, d) => s + (d.servings || 0), 0);
    const livesImpacted    = totalServings * 3;
    const co2Saved         = (delivered.length * 2.5).toFixed(1);
    const avgDelivery      = delivered.length > 0 ? (delivered.reduce((s, d) => {
      if (d.acceptedAt && d.deliveredAt) return s + (d.deliveredAt - d.acceptedAt);
      return s;
    }, 0) / delivered.length / 3600000).toFixed(1) : null;

    // Monthly breakdown
    const monthlyMap = {};
    donations.forEach(d => {
      const key = d.createdAt.toISOString().substring(0,7);
      monthlyMap[key] = (monthlyMap[key] || 0) + 1;
    });
    const monthly = Object.entries(monthlyMap).sort().slice(-6)
      .map(([k,v]) => ({ label: k, count: v }));

    // My ratings received
    const myRatingsReceived = [];
    donations.forEach(d => d.ratings.filter(r => r.byRole === 'ngo').forEach(r => myRatingsReceived.push({ food: d.name, ...r.toObject() })));

    res.render('donor/impact', { user: req.session.user, donations, delivered, totalServings, livesImpacted, co2Saved, avgDelivery, monthly, myRatingsReceived });
  } catch (err) { res.render('donor/impact', { user: req.session.user, donations: [], delivered: [], totalServings: 0, livesImpacted: 0, co2Saved: 0, avgDelivery: null, monthly: [], myRatingsReceived: [] }); }
});

// ── Suggest a needy location ──────────────────────────────────────────────
router.post('/suggest-location', requireDonor, async (req, res) => {
  try {
    const NeedyLocation = require('../models/NeedyLocation');
    const { name, address, category, description, contactName, contactPhone, latitude, longitude } = req.body;
    if (!name || !address) return res.json({ success: false, message: 'Name and address are required.' });
    await NeedyLocation.create({
      name: name.trim(), address: address.trim(),
      category: category || 'other',
      description: description ? description.trim() : '',
      contactName: contactName ? contactName.trim() : '',
      contactPhone: contactPhone ? contactPhone.trim() : '',
      latitude:  parseFloat(latitude)  || null,
      longitude: parseFloat(longitude) || null,
      addedBy:     req.session.user.email,
      addedByName: req.session.user.name,
      addedByRole: 'donor',
      status:   'pending',
      isActive: false   // Admin must approve before it shows to others
    });
    res.json({ success: true, message: 'Thank you! Your suggestion has been sent to admin for review.' });
  } catch (err) {
    res.json({ success: false, message: 'Could not save suggestion. Try again.' });
  }
});

module.exports = router;
