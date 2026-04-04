const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  author:    { type: String },
  role:      { type: String },
  message:   { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const ratingSchema = new mongoose.Schema({
  byEmail:   { type: String },
  byName:    { type: String },
  byRole:    { type: String },
  stars:     { type: Number, min: 1, max: 5 },
  comment:   { type: String },
  createdAt: { type: Date, default: Date.now }
});

const foodSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  quantity:    { type: String, required: true },
  description: { type: String },
  category:    { type: String, enum: ['cooked','raw','packaged','bakery','fruits_veg','dairy','other'], default: 'other' },
  tags:        [{ type: String }],
  servings:    { type: Number },
  expiresAt:   { type: Date },
  isExpired:   { type: Boolean, default: false },

  // Pickup
  pickupLocation:  { type: String, required: true },
  pickupLatitude:  { type: Number },
  pickupLongitude: { type: Number },

  // Donor-set delivery
  deliveryLocation:  { type: String },
  deliveryLatitude:  { type: Number },
  deliveryLongitude: { type: Number },

  // NGO delivery (either chosen when donor didn't set, OR override of donor's delivery)
  ngoDeliveryLocation:  { type: String },
  ngoDeliveryLatitude:  { type: Number },
  ngoDeliveryLongitude: { type: Number },
  ngoOverrideDelivery:  { type: Boolean, default: false }, // true = NGO changed donor's set location
  ngoOverrideNote:      { type: String },                  // reason for change

  status: {
    type: String,
    enum: ['pending','accepted','rejected','picked_up','delivered','expired'],
    default: 'pending'
  },

  donorEmail: { type: String, required: true },
  donorName:  { type: String },
  donorPhone: { type: String },

  ngoEmail:    { type: String },
  ngoName:     { type: String },
  ngoLatitude: { type: Number },
  ngoLongitude:{ type: Number },
  ngoLastUpdate: { type: Date },

  acceptedAt:  { type: Date },
  pickedUpAt:  { type: Date },
  deliveredAt: { type: Date },
  createdAt:   { type: Date, default: Date.now },

  notes:   [noteSchema],
  ratings: [ratingSchema],

  reRequestCount: { type: Number, default: 0 },
  originalId:     { type: mongoose.Schema.Types.ObjectId }
});

module.exports = mongoose.model('Food', foodSchema);
