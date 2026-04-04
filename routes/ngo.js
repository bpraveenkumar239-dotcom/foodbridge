const express = require('express');
const router  = express.Router();
const Food    = require('../models/Food');
const { requireNGO } = require('../middleware/auth');
const { createNotification } = require('../utils/notify');

router.get('/dashboard', requireNGO, async (req, res) => {
  try {
    const [pending, accepted, delivered, myRatings] = await Promise.all([
      Food.countDocuments({ status: 'pending' }),
      Food.countDocuments({ status: { $in: ['accepted','picked_up'] }, ngoEmail: req.session.user.email }),
      Food.countDocuments({ status: 'delivered', ngoEmail: req.session.user.email }),
      Food.find({ ngoEmail: req.session.user.email, 'ratings.0': { $exists: true } }).select('ratings')
    ]);
    let totalStars = 0, ratingCount = 0;
    myRatings.forEach(f => f.ratings.forEach(r => { totalStars += r.stars; ratingCount++; }));
    const avgRating = ratingCount > 0 ? (totalStars / ratingCount).toFixed(1) : null;
    res.render('ngo/dashboard', { user: req.session.user, stats: { pending, accepted, delivered }, avgRating, ratingCount });
  } catch (err) {
    res.render('ngo/dashboard', { user: req.session.user, stats: { pending:0, accepted:0, delivered:0 }, avgRating: null, ratingCount: 0 });
  }
});

router.get('/requests', requireNGO, async (req, res) => {
  try {
    const pending    = await Food.find({ status: 'pending', isExpired: { $ne: true } }).sort({ createdAt: -1 });
    const myAccepted = await Food.find({ status: { $in: ['accepted','picked_up'] }, ngoEmail: req.session.user.email }).sort({ acceptedAt: -1 });
    res.render('ngo/requests', { user: req.session.user, pending, myAccepted });
  } catch (err) {
    res.render('ngo/requests', { user: req.session.user, pending: [], myAccepted: [] });
  }
});

router.get('/map', requireNGO, async (req, res) => {
  try {
    const donations = await Food.find({ status: 'pending', isExpired: { $ne: true } })
      .select('name quantity pickupLocation pickupLatitude pickupLongitude donorName category tags expiresAt createdAt _id');
    res.render('ngo/map', { user: req.session.user, donations });
  } catch (err) {
    res.render('ngo/map', { user: req.session.user, donations: [] });
  }
});

router.post('/accept/:id', requireNGO, async (req, res) => {
  try {
    const food = await Food.findByIdAndUpdate(req.params.id,
      { status: 'accepted', ngoEmail: req.session.user.email,
        ngoName: req.session.user.name || req.session.user.organization, acceptedAt: new Date() },
      { new: true });
    if (food) await createNotification({ userEmail: food.donorEmail, type: 'accepted',
      title: '✅ Donation Accepted!',
      message: `${food.ngoName} has accepted your donation: "${food.name}". They will pick it up soon.`,
      foodId: food._id, foodName: food.name });
    res.redirect('/ngo/requests');
  } catch (err) { res.redirect('/ngo/requests'); }
});

router.post('/reject/:id', requireNGO, async (req, res) => {
  try {
    const food = await Food.findByIdAndUpdate(req.params.id, { status: 'rejected' }, { new: true });
    if (food) await createNotification({ userEmail: food.donorEmail, type: 'rejected',
      title: '❌ Donation Rejected',
      message: `Your donation "${food.name}" was rejected. You can re-list it for other NGOs.`,
      foodId: food._id, foodName: food.name });
    res.redirect('/ngo/requests');
  } catch (err) { res.redirect('/ngo/requests'); }
});

router.get('/navigate/:id', requireNGO, async (req, res) => {
  try {
    const food = await Food.findById(req.params.id);
    if (!food || food.ngoEmail !== req.session.user.email) return res.redirect('/ngo/requests');
    res.render('ngo/navigate', { user: req.session.user, food });
  } catch (err) { res.redirect('/ngo/requests'); }
});

router.post('/pickup/:id', requireNGO, async (req, res) => {
  try {
    const food = await Food.findByIdAndUpdate(req.params.id,
      { status: 'picked_up', pickedUpAt: new Date() }, { new: true });
    if (food) await createNotification({ userEmail: food.donorEmail, type: 'picked_up',
      title: '🚚 Food Picked Up!',
      message: `${food.ngoName} has picked up "${food.name}" and is heading to deliver it!`,
      foodId: food._id, foodName: food.name });
    res.redirect(`/ngo/navigate/${req.params.id}`);
  } catch (err) { res.redirect('/ngo/requests'); }
});

