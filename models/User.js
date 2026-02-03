const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },

  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },

  password: {
    type: String,
    required: function () {
      return this.provider === 'local';
    },
  },

  provider: {
    type: String,
    enum: ['local', 'google'],
    default: 'local',
  },

  providerId: {
    type: String, // Google "sub"
  },

  isVerified: {
    type: Boolean,
    default: false,
  },

  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },

  resetPasswordToken: String,
  resetPasswordExpires: Date,
}, { timestamps: true });

// Hash password ONLY for local users
userSchema.pre('save', async function (next) {
  if (this.provider !== 'local') return next();
  if (!this.isModified('password')) return next();

  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  if (this.provider !== 'local') return false;
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
