const User = require('../models/User');
const logger = require('../utils/logger');

// @desc    Get user profile
// @route   GET /api/users/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');

    if(!user){
      return res.status(404).json({ success: false, message: 'User not found' });
    }

     res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    logger.error('Get user profile error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update profile
// @route   PUT /api/users/me
// @access  Private
exports.updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.name = req.body.name || user.name;
    if (req.body.password) {
      user.password = req.body.password;
    }

    await user.save();
    res.json({ success: true, message: 'Profile updated' });
  } catch (err) {
    logger.error('Update profile error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};