router.post('/deliver/:id', requireNGO, async (req, res) => {
  try {
    const food = await Food.findByIdAndUpdate(req.params.id,
      { status: 'delivered', deliveredAt: new Date() }, { new: true });
    if (food) await createNotification({ userEmail: food.donorEmail, type: 'delivered',
      title: '🎉 Delivered Successfully!',
      message: `Your donation "${food.name}" has been delivered to people in need. Thank you for your generosity!`,
      foodId: food._id, foodName: food.name });
    res.redirect('/ngo/requests');
  } catch (err) { res.redirect('/ngo/requests'); }
});

router.get('/set-delivery/:id', requireNGO, async (req, res) => {
  try {
    const food = await Food.findById(req.params.id);
    if (!food || food.ngoEmail !== req.session.user.email) return res.redirect('/ngo/requests');
    res.render('ngo/set-delivery', { user: req.session.user, food });
  } catch (err) { res.redirect('/ngo/requests'); }
});

router.post('/set-delivery/:id', requireNGO, async (req, res) => {
  try {
    const { ngoDeliveryLocation, ngoDeliveryLatitude, ngoDeliveryLongitude, ngoOverrideNote } = req.body;
    const food = await Food.findById(req.params.id);
    if (!food || food.ngoEmail !== req.session.user.email) return res.redirect('/ngo/requests');
    const isOverride = !!(food.deliveryLocation); // NGO is overriding donor delivery
    await Food.findByIdAndUpdate(req.params.id, {
      ngoDeliveryLocation,
      ngoDeliveryLatitude:  parseFloat(ngoDeliveryLatitude)  || null,
      ngoDeliveryLongitude: parseFloat(ngoDeliveryLongitude) || null,
      ngoOverrideDelivery: isOverride,
      ngoOverrideNote: ngoOverrideNote || ''
    });
    if (isOverride) {
      const { createNotification } = require('../utils/notify');
      await createNotification({ userEmail: food.donorEmail, type: 'note',
        title: '📍 Delivery Location Changed by NGO',
        message: `The NGO changed your delivery location for "${food.name}". New location: ${ngoDeliveryLocation}. ${ngoOverrideNote ? 'Reason: '+ngoOverrideNote : ''}`,
        foodId: food._id, foodName: food.name });
    }
    res.redirect(`/ngo/navigate/${req.params.id}`);
  } catch (err) { res.redirect('/ngo/requests'); }
});

// Add note to a donation
router.post('/note/:id', requireNGO, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) return res.redirect('back');
    const food = await Food.findById(req.params.id);
    if (!food || food.ngoEmail !== req.session.user.email) return res.redirect('/ngo/requests');
    food.notes.push({ author: req.session.user.name, role: 'ngo', message: message.trim() });
    await food.save();
    await createNotification({ userEmail: food.donorEmail, type: 'note',
      title: '💬 New Note from NGO',
      message: `${req.session.user.name} left a note on "${food.name}": "${message.trim().substring(0,80)}"`,
      foodId: food._id, foodName: food.name });
    res.redirect('back');
  } catch (err) { res.redirect('/ngo/requests'); }
});

// Rate a donation (after delivery)
router.post('/rate/:id', requireNGO, async (req, res) => {
  try {
    const { stars, comment } = req.body;
    const food = await Food.findById(req.params.id);
    if (!food || food.ngoEmail !== req.session.user.email) return res.redirect('/ngo/requests');
    const already = food.ratings.some(r => r.byEmail === req.session.user.email && r.byRole === 'ngo');
    if (!already) {
      food.ratings.push({ byEmail: req.session.user.email, byName: req.session.user.name,
        byRole: 'ngo', stars: parseInt(stars) || 5, comment: comment || '' });
      await food.save();
    }
    res.redirect('/ngo/requests');
  } catch (err) { res.redirect('/ngo/requests'); }
});

// Leaderboard
router.get('/leaderboard', requireNGO, async (req, res) => {
  try {
    const [topDonors, topNGOs] = await Promise.all([
      Food.aggregate([
        { $group: { _id: '$donorEmail', name: { $first: '$donorName' }, count: { $sum: 1 },
            delivered: { $sum: { $cond: [{ $eq: ['$status','delivered'] }, 1, 0] } } } },
        { $sort: { delivered: -1, count: -1 } }, { $limit: 10 }
      ]),
      Food.aggregate([
        { $match: { status: 'delivered', ngoEmail: { $exists: true } } },
        { $group: { _id: '$ngoEmail', name: { $first: '$ngoName' }, count: { $sum: 1 } } },
        { $sort: { count: -1 } }, { $limit: 10 }
      ])
    ]);
    res.render('ngo/leaderboard', { user: req.session.user, topDonors, topNGOs });
  } catch (err) {
    res.render('ngo/leaderboard', { user: req.session.user, topDonors: [], topNGOs: [] });
  }
});

module.exports = router;
