const express        = require('express');
const router         = express.Router();
const User           = require('../models/User');
const Food           = require('../models/Food');
const NeedyLocation  = require('../models/NeedyLocation');
const bcrypt         = require('bcryptjs');
const { requireAdmin } = require('../middleware/auth');

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD  –  live stats
// ══════════════════════════════════════════════════════════════════════════════
router.get('/dashboard', requireAdmin, async (req, res) => {
  try {
    const [
      totalDonors, totalNGOs,
      totalDonations, pendingDonations, acceptedDonations,
      deliveredDonations, rejectedDonations,
      recentDonations, recentUsers
    ] = await Promise.all([
      User.countDocuments({ role: 'donor' }),
      User.countDocuments({ role: 'ngo' }),
      Food.countDocuments(),
      Food.countDocuments({ status: 'pending' }),
      Food.countDocuments({ status: { $in: ['accepted','picked_up'] } }),
      Food.countDocuments({ status: 'delivered' }),
      Food.countDocuments({ status: 'rejected' }),
      Food.find().sort({ createdAt: -1 }).limit(8).select('name donorName ngoName status createdAt quantity'),
      User.find().sort({ createdAt: -1 }).limit(6).select('name email role createdAt isBanned')
    ]);

    // Monthly donations for chart (last 6 months)
    const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    const monthlyRaw = await Food.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const monthlyChart = monthlyRaw.map(m => ({ label: monthNames[m._id.month - 1] + ' ' + m._id.year, count: m.count }));

    res.render('admin/dashboard', {
      user: req.session.user,
      stats: { totalDonors, totalNGOs, totalDonations, pendingDonations, acceptedDonations, deliveredDonations, rejectedDonations },
      recentDonations, recentUsers, monthlyChart
    });
  } catch (err) {
    console.error(err);
    res.render('admin/dashboard', { user: req.session.user, stats: {}, recentDonations: [], recentUsers: [], monthlyChart: [] });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// USERS  –  list, search, filter, ban, unban, delete, edit role
// ══════════════════════════════════════════════════════════════════════════════
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const { role, search, status, page = 1 } = req.query;
    const limit = 15, skip = (page - 1) * limit;
    const filter = { role: { $ne: 'admin' } };
    if (role && ['donor','ngo'].includes(role))  filter.role = role;
    if (status === 'banned')   filter.isBanned = true;
    if (status === 'active')   filter.isBanned = false;
    if (search) filter.$or = [
      { name:  { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(filter)
    ]);
    res.render('admin/users', { user: req.session.user, users, total, page: +page, limit, query: req.query });
  } catch (err) {
    res.render('admin/users', { user: req.session.user, users: [], total: 0, page: 1, limit: 15, query: {} });
  }
});

// View single user detail
router.get('/users/:id', requireAdmin, async (req, res) => {
  try {
    const profile = await User.findById(req.params.id);
    if (!profile) return res.redirect('/admin/users');
    const donations = profile.role === 'donor'
      ? await Food.find({ donorEmail: profile.email }).sort({ createdAt: -1 }).limit(20)
      : await Food.find({ ngoEmail:   profile.email }).sort({ createdAt: -1 }).limit(20);
    res.render('admin/user-detail', { user: req.session.user, profile, donations, msg: req.query.msg || null });
  } catch (err) { res.redirect('/admin/users'); }
});

// Ban user
router.post('/users/:id/ban', requireAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    await User.findByIdAndUpdate(req.params.id, { isBanned: true, banReason: reason || '' });
    res.redirect('/admin/users');
  } catch (err) { res.redirect('/admin/users'); }
});

// Unban user
router.post('/users/:id/unban', requireAdmin, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { isBanned: false, banReason: '' });
    res.redirect('/admin/users');
  } catch (err) { res.redirect('/admin/users'); }
});

// Delete user
router.post('/users/:id/delete', requireAdmin, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.redirect('/admin/users');
  } catch (err) { res.redirect('/admin/users'); }
});

