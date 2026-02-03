/**
 * InsightOps Rate Limiters
 * 
 * Different rate limits for different endpoints:
 * - Chat/AI: More restrictive (token costs)
 * - Upload: Size + frequency caps
 * - Decay: Per-document limits
 * - Documents: Standard CRUD limits
 */

const rateLimit = require('express-rate-limit');

/**
 * Chat & RAG limiter - Most restrictive due to AI costs
 * 30 requests per minute per user
 */
const chatLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    message: {
        success: false,
        message: 'Too many chat requests. Please wait a minute before trying again.',
        retryAfter: 60,
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Upload limiter - Prevent abuse of file processing
 * 10 uploads per 5 minutes
 */
const uploadLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10,
    message: {
        success: false,
        message: 'Too many uploads. Please wait 5 minutes before uploading more files.',
        retryAfter: 300,
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Decay analysis limiter - Expensive operation
 * 20 analyses per minute
 */
const decayLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 20,
    message: {
        success: false,
        message: 'Too many decay analysis requests. Please wait before analyzing more documents.',
        retryAfter: 60,
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Document CRUD limiter - Standard limits
 * 100 requests per minute
 */
const documentLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100,
    message: {
        success: false,
        message: 'Too many document requests. Please slow down.',
        retryAfter: 60,
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Batch operations limiter - Very restrictive
 * 5 batch operations per minute
 */
const batchLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5,
    message: {
        success: false,
        message: 'Too many batch operations. Please wait before running another batch.',
        retryAfter: 60,
    },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = {
    chatLimiter,
    uploadLimiter,
    decayLimiter,
    documentLimiter,
    batchLimiter,
};
