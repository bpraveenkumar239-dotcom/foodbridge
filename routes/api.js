const express      = require('express');
const router       = express.Router();
const Food         = require('../models/Food');
const Notification = require('../models/Notification');
const { requireAuth, requireNGO } = require('../middleware/auth');

// NGO updates live location
router.post('/ngo/location/:foodId', requireNGO, async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const food = await Food.findOneAndUpdate(
      { _id: req.params.foodId, ngoEmail: req.session.user.email },
      { ngoLatitude: parseFloat(latitude), ngoLongitude: parseFloat(longitude), ngoLastUpdate: new Date() },
      { new: true }
    );
    if (!food) return res.json({ success: false });
    res.json({ success: true });
  } catch (err) { res.json({ success: false }); }
});

// Save geocoded coordinates
router.post('/geocode-save/:foodId', requireNGO, async (req, res) => {
  try {
    const { pickupLatitude, pickupLongitude, deliveryLatitude, deliveryLongitude } = req.body;
    const update = {};
    if (pickupLatitude   != null) update.pickupLatitude   = parseFloat(pickupLatitude);
    if (pickupLongitude  != null) update.pickupLongitude  = parseFloat(pickupLongitude);
    if (deliveryLatitude  != null) update.deliveryLatitude  = parseFloat(deliveryLatitude);
    if (deliveryLongitude != null) update.deliveryLongitude = parseFloat(deliveryLongitude);
    await Food.findByIdAndUpdate(req.params.foodId, update);
    res.json({ success: true });
  } catch (err) { res.json({ success: false }); }
});

// Donor polls tracking data
router.get('/track/:foodId', requireAuth, async (req, res) => {
  try {
    const food = await Food.findById(req.params.foodId).select(
      'name status ngoLatitude ngoLongitude ngoLastUpdate ngoName pickupLatitude pickupLongitude deliveryLatitude deliveryLongitude ngoDeliveryLatitude ngoDeliveryLongitude ngoDeliveryLocation acceptedAt pickedUpAt deliveredAt notes ratings'
    );
    if (!food) return res.json({ success: false });
    res.json({ success: true, food });
  } catch (err) { res.json({ success: false }); }
});

// Stats for dashboard
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const pending = await Food.countDocuments({ status: 'pending' });
    res.json({ pending });
  } catch (err) { res.json({ pending: 0 }); }
});

// Get unread notification count
router.get('/notifications/count', requireAuth, async (req, res) => {
  try {
    const count = await Notification.countDocuments({ userEmail: req.session.user.email, isRead: false });
    res.json({ count });
  } catch (err) { res.json({ count: 0 }); }
});

// Get all notifications
router.get('/notifications', requireAuth, async (req, res) => {
  try {
    const notifications = await Notification.find({ userEmail: req.session.user.email })
      .sort({ createdAt: -1 }).limit(30);
    res.json({ success: true, notifications });
  } catch (err) { res.json({ success: false, notifications: [] }); }
});

// Mark notifications as read
router.post('/notifications/read', requireAuth, async (req, res) => {
  try {
    await Notification.updateMany({ userEmail: req.session.user.email, isRead: false }, { isRead: true });
    res.json({ success: true });
  } catch (err) { res.json({ success: false }); }
});

// Mark single notification read
router.post('/notifications/:id/read', requireAuth, async (req, res) => {
  try {
    await Notification.findOneAndUpdate({ _id: req.params.id, userEmail: req.session.user.email }, { isRead: true });
    res.json({ success: true });
  } catch (err) { res.json({ success: false }); }
});

// Auto-expire donations (called by cron or client poll)
router.post('/expire-check', async (req, res) => {
  try {
    const now = new Date();
    const result = await Food.updateMany(
      { status: 'pending', expiresAt: { $lt: now }, isExpired: false },
      { status: 'expired', isExpired: true }
    );
    res.json({ success: true, expired: result.modifiedCount });
  } catch (err) { res.json({ success: false }); }
});

module.exports = router;

// Public: get all active needy locations (for donor delivery form + NGO set-delivery)
router.get('/needy-locations', requireAuth, async (req, res) => {
  try {
    const NeedyLocation = require('../models/NeedyLocation');
    const locations = await NeedyLocation.find({ isActive: true }).sort({ name: 1 });
    res.json({ success: true, locations });
  } catch (err) {
    res.json({ success: false, locations: [] });
  }
});
module.exports = router;
