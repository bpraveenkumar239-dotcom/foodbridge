const requireAuth = (req, res, next) => {
  if (!req.session.user) return res.redirect('/login');
  next();
};
const requireDonor = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'donor') return res.redirect('/login');
  next();
};
const requireNGO = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'ngo') return res.redirect('/login');
  next();
};
const requireAdmin = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.redirect('/login');
  next();
};
module.exports = { requireAuth, requireDonor, requireNGO, requireAdmin };
