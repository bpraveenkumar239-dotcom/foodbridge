const mongoose = require('mongoose');

const needyLocationSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  address:     { type: String, required: true },
  latitude:    { type: Number },
  longitude:   { type: Number },
  category:    {
    type: String,
    enum: ['orphanage','shelter','oldage','school','hospital','community','station','other'],
    default: 'other'
  },
  description: { type: String },
  contactName: { type: String },
  contactPhone:{ type: String },
  isActive:    { type: Boolean, default: true },        // admin can disable/approve
  addedBy:     { type: String },                        // email of who added it
  addedByName: { type: String },                        // display name
  addedByRole: { type: String, enum: ['admin','donor','ngo'], default: 'admin' },
  status:      { type: String, enum: ['pending','approved','rejected'], default: 'approved' },
  // 'approved' for admin-added, 'pending' for user suggestions
  createdAt:   { type: Date, default: Date.now },
  updatedAt:   { type: Date, default: Date.now }
});

module.exports = mongoose.model('NeedyLocation', needyLocationSchema);
