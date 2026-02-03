const { body, validationResult } = require('express-validator');

// Utility: Check validation result
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg,
      })),
    });
  }
  next();
};

// Register validation
const registerValidator = [
  body('name')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Name must be at least 2 characters'),

  body('email')
    .normalizeEmail()
    .isEmail()
    .withMessage('Please provide a valid email'),

  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/)
    .withMessage('Must contain an uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Must contain a lowercase letter')
    .matches(/[0-9]/)
    .withMessage('Must contain a number')
    .matches(/[^A-Za-z0-9]/)
    .withMessage('Must contain a special character'),
  
  validate
];

// Login validation
const loginValidator = [
  body('email')
    .normalizeEmail()
    .isEmail()
    .withMessage('Please provide a valid email'),

  body('password')
    .notEmpty()
    .withMessage('Password is required'),

  validate
];

// Forgot password
const forgotPasswordValidator = [
  body('email')
    .normalizeEmail()
    .isEmail()
    .withMessage('Please provide a valid email'),

  validate
];

// Reset password
const resetPasswordValidator = [
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters')
    .matches(/[A-Z]/)
    .withMessage('Must contain an uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Must contain a lowercase letter')
    .matches(/[0-9]/)
    .withMessage('Must contain a number')
    .matches(/[^A-Za-z0-9]/)
    .withMessage('Must contain a special character'),

  validate
];

module.exports = {
  registerValidator,
  loginValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
};