const nodemailer = require('nodemailer');
const logger = require('../utils/logger'); // Assuming you have a logger, otherwise console.log

/**
 * EMAIL SERVICE
 * Handles sending notifications for the workspace.
 * Uses a mock logger if SMTP credentials are not set.
 */

// Create transporter only if credentials exist
const transporter = process.env.SMTP_HOST ? nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
}) : null;

exports.sendDecayReport = async (to, workspaceName, decayedDocs) => {
    if (!transporter) {
        logger.info(`[MOCK EMAIL] To: ${to} | Subject: InsightOps Knowledge Decay Report`);
        logger.info(`Body: ${decayedDocs.length} documents have decayed in ${workspaceName}.`);
        return;
    }

    const html = `
    <h2>⚠️ InsightOps Warning: Knowledge Decay Detected</h2>
    <p>The following documents in <strong>${workspaceName}</strong> have expired or become outdated:</p>
    <ul>
      ${decayedDocs.map(doc => `<li><strong>${doc.docName}</strong> (v${doc.version}) - Expired on ${new Date(doc.expiresAt).toDateString()}</li>`).join('')}
    </ul>
    <p>Please review and update these documents to maintain the Single Source of Truth.</p>
    <br>
    <p><em>Use the InsightOps Dashboard to upload new versions.</em></p>
  `;

    try {
        await transporter.sendMail({
            from: '"InsightOps System" <system@insightops.internal>',
            to,
            subject: `⚠️ Action Required: ${decayedDocs.length} Documents Decayed`,
            html,
        });
        logger.info(`Decay report sent to ${to}`);
    } catch (error) {
        logger.error("Failed to send email:", error);
    }
};
