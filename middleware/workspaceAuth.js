/**
 * Workspace Middleware
 * 
 * Enforces workspace ownership to prevent cross-workspace data access.
 * CRITICAL: Never trust workspaceId from client alone in multi-tenant mode.
 */

const ApiError = require('../utils/ApiError');

/**
 * Validate workspace access for routes that use workspaceId
 * Checks that the user has access to the requested workspace
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.source - Where to get workspaceId: 'body', 'query', 'params'
 * @param {boolean} options.optional - If true, allow requests without workspaceId
 */
const validateWorkspace = (options = {}) => {
    const { source = 'body', optional = false } = options;

    return async (req, res, next) => {
        try {
            // Get workspaceId from the appropriate source
            let workspaceId;
            switch (source) {
                case 'body':
                    workspaceId = req.body.workspaceId;
                    break;
                case 'query':
                    workspaceId = req.query.workspaceId;
                    break;
                case 'params':
                    workspaceId = req.params.workspaceId;
                    break;
                default:
                    workspaceId = req.body.workspaceId || req.query.workspaceId;
            }

            // If no workspaceId and it's optional, continue
            if (!workspaceId && optional) {
                return next();
            }

            // If no workspaceId and it's required
            if (!workspaceId) {
                throw new ApiError(400, 'workspaceId is required');
            }

            // Get user from JWT (populated by protect middleware)
            const user = req.user;
            if (!user) {
                throw new ApiError(401, 'Authentication required');
            }

            // Check if user has access to this workspace
            const hasAccess = await checkWorkspaceAccess(user.id, workspaceId);

            if (!hasAccess) {
                throw new ApiError(403, 'You do not have access to this workspace');
            }

            // Attach validated workspaceId to request for downstream use
            req.validatedWorkspaceId = workspaceId;
            next();
        } catch (error) {
            next(error);
        }
    };
};

/**
 * Check if user has access to workspace
 * 
 * NOTE: This implementation should be updated based on your workspace model.
 * Currently implements a permissive check for development.
 * 
 * @param {string} userId - User's ID
 * @param {string} workspaceId - Workspace ID to check
 * @returns {Promise<boolean>} Whether user has access
 */
async function checkWorkspaceAccess(userId, workspaceId) {
    // TODO: Implement proper workspace membership check
    // 
    // Options for workspace storage:
    // 1. User.workspaces array in MongoDB (user has workspaces field)
    // 2. Separate Workspace model with members
    // 3. WorkspaceMember junction table
    //
    // Example implementation:
    // const User = require('../models/User');
    // const user = await User.findById(userId);
    // return user.workspaces?.includes(workspaceId) || user.role === 'admin';

    // For now, allow access if user is authenticated
    // This should be tightened before production multi-tenant use
    if (!userId || !workspaceId) {
        return false;
    }

    // DEVELOPMENT MODE: Allow access to any workspace
    // PRODUCTION: Implement proper check above
    console.warn(`[WORKSPACE] Dev mode: allowing ${userId} access to ${workspaceId}`);
    return true;
}

/**
 * Extract workspaceId from document and validate access
 * Used when the route doesn't have workspaceId but has documentId
 */
const validateDocumentAccess = async (req, res, next) => {
    try {
        const documentId = req.params.id || req.body.documentId;

        if (!documentId) {
            return next();
        }

        const { Document } = require('../models/insightops');
        const document = await Document.findByPk(documentId, {
            attributes: ['id', 'workspaceId']
        });

        if (!document) {
            throw new ApiError(404, 'Document not found');
        }

        // Check workspace access
        const hasAccess = await checkWorkspaceAccess(req.user.id, document.workspaceId);

        if (!hasAccess) {
            throw new ApiError(403, 'You do not have access to this document');
        }

        req.validatedWorkspaceId = document.workspaceId;
        req.document = document;
        next();
    } catch (error) {
        next(error);
    }
};

module.exports = {
    validateWorkspace,
    validateDocumentAccess,
    checkWorkspaceAccess,
};
