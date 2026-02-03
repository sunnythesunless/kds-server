const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/auth');
const { getMe, updateProfile } = require('../controllers/user.controller');

router.get('/me', protect, getMe);
router.put('/me', protect, updateProfile);

module.exports = router;



