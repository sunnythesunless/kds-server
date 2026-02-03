const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    logger.warn('🔐 No token provided');
    return res.status(401).json({ success: false, message: 'Not authorized, no token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      logger.warn(`⏳ Token expired for token ending in ...${token.slice(-6)}`);
      return res.status(401).json({ success: false, message: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    if (err.name === 'JsonWebTokenError') {
      logger.error(`❌ Invalid token signature: ${err.message}`);
      return res.status(401).json({ success: false, message: 'Token invalid', code: 'TOKEN_INVALID' });
    }
    logger.error('Token verification failed:', err.message);
    return res.status(401).json({ success: false, message: 'Not authorized', code: 'AUTH_FAILED' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user?.role === 'admin') return next();
  return res.status(403).json({ success: false, message: 'Admin access required' });
};

const verifyWorkspace = async (req, res, next) => {
  try {
    const workspaceId = req.body?.workspaceId || req.query?.workspaceId || req.headers['x-workspace-id'];

    if (!workspaceId) {
      return res.status(400).json({
        success: false,
        message: 'Workspace ID is required'
      });
    }

    const Workspace = require('../models/Workspace');
    const workspace = await Workspace.findById(workspaceId);

    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace not found' });
    }

    // RBAC CHECK
    const memberRecord = workspace.members.find(
      m => m.user.toString() === req.user._id.toString()
    );

    if (!memberRecord) {
      return res.status(403).json({ success: false, message: 'Not authorized for this workspace' });
    }

    // Attach Context
    req.workspace = workspace;
    req.workspaceRole = memberRecord.role;
    req.isWorkspaceAdmin = ['admin', 'owner'].includes(memberRecord.role);
    req.workspaceId = workspaceId; // Keep for backward compatibility

    next();
  } catch (error) {
    logger.error('Workspace verification failed:', error);
    return res.status(500).json({ success: false, message: 'Server error during authorization' });
  }
};

module.exports = { protect, adminOnly, verifyWorkspace };