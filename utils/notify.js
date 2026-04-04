const Notification = require('../models/Notification');

async function createNotification({ userEmail, type, title, message, foodId, foodName }) {
  try {
    await Notification.create({ userEmail, type, title, message, foodId: foodId || null, foodName: foodName || '' });
  } catch (e) {
    console.error('Notification error:', e.message);
  }
}

module.exports = { createNotification };
