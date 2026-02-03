/**
 * Vector Search Service
 * 
 * Finds similar documents/chunks using embeddings.
 */

const { Document } = require('../../models/insightops');
const { getEmbedding, calculateSimilarity } = require('../../utils/insightops/vectorUtils');

/**
 * Search for similar documents
 * @param {string} query - Search query
 * @param {string} workspaceId - Workspace to search in
 * @param {number} topK - Number of results to return
 * @returns {Promise<Array>} Similar documents with scores
 */
async function searchDocuments(query, workspaceId, topK = 5) {
    // Get query embedding
    const queryEmbedding = await getEmbedding(query);

    // Optimization: Fetch only embeddings first to save memory
    const documents = await Document.findAll({
        where: { workspaceId },
        attributes: ['id', 'title', 'type', 'embedding', 'updatedAt'], // Exclude content
    });

    if (documents.length === 0) {
        return [];
    }

    // Calculate similarity scores
    const scored = documents
        .filter(doc => doc.embedding)
        .map(doc => {
            const similarity = calculateSimilarity(queryEmbedding, doc.embedding);
            return {
                documentId: doc.id,
                title: doc.title,
                type: doc.type,
                similarity,
                updatedAt: doc.updatedAt,
            };
        });

    // Sort by similarity and take top K
    const topMatches = scored
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK)
        .filter(doc => doc.similarity > 0.1);

    if (topMatches.length === 0) {
        return [];
    }

    // Fetch full content ONLY for the winners
    const topIds = topMatches.map(d => d.documentId);
    const contentDocs = await Document.findAll({
        where: { id: topIds },
        attributes: ['id', 'content']
    });

    // Merge content back into results
    return topMatches.map(match => {
        const docWithContent = contentDocs.find(d => d.id === match.documentId);
        return {
            ...match,
            excerpt: docWithContent ? (docWithContent.content.substring(0, 300) + '...') : '',
        };
    });
}

/**
 * Find most relevant content for a question
 * @param {string} question - User question
 * @param {string} workspaceId - Workspace ID
 * @returns {Promise<Object>} Relevant context and sources
 */
async function findRelevantContext(question, workspaceId) {
    const documents = await searchDocuments(question, workspaceId, 5);

    if (documents.length === 0) {
        return {
            context: '',
            sources: [],
        };
    }

    // Build context from top documents
    const context = documents
        .map((doc, i) => `[Source ${i + 1}: ${doc.title}]\n${doc.excerpt}`)
        .join('\n\n');

    return {
        context,
        sources: documents.map(doc => ({
            documentId: doc.documentId,
            title: doc.title,
            type: doc.type,
            similarity: Math.round(doc.similarity * 100) / 100,
            updatedAt: doc.updatedAt,
        })),
    };
}

module.exports = {
    searchDocuments,
    findRelevantContext,
};
