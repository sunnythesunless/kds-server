/**
 * RAG Engine Service
 * 
 * Retrieval Augmented Generation for document Q&A.
 */

const { findRelevantContext } = require('./vectorSearch');

// Global Kill Switch
let AI_DISABLED_UNTIL = null;

function isAIDisabled() {
    return AI_DISABLED_UNTIL && Date.now() < AI_DISABLED_UNTIL;
}

/**
 * Get Gemini client for chat
 */
function getGeminiClient() {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error('[RAG] Error: GEMINI_API_KEY is missing from environment.');
        return null;
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // Explicitly pull from ENV or use the 2026 stable default
    const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

    console.log(`[RAG] Initializing Gemini with model: ${modelName}`);

    // Force stable v1 API version instead of v1beta to avoid 404 on retired models
    return genAI.getGenerativeModel(
        {
            model: modelName,
            generationConfig: {
                maxOutputTokens: 512,
            }
        },
        { apiVersion: 'v1' }
    );
}

/**
 * Answer a question based on workspace documents
 * @param {string} question - User question
 * @param {string} workspaceId - Workspace ID
 * @returns {Promise<Object>} Answer with sources
 */
const answerCache = new Map(); // Simple in-memory cache

async function askQuestion(question, workspaceId) {
    // 0. CHECK KILL SWITCH
    if (isAIDisabled()) {
        console.warn('[RAG] 🛑 AI Globally Disabled (Quota Cooldown)');
        // Retrieve sources to still give a "dumb" answer
        const { sources } = await findRelevantContext(question, workspaceId);
        return {
            ...generateBasicAnswer(question, sources),
            warnings: [{
                type: 'quota_exceeded',
                message: 'AI quota exceeded. Returning basic results (cooldown active).'
            }]
        };
    }

    // 1. Check Cache (Great for Demos!)
    const cacheKey = `${workspaceId}:${question.trim().toLowerCase()}`;
    if (answerCache.has(cacheKey)) {
        console.log('[RAG] ⚡ Serving answer from cache (Savings API quota)');
        return {
            ...answerCache.get(cacheKey),
            warnings: [{ type: 'cached', message: '⚡ Instant response (Cached)' }]
        };
    }

    // Find relevant context
    let { context, sources } = await findRelevantContext(question, workspaceId);

    // TRUNCATE CONTEXT (Save tokens!)
    if (context) {
        context = context.slice(0, 6000);
    }

    if (!context || sources.length === 0) {
        return {
            answer: "I couldn't find any relevant documents in your workspace to answer this question. Please upload some documents first.",
            confidence: 0,
            sources: [],
            warnings: [],
        };
    }

    // Fallback if no provider configured
    // Fallback if no provider configured
    if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY && !process.env.GROQ_API_KEY) {
        console.log('[RAG] No AI API keys configured (Groq/Gemini/OpenAI)');
        return generateBasicAnswer(question, sources);
    }

    try {
        let finalResult = null;
        let answer = '';
        let confidence = 0.5;

        // Provider 1: OpenAI (Preferred if set, usually more stable)
        if (process.env.OPENAI_API_KEY) {
            console.log('[RAG] Using OpenAI (ChatGPT) for response');
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
                    messages: [
                        { role: 'system', content: 'You are a helpful assistant. Answer based ONLY on the provided context. Return JSON: { "answer": "...", "confidence": 0.0-1.0 }' },
                        { role: 'user', content: `Context:\n${context}\n\nQuestion: ${question}` }
                    ],
                    temperature: 0.3
                })
            });

            if (!response.ok) {
                const err = await response.text();
                throw new Error(`OpenAI API Error: ${response.status} ${err}`);
            }

            const data = await response.json();
            const content = data.choices[0].message.content;

            try {
                const parsed = JSON.parse(content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
                answer = parsed.answer;
                confidence = parsed.confidence || 0.8;
            } catch (e) {
                answer = content;
            }

        }
        // Provider 2: GROQ (FREE! Uses Llama models - highly recommended)
        else if (process.env.GROQ_API_KEY) {
            console.log('[RAG] Using Groq (FREE Llama) for response');
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
                },
                body: JSON.stringify({
                    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
                    messages: [
                        { role: 'system', content: 'You are a helpful assistant. Answer based ONLY on the provided context. Return JSON: { "answer": "...", "confidence": 0.0-1.0 }' },
                        { role: 'user', content: `Context:\n${context}\n\nQuestion: ${question}` }
                    ],
                    temperature: 0.3,
                    max_tokens: 512
                })
            });

            if (!response.ok) {
                const err = await response.text();
                throw new Error(`Groq API Error: ${response.status} ${err}`);
            }

            const data = await response.json();
            const content = data.choices[0].message.content;

            try {
                const parsed = JSON.parse(content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
                answer = parsed.answer;
                confidence = parsed.confidence || 0.8;
            } catch (e) {
                answer = content;
            }

        }
        // Provider 3: Gemini (fallback)
        else if (process.env.GEMINI_API_KEY) {
            console.log('[RAG] Using Gemini AI for response');
            const model = getGeminiClient();
            if (!model) throw new Error('Gemini client failed to initialize');

            const prompt = `You are a helpful assistant that answers questions based on the provided document context.
CONTEXT:
${context}
QUESTION: ${question}
Instructions: Answer based ONLY on context. Return JSON: { "answer": "...", "confidence": 0.0-1.0 }`;

            // NO RETRIES on 429 - Fail fast
            try {
                result = await model.generateContent(prompt);
            } catch (error) {
                if (error.message?.includes('429') || error.status === 429) {
                    throw new Error('AI_QUOTA_EXCEEDED');
                }
                throw error;
            }
            if (!result) throw new Error('AI generation failed');

            const responseText = result.response.text();

            try {
                const parsed = JSON.parse(responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
                answer = parsed.answer;
                confidence = parsed.confidence || 0.5;
            } catch (e) {
                answer = responseText;
            }
        }

        // Critical Check: Ensure answer is valid
        if (!answer || answer.trim().length < 5) {
            throw new Error('AI returned empty or invalid response');
        }

        // Check for stale sources
        const warnings = [];
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        for (const source of sources) {
            if (new Date(source.updatedAt) < thirtyDaysAgo) {
                const daysOld = Math.floor((Date.now() - new Date(source.updatedAt)) / (24 * 60 * 60 * 1000));
                warnings.push({
                    type: 'stale_source',
                    message: `"${source.title}" was last updated ${daysOld} days ago`,
                    documentId: source.documentId,
                });
            }
        }

        finalResult = {
            answer: answer || "I couldn't generate an answer.",
            confidence: confidence,
            sources: sources.slice(0, 3),
            warnings,
        };

        // SAVE TO CACHE
        answerCache.set(cacheKey, finalResult);

        return finalResult;

    } catch (error) {
        if (error.message === 'AI_QUOTA_EXCEEDED' || error.message?.includes('429') || error.status === 429) {
            console.warn('[RAG] ⚠️ AI Quota Exceeded (429). ACTIVATING COOL DOWN (30m).');
            AI_DISABLED_UNTIL = Date.now() + 30 * 60 * 1000; // 30 min cooldown

            return {
                ...generateBasicAnswer(question, sources),
                warnings: [{
                    type: 'quota_exceeded',
                    message: 'AI usage limit reached. Showing basic results only.'
                }]
            };
        }
        console.error('[RAG] AI generation error:', error.message);
        // Do NOT fail silently with garbage. Return a basic answer but log error.
        return {
            ...generateBasicAnswer(question, sources),
            warnings: [{
                type: 'ai_error',
                message: 'AI service unavailable. Showing raw results.'
            }]
        };
    }
}

/**
 * Generate basic answer without AI
 */
function generateBasicAnswer(question, sources) {
    if (sources.length === 0) {
        return {
            answer: "No relevant documents found.",
            confidence: 0,
            sources: [],
            warnings: [],
        };
    }

    const topSource = sources[0];
    return {
        answer: `Based on "${topSource.title}", here's relevant information: ${topSource.excerpt || 'See the document for details.'}`,
        confidence: topSource.similarity,
        sources: sources.slice(0, 3),
        warnings: [{
            type: 'basic_mode',
            message: 'AI features not configured. Showing document excerpts only.',
        }],
    };
}

/**
 * Check if RAG is available
 */
function isRAGAvailable() {
    return !!(process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY);
}

module.exports = {
    askQuestion,
    generateBasicAnswer,
    isRAGAvailable,
};
