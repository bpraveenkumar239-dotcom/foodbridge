const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name:         { type: String, required: true },
  email:        { type: String, required: true, unique: true },
  password:     { type: String, required: true },
  role:         { type: String, enum: ['donor', 'ngo', 'admin'], required: true },
  organization: { type: String },
  phone:        { type: String },
  address:      { type: String },
  latitude:     { type: Number },
  longitude:    { type: Number },
  isActive:     { type: Boolean, default: true },   // can login
  isBanned:     { type: Boolean, default: false },  // banned by admin
  banReason:    { type: String },
  createdAt:    { type: Date, default: Date.now }
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);
