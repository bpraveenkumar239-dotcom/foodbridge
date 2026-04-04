const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userEmail:  { type: String, required: true, index: true },
  type:       { type: String, enum: ['accepted','rejected','picked_up','delivered','note','rating','expiry','system'], required: true },
  title:      { type: String, required: true },
  message:    { type: String, required: true },
  foodId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Food' },
  foodName:   { type: String },
  isRead:     { type: Boolean, default: false },
  createdAt:  { type: Date, default: Date.now }
});

module.exports = mongoose.model('Notification', notificationSchema);
