const mongoose = require('mongoose');

const needyLocationSchema = new mongoose.Schema({
  name:        { type: String, required: true },        // "XYZ Orphanage"
  address:     { type: String, required: true },        // full address
  latitude:    { type: Number },
  longitude:   { type: Number },
  category:    {
    type: String,
    enum: ['orphanage','shelter','oldage','school','hospital','community','station','other'],
    default: 'other'
  },
  description: { type: String },                        // who is served here
  contactName: { type: String },
  contactPhone:{ type: String },
  isActive:    { type: Boolean, default: true },        // admin can disable
  addedBy:     { type: String },                        // admin email
  createdAt:   { type: Date, default: Date.now },
  updatedAt:   { type: Date, default: Date.now }
});

module.exports = mongoose.model('NeedyLocation', needyLocationSchema);