// Edit user (name, phone, org, role)
router.post('/users/:id/edit', requireAdmin, async (req, res) => {
  try {
    const { name, phone, organization, address } = req.body;
    await User.findByIdAndUpdate(req.params.id, { name, phone, organization, address });
    res.redirect('/admin/users/' + req.params.id);
  } catch (err) { res.redirect('/admin/users'); }
});

// Reset password
router.post('/users/:id/reset-password', requireAdmin, async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) return res.redirect('/admin/users/' + req.params.id);
    const hashed = await bcrypt.hash(newPassword, 12);
    await User.findByIdAndUpdate(req.params.id, { password: hashed });
    res.redirect('/admin/users/' + req.params.id + '?msg=Password+reset+successfully');
  } catch (err) { res.redirect('/admin/users'); }
});

// ══════════════════════════════════════════════════════════════════════════════
// DONATIONS  –  list, filter, view, force-status, delete
// ══════════════════════════════════════════════════════════════════════════════
router.get('/donations', requireAdmin, async (req, res) => {
  try {
    const { status, search, page = 1 } = req.query;
    const limit = 15, skip = (page - 1) * limit;
    const filter = {};
    if (status && ['pending','accepted','picked_up','delivered','rejected'].includes(status)) filter.status = status;
    if (search) filter.$or = [
      { name:      { $regex: search, $options: 'i' } },
      { donorName: { $regex: search, $options: 'i' } },
      { ngoName:   { $regex: search, $options: 'i' } }
    ];
    const [donations, total] = await Promise.all([
      Food.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Food.countDocuments(filter)
    ]);
    res.render('admin/donations', { user: req.session.user, donations, total, page: +page, limit, query: req.query });
  } catch (err) {
    res.render('admin/donations', { user: req.session.user, donations: [], total: 0, page: 1, limit: 15, query: {} });
  }
});

// View single donation
router.get('/donations/:id', requireAdmin, async (req, res) => {
  try {
    const donation = await Food.findById(req.params.id);
    if (!donation) return res.redirect('/admin/donations');
    const donor = await User.findOne({ email: donation.donorEmail }).select('name email phone address createdAt');
    const ngo   = donation.ngoEmail ? await User.findOne({ email: donation.ngoEmail }).select('name email phone organization') : null;
    res.render('admin/donation-detail', { user: req.session.user, donation, donor, ngo });
  } catch (err) { res.redirect('/admin/donations'); }
});

// Force update donation status
router.post('/donations/:id/status', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const update = { status };
    if (status === 'delivered') update.deliveredAt = new Date();
    if (status === 'picked_up') update.pickedUpAt  = new Date();
    await Food.findByIdAndUpdate(req.params.id, update);
    res.redirect('/admin/donations/' + req.params.id);
  } catch (err) { res.redirect('/admin/donations'); }
});

// Delete donation
router.post('/donations/:id/delete', requireAdmin, async (req, res) => {
  try {
    await Food.findByIdAndDelete(req.params.id);
    res.redirect('/admin/donations');
  } catch (err) { res.redirect('/admin/donations'); }
});

