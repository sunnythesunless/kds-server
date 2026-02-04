/**
 * Decay Analysis API Routes
 * 
 * Endpoints for analyzing document decay and retrieving reports.
 * All routes are protected by JWT authentication.
 */

const express = require('express');
const router = express.Router();
const { Document, DocumentVersion, DecayAnalysis } = require('../models/insightops');
const { analyzeDocument, batchAnalyze } = require('../services/insightops/decayEngine');
const asyncHandler = require('../middleware/asyncHandler');
const ApiError = require('../utils/ApiError');

/**
 * POST /api/decay/analyze
 * Analyze a single document for decay
 */
router.post('/analyze', asyncHandler(async (req, res) => {
    const { documentId, includeRelated = true } = req.body;

    if (!documentId) {
        throw new ApiError(400, 'documentId is required');
    }

    // Fetch document with versions
    const document = await Document.findByPk(documentId, {
        include: [{
            model: DocumentVersion,
            as: 'versions',
            order: [['versionNumber', 'DESC']],
        }],
    });

    if (!document) {
        throw new ApiError(404, 'Document not found');
    }

    // Fetch related documents from same workspace
    let allDocs = [];
    if (includeRelated) {
        allDocs = await Document.findAll({
            where: { workspaceId: document.workspaceId },
            attributes: ['id', 'title', 'type', 'content', 'embedding', 'updatedAt'],
        });
    }

    // Run analysis
    const result = await analyzeDocument({
        document: document.toJSON(),
        versions: document.versions.map(v => v.toJSON()),
        allDocs: allDocs.map(d => d.toJSON()),
    });

    // Store analysis result
    const analysisBy = req.user?.email || 'system';
    const analysis = await DecayAnalysis.create({
        documentId: document.id,
        decayDetected: result.decay_detected,
        confidenceScore: result.confidence_score,
        riskLevel: result.risk_level,
        decayReasons: result.decay_reasons,
        whatChangedSummary: result.what_changed_summary,
        updateRecommendations: result.update_recommendations,
        citations: result.citations,
        confidenceBreakdown: result._internal.confidence_breakdown,
        analyzedAt: new Date(),
        analyzedBy: analysisBy,
    });

    // Return result in required format (no internal fields)
    res.json({
        analysisId: analysis.id,
        documentId: document.id,
        documentTitle: document.title,
        decay_detected: result.decay_detected,
        confidence_score: result.confidence_score,
        risk_level: result.risk_level,
        decay_reasons: result.decay_reasons,
        what_changed_summary: result.what_changed_summary,
        update_recommendations: result.update_recommendations,
        citations: result.citations,
    });
}));

/**
 * POST /api/decay/batch
 * Batch analyze multiple documents
 */
router.post('/batch', asyncHandler(async (req, res) => {
    // Handle empty body gracefully
    const body = req.body || {};
    const { workspaceId, documentIds, limit = 50 } = body;

    // Fetch documents
    let documents;
    if (documentIds && documentIds.length > 0) {
        // Analyze specific documents
        documents = await Document.findAll({
            where: { id: documentIds },
            include: [{
                model: DocumentVersion,
                as: 'versions',
                order: [['versionNumber', 'DESC']],
            }],
            limit: parseInt(limit, 10),
        });
    } else if (workspaceId) {
        // Analyze documents in specific workspace
        documents = await Document.findAll({
            where: { workspaceId },
            include: [{
                model: DocumentVersion,
                as: 'versions',
                order: [['versionNumber', 'DESC']],
            }],
            limit: parseInt(limit, 10),
        });
    } else {
        // Analyze ALL documents (no filter)
        documents = await Document.findAll({
            include: [{
                model: DocumentVersion,
                as: 'versions',
                order: [['versionNumber', 'DESC']],
            }],
            limit: parseInt(limit, 10),
        });
    }

    if (documents.length === 0) {
        return res.json({ results: [], message: 'No documents found' });
    }

    // Get all docs for cross-reference
    const allDocs = await Document.findAll({
        where: { workspaceId: documents[0].workspaceId },
        attributes: ['id', 'title', 'type', 'content', 'embedding', 'updatedAt'],
    });

    // Run batch analysis
    const results = await batchAnalyze(
        documents.map(d => ({ ...d.toJSON(), versions: d.versions.map(v => v.toJSON()) })),
        allDocs.map(d => d.toJSON())
    );

    // Store each result
    const analysisBy = req.user?.email || 'system';
    for (const result of results) {
        if (!result.error) {
            await DecayAnalysis.create({
                documentId: result.documentId,
                decayDetected: result.decay_detected,
                confidenceScore: result.confidence_score,
                riskLevel: result.risk_level,
                decayReasons: result.decay_reasons,
                whatChangedSummary: result.what_changed_summary,
                updateRecommendations: result.update_recommendations,
                citations: result.citations,
                confidenceBreakdown: result._internal?.confidence_breakdown,
                analyzedAt: new Date(),
                analyzedBy: analysisBy,
            });
        }
    }

    // Return results without internal fields
    res.json({
        analyzed: results.length,
        decayDetected: results.filter(r => r.decay_detected).length,
        results: results.map(r => ({
            documentId: r.documentId,
            documentTitle: r.documentTitle,
            decay_detected: r.decay_detected,
            confidence_score: r.confidence_score,
            risk_level: r.risk_level,
            decay_reasons: r.decay_reasons,
        })),
    });
}));

