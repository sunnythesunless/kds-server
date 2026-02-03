/**
 * Chat History Cleanup Job
 * 
 * Automatically deletes chat history older than 20 minutes.
 * Runs every 5 minutes.
 */

const { ChatHistory } = require('../models/insightops');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

// Cleanup interval in minutes
const CHAT_EXPIRY_MINUTES = 20;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Run every 5 minutes

let cleanupInterval = null;

/**
 * Delete chat history older than CHAT_EXPIRY_MINUTES
 */
async function cleanupOldChats() {
    try {
        const expiryTime = new Date(Date.now() - CHAT_EXPIRY_MINUTES * 60 * 1000);

        const deleted = await ChatHistory.destroy({
            where: {
                createdAt: {
                    [Op.lt]: expiryTime
                }
            }
        });

        if (deleted > 0) {
            logger.info(`🧹 Chat Cleanup: Deleted ${deleted} messages older than ${CHAT_EXPIRY_MINUTES} minutes`);
        }
    } catch (error) {
        logger.error('Chat cleanup error:', error.message);
    }
}

/**
 * Start the cleanup scheduler
 */
function startChatCleanup() {
    // Run immediately on startup
    cleanupOldChats();

    // Then run every 5 minutes
    cleanupInterval = setInterval(cleanupOldChats, CLEANUP_INTERVAL_MS);

    logger.info(`🕐 Chat cleanup scheduled: Every 5 minutes (messages expire after ${CHAT_EXPIRY_MINUTES} minutes)`);
}

/**
 * Stop the cleanup scheduler
 */
function stopChatCleanup() {
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
    }
}

module.exports = {
    startChatCleanup,
    stopChatCleanup,
    cleanupOldChats,
    CHAT_EXPIRY_MINUTES
};
