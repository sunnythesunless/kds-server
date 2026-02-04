// Server Entry Point - Force Restart (Switching to OpenAI)
// Server Entry Point - Updated
const express = require('express');
const path = require('path');
const fs = require('fs');
const connectDB = require('./config/db');
require('dotenv').config();

const helmet = require('helmet');
const cors = require('cors');

const { rateLimiter } = require('./middleware/rateLimiter');
const {
  documentLimiter,
  decayLimiter,
  uploadLimiter,
  chatLimiter
} = require('./middleware/insightopsLimiter');
const errorHandler = require('./middleware/errorHandler');
const { protect } = require('./middleware/auth');


// Auth routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');

// InsightOps routes
const documentsRouter = require('./routes/documents.routes');
const decayRouter = require('./routes/decay.routes');
const uploadRouter = require('./routes/upload.routes');
const chatRouter = require('./routes/chat.routes');

// Database configurations
const { sequelize, testConnection } = require('./config/sequelize');

const passport = require('passport');
require('./config/passport');
const logger = require('./utils/logger');

const app = express();

// Trust proxy - REQUIRED for Render.com and other cloud hosts
// This makes Express trust X-Forwarded-* headers so OAuth callbacks use https://
app.set('trust proxy', 1);

// Initialize databases
async function initializeDatabases() {
  // Connect to MongoDB (for auth)
  await connectDB();

  // Connect to SQLite/PostgreSQL (for InsightOps)
  const sequelizeConnected = await testConnection();
  if (sequelizeConnected) {
    // Sync models (create tables if they don't exist)
    const { Document, DocumentVersion, DecayAnalysis, DocumentChunk, ChatHistory } = require('./models/insightops');

    // Ensure uploads and data directories exist
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const dataDir = path.join(process.cwd(), 'data');

    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      logger.info('📁 Created uploads directory');
    }

    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      logger.info('📁 Created data directory');
    }

    await sequelize.sync({ alter: process.env.NODE_ENV === 'development' });
    logger.info('✓ InsightOps database synced');
  }
}

initializeDatabases().then(() => {
  // Start chat cleanup job (deletes messages older than 20 minutes)
  const { startChatCleanup } = require('./jobs/chatCleanup');
  startChatCleanup();
}).catch(err => {
  logger.error('Database initialization failed:', err);
});

// Security middleware
app.use(helmet());
app.use(cors({
  origin: [process.env.CLIENT_URL, process.env.BASE_URL],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(rateLimiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(passport.initialize());

// ==================== AUTH ROUTES (Public) ====================
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

// ==================== INSIGHTOPS ROUTES (Protected) ====================
// All InsightOps routes require JWT authentication + specialized rate limits
app.use('/api/documents', protect, documentLimiter, documentsRouter);
app.use('/api/decay', protect, decayLimiter, decayRouter);
app.use('/api/upload', protect, uploadLimiter, uploadRouter);
app.use('/api/chat', protect, chatLimiter, chatRouter);

// Health check
app.get('/health', async (req, res) => {
  const sequelizeStatus = await testConnection().catch(() => false);

  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    services: {
      mongodb: 'connected',
      sequelize: sequelizeStatus ? 'connected' : 'error',
    },
    version: '1.0.0',
  });
});

// Not found handler

app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

// Error handler (must be last)
app.use(errorHandler);


const server = app.listen(process.env.PORT || 3000, () => {
  logger.info(`🚀 Server running on port ${process.env.PORT || 3000}`);
  logger.info(`📚 Auth API: /api/auth, /api/users`);
  logger.info(`📄 InsightOps API: /api/documents, /api/decay, /api/upload, /api/chat`);
});

module.exports = app;
