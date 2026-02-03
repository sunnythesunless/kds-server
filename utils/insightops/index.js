/**
 * InsightOps Utilities Index
 */

const textAnalysis = require('./textAnalysis');
const vectorUtils = require('./vectorUtils');

module.exports = {
    ...textAnalysis,
    ...vectorUtils,
};
