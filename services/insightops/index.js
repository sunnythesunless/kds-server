/**
 * InsightOps Services Index
 */

const decayEngine = require('./decayEngine');
const freshnessEvaluator = require('./freshnessEvaluator');
const contradictionDetector = require('./contradictionDetector');
const versionDriftAnalyzer = require('./versionDriftAnalyzer');
const confidenceScorer = require('./confidenceScorer');
const updateGenerator = require('./updateGenerator');
const documentParser = require('./documentParser');
const aiSummarizer = require('./aiSummarizer');
const documentChunker = require('./documentChunker');
const vectorSearch = require('./vectorSearch');
const ragEngine = require('./ragEngine');

module.exports = {
    // Decay analysis
    ...decayEngine,
    ...freshnessEvaluator,
    ...contradictionDetector,
    ...versionDriftAnalyzer,
    ...confidenceScorer,
    ...updateGenerator,

    // Document processing
    ...documentParser,
    ...aiSummarizer,
    ...documentChunker,

    // Search and RAG
    ...vectorSearch,
    ...ragEngine,
};