// ══════════════════════════════════════════════════════════════════════════════
// ANALYTICS
// ══════════════════════════════════════════════════════════════════════════════
router.get('/analytics', requireAdmin, async (req, res) => {
  try {
    // Status breakdown
    const statusBreakdown = await Food.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Top donors (by donation count)
    const topDonors = await Food.aggregate([
      { $group: { _id: '$donorEmail', name: { $first: '$donorName' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } }, { $limit: 8 }
    ]);

    // Top NGOs (by delivered count)
    const topNGOs = await Food.aggregate([
      { $match: { status: 'delivered' } },
      { $group: { _id: '$ngoEmail', name: { $first: '$ngoName' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } }, { $limit: 8 }
    ]);

    // Daily donations last 30 days
    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    const dailyRaw = await Food.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    // Avg delivery time (accepted → delivered)
    const deliveryTimes = await Food.aggregate([
      { $match: { status: 'delivered', acceptedAt: { $exists: true }, deliveredAt: { $exists: true } } },
      { $project: { diffHours: { $divide: [{ $subtract: ['$deliveredAt','$acceptedAt'] }, 3600000] } } },
      { $group: { _id: null, avg: { $avg: '$diffHours' } } }
    ]);
    const avgDeliveryHrs = deliveryTimes[0] ? deliveryTimes[0].avg.toFixed(1) : 'N/A';

    // Registration trend last 30 days
    const regRaw = await User.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo }, role: { $ne: 'admin' } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    res.render('admin/analytics', {
      user: req.session.user,
      statusBreakdown, topDonors, topNGOs, dailyRaw, regRaw, avgDeliveryHrs
    });
  } catch (err) {
    res.render('admin/analytics', { user: req.session.user, statusBreakdown:[], topDonors:[], topNGOs:[], dailyRaw:[], regRaw:[], avgDeliveryHrs:'N/A' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// SETTINGS  –  change admin password, create new admin
// ══════════════════════════════════════════════════════════════════════════════
router.get('/settings', requireAdmin, async (req, res) => {
  const admins = await User.find({ role: 'admin' }).select('name email createdAt');
  res.render('admin/settings', { user: req.session.user, admins, msg: req.query.msg || null, err: req.query.err || null });
});

router.post('/settings/change-password', requireAdmin, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmNew } = req.body;
    if (newPassword !== confirmNew) return res.redirect('/admin/settings?err=New+passwords+do+not+match');
    if (newPassword.length < 6)     return res.redirect('/admin/settings?err=Password+must+be+at+least+6+chars');
    const admin = await User.findById(req.session.user.id);
    if (!(await admin.comparePassword(currentPassword))) return res.redirect('/admin/settings?err=Current+password+is+incorrect');
    admin.password = newPassword;
    await admin.save();
    res.redirect('/admin/settings?msg=Password+changed+successfully');
  } catch (err) { res.redirect('/admin/settings?err=Failed+to+change+password'); }
});

router.post('/settings/create-admin', requireAdmin, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (await User.findOne({ email })) return res.redirect('/admin/settings?err=Email+already+registered');
    await new User({ name, email, password, role: 'admin' }).save();
    res.redirect('/admin/settings?msg=New+admin+created+successfully');
  } catch (err) { res.redirect('/admin/settings?err=Failed+to+create+admin'); }
});



// ══════════════════════════════════════════════════════════════════════════════
// CSV EXPORT
// ══════════════════════════════════════════════════════════════════════════════
router.get('/export/donations', requireAdmin, async (req, res) => {
  try {
    const donations = await Food.find().sort({ createdAt: -1 }).lean();
    const headers = ['ID','Food Name','Quantity','Category','Status','Donor Name','Donor Email','Donor Phone','NGO Name','NGO Email','Pickup Location','Delivery Location','Created At','Delivered At'];
    const rows = donations.map(d => [
      d._id, d.name, d.quantity, d.category || '', d.status,
      d.donorName || '', d.donorEmail, d.donorPhone || '',
      d.ngoName || '', d.ngoEmail || '',
      (d.pickupLocation || '').replace(/,/g,' '),
      (d.deliveryLocation || d.ngoDeliveryLocation || '').replace(/,/g,' '),
      d.createdAt ? new Date(d.createdAt).toISOString() : '',
      d.deliveredAt ? new Date(d.deliveredAt).toISOString() : ''
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    res.setHeader('Content-Type','text/csv');
    res.setHeader('Content-Disposition','attachment; filename="donations.csv"');
    res.send(csv);
  } catch (err) { res.redirect('/admin/donations'); }
});

router.get('/export/users', requireAdmin, async (req, res) => {
  try {
    const users = await User.find({ role: { $ne: 'admin' } }).sort({ createdAt: -1 }).lean();
    const headers = ['ID','Name','Email','Role','Phone','Organization','Address','Banned','Joined'];
    const rows = users.map(u => [
      u._id, u.name, u.email, u.role, u.phone || '', u.organization || '',
      (u.address || '').replace(/,/g,' '), u.isBanned ? 'Yes' : 'No',
      u.createdAt ? new Date(u.createdAt).toISOString() : ''
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    res.setHeader('Content-Type','text/csv');
    res.setHeader('Content-Disposition','attachment; filename="users.csv"');
    res.send(csv);
  } catch (err) { res.redirect('/admin/users'); }
});

// ══════════════════════════════════════════════════════════════════════════════
// NEEDY LOCATIONS  –  admin manages, donors/NGOs can browse
// ══════════════════════════════════════════════════════════════════════════════

// List all needy locations
router.get('/needy-locations', requireAdmin, async (req, res) => {
  try {
    const { search, category } = req.query;
    const filter = {};
    if (category && category !== 'all') filter.category = category;
    if (search) filter.$or = [
      { name:    { $regex: search, $options: 'i' } },
      { address: { $regex: search, $options: 'i' } }
    ];
    const locations = await NeedyLocation.find(filter).sort({ createdAt: -1 });
    res.render('admin/needy-locations', {
      user: req.session.user, locations, query: req.query,
      pageTitle: 'Needy Locations', currentPage: 'needy'
    });
  } catch (err) {
    res.render('admin/needy-locations', {
      user: req.session.user, locations: [], query: {},
      pageTitle: 'Needy Locations', currentPage: 'needy'
    });
  }
});

// Add needy location page
router.get('/needy-locations/add', requireAdmin, (req, res) => {
  res.render('admin/needy-location-form', {
    user: req.session.user, location: null, error: null,
    pageTitle: 'Add Needy Location', currentPage: 'needy'
  });
});

// Submit new needy location
router.post('/needy-locations/add', requireAdmin, async (req, res) => {
  try {
    const { name, address, latitude, longitude, category, description, contactName, contactPhone } = req.body;
    if (!name || !address) {
      return res.render('admin/needy-location-form', {
        user: req.session.user, location: req.body, error: 'Name and address are required.',
        pageTitle: 'Add Needy Location', currentPage: 'needy'
      });
    }
    await NeedyLocation.create({
      name, address,
      latitude:  parseFloat(latitude)  || null,
      longitude: parseFloat(longitude) || null,
      category:  category || 'other',
      description, contactName, contactPhone,
      addedBy: req.session.user.email
    });
    res.redirect('/admin/needy-locations?msg=Location+added+successfully');
  } catch (err) {
    res.render('admin/needy-location-form', {
      user: req.session.user, location: req.body, error: 'Failed to add location.',
      pageTitle: 'Add Needy Location', currentPage: 'needy'
    });
  }
});

// Edit needy location page
router.get('/needy-locations/:id/edit', requireAdmin, async (req, res) => {
  try {
    const location = await NeedyLocation.findById(req.params.id);
    if (!location) return res.redirect('/admin/needy-locations');
    res.render('admin/needy-location-form', {
      user: req.session.user, location, error: null,
      pageTitle: 'Edit Needy Location', currentPage: 'needy'
    });
  } catch (err) { res.redirect('/admin/needy-locations'); }
});

// Update needy location
router.post('/needy-locations/:id/edit', requireAdmin, async (req, res) => {
  try {
    const { name, address, latitude, longitude, category, description, contactName, contactPhone, isActive } = req.body;
    await NeedyLocation.findByIdAndUpdate(req.params.id, {
      name, address,
      latitude:  parseFloat(latitude)  || null,
      longitude: parseFloat(longitude) || null,
      category:  category || 'other',
      description, contactName, contactPhone,
      isActive: isActive === 'on',
      updatedAt: new Date()
    });
    res.redirect('/admin/needy-locations?msg=Location+updated');
  } catch (err) { res.redirect('/admin/needy-locations'); }
});

// Toggle active/inactive
router.post('/needy-locations/:id/toggle', requireAdmin, async (req, res) => {
  try {
    const loc = await NeedyLocation.findById(req.params.id);
    await NeedyLocation.findByIdAndUpdate(req.params.id, { isActive: !loc.isActive });
    res.redirect('/admin/needy-locations');
  } catch (err) { res.redirect('/admin/needy-locations'); }
});

// Delete needy location
router.post('/needy-locations/:id/delete', requireAdmin, async (req, res) => {
  try {
    await NeedyLocation.findByIdAndDelete(req.params.id);
    res.redirect('/admin/needy-locations');
  } catch (err) { res.redirect('/admin/needy-locations'); }
});
module.exports = router;