/**
 * GET /api/decay/reports
 * Get all decay reports with filters
 */
router.get('/reports', asyncHandler(async (req, res) => {
    const {
        documentId,
        decayDetected,
        riskLevel,
        reviewStatus,
        limit = 50,
        offset = 0
    } = req.query;

    const where = {};
    if (documentId) where.documentId = documentId;
    if (decayDetected !== undefined) where.decayDetected = decayDetected === 'true';
    if (riskLevel) where.riskLevel = riskLevel;
    if (reviewStatus) where.reviewStatus = reviewStatus;

    const reports = await DecayAnalysis.findAndCountAll({
        where,
        include: [{
            model: Document,
            as: 'document',
            attributes: ['id', 'title', 'type', 'author', 'updatedAt'],
        }],
        order: [['analyzedAt', 'DESC']],
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
    });

    res.json({
        reports: reports.rows,
        total: reports.count,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
    });
}));

/**
 * GET /api/decay/reports/:docId
 * Get latest decay report for a specific document
 */
router.get('/reports/:docId', asyncHandler(async (req, res) => {
    const report = await DecayAnalysis.findOne({
        where: { documentId: req.params.docId },
        order: [['analyzedAt', 'DESC']],
        include: [{
            model: Document,
            as: 'document',
            attributes: ['id', 'title', 'type', 'author', 'currentVersion', 'updatedAt'],
        }],
    });

    if (!report) {
        throw new ApiError(404, 'No decay report found for this document');
    }

    res.json(report);
}));

/**
 * PUT /api/decay/reports/:id/review
 * Update review status of a decay report
 */
router.put('/reports/:id/review', asyncHandler(async (req, res) => {
    const report = await DecayAnalysis.findByPk(req.params.id);

    if (!report) {
        throw new ApiError(404, 'Decay report not found');
    }

    const { reviewStatus, reviewNotes } = req.body;
    const reviewedBy = req.user?.email || 'unknown';

    if (!['pending', 'reviewed', 'dismissed', 'actioned'].includes(reviewStatus)) {
        throw new ApiError(400, 'Invalid reviewStatus. Must be: pending, reviewed, dismissed, actioned');
    }

    await report.update({
        reviewStatus,
        reviewedBy,
        reviewNotes: reviewNotes || null,
        reviewedAt: new Date(),
    });

    res.json({
        message: 'Review status updated',
        report,
    });
}));

/**
 * GET /api/decay/summary
 * Get summary statistics for decay across workspace
 */
router.get('/summary', asyncHandler(async (req, res) => {
    const { workspaceId } = req.query;

    // Graceful fallback if database isn't connected
    let totalDocs = 0;
    try {
        const documentWhere = workspaceId ? { workspaceId } : {};
        totalDocs = await Document.count({ where: documentWhere });
    } catch (dbError) {
        console.error('Database not connected for decay summary:', dbError.message);
        // Return default empty summary instead of crashing
        return res.json({
            totalDocuments: 0,
            analyzedDocuments: 0,
            decayDetected: 0,
            byRiskLevel: { high: 0, medium: 0, low: 0 },
            byReviewStatus: { pending: 0, reviewed: 0, dismissed: 0, actioned: 0 },
            averageConfidence: 1.0,
            _dbStatus: 'disconnected'
        });
    }

    // Get latest analysis for each document
    // Get latest analysis for each document
    // Optimization: Use raw query or reduced attributes to improve performance
    const analyses = await DecayAnalysis.findAll({
        include: workspaceId ? [{
            model: Document,
            as: 'document',
            where: { workspaceId },
            attributes: [], // Don't return document data, just filter
        }] : [],
        attributes: [
            'documentId',
            'decayDetected',
            'riskLevel',
            'reviewStatus',
            'confidenceScore',
            'analyzedAt'
        ],
        order: [['analyzedAt', 'DESC']],
        raw: true, // Crucial for performance
    });

    // Deduplicate to get latest per document
    const latestByDoc = new Map();
    for (const a of analyses) {
        if (!latestByDoc.has(a.documentId)) {
            latestByDoc.set(a.documentId, a);
        }
    }

    const latest = Array.from(latestByDoc.values());
    const analyzedCount = latest.length;

    // Calculate summary - use total documents as base
    const summary = {
        totalDocuments: totalDocs,
        analyzedDocuments: analyzedCount,
        decayDetected: latest.filter(a => a.decayDetected || a.decayDetected === 1).length, // SQLite might return 1/0
        byRiskLevel: {
            high: latest.filter(a => a.riskLevel === 'high').length,
            medium: latest.filter(a => a.riskLevel === 'medium').length,
            low: analyzedCount > 0
                ? latest.filter(a => a.riskLevel === 'low').length
                : totalDocs,
        },
        byReviewStatus: {
            pending: latest.filter(a => a.reviewStatus === 'pending').length,
            reviewed: latest.filter(a => a.reviewStatus === 'reviewed').length,
            dismissed: latest.filter(a => a.reviewStatus === 'dismissed').length,
            actioned: latest.filter(a => a.reviewStatus === 'actioned').length,
        },
        averageConfidence: analyzedCount > 0
            ? Math.round((latest.reduce((sum, a) => sum + (a.confidenceScore || 0), 0) / analyzedCount) * 100) / 100
            : 1.0,
    };

    res.json(summary);
}));

module.exports = router;
