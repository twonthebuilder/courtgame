import { fetchWithRetry } from './api';
import { API_KEY } from './config';

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent';

/**
 * Standardized error thrown by the LLM client and response parsers.
 */
export class LlmClientError extends Error {
  /**
   * Create a new LLM client error with context for debugging and UI messaging.
   *
   * @param {string} message - Developer-facing error message.
   * @param {{code?: string, userMessage?: string, cause?: Error, context?: object}} [options] - Error metadata.
   */
  constructor(message, { code, userMessage, cause, context } = {}) {
    super(message);
    this.name = 'LlmClientError';
    this.code = code;
    this.userMessage = userMessage;
    this.cause = cause;
    this.context = context;
  }
}

/**
 * Build a consistent LLM client error for downstream consumers.
 *
 * @param {string} message - Developer-facing error message.
 * @param {{code?: string, userMessage?: string, cause?: Error, context?: object}} [options] - Error metadata.
 * @returns {LlmClientError} Standardized error instance.
 */
const createLlmError = (message, options) => new LlmClientError(message, options);

/**
 * Provide a user-friendly message for LLM errors.
 *
 * @param {unknown} error - Any thrown error.
 * @param {string} fallback - Message to use when no LLM error is present.
 * @returns {string} User-facing message.
 */
export const getLlmClientErrorMessage = (error, fallback) => {
  if (error instanceof LlmClientError && error.userMessage) {
    return error.userMessage;
  }
  return fallback;
};

/**
 * Extract the raw text response from the Gemini API payload.
 *
 * @param {object} response - API response JSON.
 * @param {string} responseLabel - Context label for error messages.
 * @returns {string} Raw JSON string emitted by the model.
 */
const extractResponseText = (response, responseLabel) => {
  const candidateText = response?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof candidateText !== 'string') {
    throw createLlmError(`Missing text content in ${responseLabel} response.`, {
      code: 'INVALID_RESPONSE',
      userMessage: 'The AI returned an incomplete response. Please try again.',
      context: { responseLabel, response },
    });
  }
  return candidateText;
};

/**
 * Parse JSON from a model response string with consistent error handling.
 *
 * @param {string} text - Raw JSON string from the model.
 * @param {string} responseLabel - Context label for error messages.
 * @returns {object} Parsed JSON payload.
 */
const parseResponseJson = (text, responseLabel) => {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw createLlmError(`Failed to parse ${responseLabel} JSON.`, {
      code: 'INVALID_JSON',
      userMessage: 'The AI returned malformed data. Please try again.',
      cause: error,
      context: { responseLabel, text },
    });
  }
};

/**
 * Ensure a value is a non-empty string for response validation.
 *
 * @param {unknown} value - Value to validate.
 * @param {string} field - Field name for error context.
 * @param {string} responseLabel - Response label for user messaging.
 */
const assertString = (value, field, responseLabel) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw createLlmError(`Expected ${field} to be a non-empty string.`, {
      code: 'INVALID_RESPONSE',
      userMessage: 'The AI returned an incomplete response. Please try again.',
      context: { field, responseLabel, value },
    });
  }
};

/**
 * Ensure a value is an array for response validation.
 *
 * @param {unknown} value - Value to validate.
 * @param {string} field - Field name for error context.
 * @param {string} responseLabel - Response label for user messaging.
 */
const assertArray = (value, field, responseLabel) => {
  if (!Array.isArray(value)) {
    throw createLlmError(`Expected ${field} to be an array.`, {
      code: 'INVALID_RESPONSE',
      userMessage: 'The AI returned an incomplete response. Please try again.',
      context: { field, responseLabel, value },
    });
  }
};

/**
 * Ensure a value is a number for response validation.
 *
 * @param {unknown} value - Value to validate.
 * @param {string} field - Field name for error context.
 * @param {string} responseLabel - Response label for user messaging.
 */
const assertNumber = (value, field, responseLabel) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw createLlmError(`Expected ${field} to be a number.`, {
      code: 'INVALID_RESPONSE',
      userMessage: 'The AI returned an incomplete response. Please try again.',
      context: { field, responseLabel, value },
    });
  }
};

/**
 * Ensure a value is a boolean for response validation.
 *
 * @param {unknown} value - Value to validate.
 * @param {string} field - Field name for error context.
 * @param {string} responseLabel - Response label for user messaging.
 */
const assertBoolean = (value, field, responseLabel) => {
  if (typeof value !== 'boolean') {
    throw createLlmError(`Expected ${field} to be a boolean.`, {
      code: 'INVALID_RESPONSE',
      userMessage: 'The AI returned an incomplete response. Please try again.',
      context: { field, responseLabel, value },
    });
  }
};

/**
 * Ensure an array contains only numbers for response validation.
 *
 * @param {unknown} value - Value to validate.
 * @param {string} field - Field name for error context.
 * @param {string} responseLabel - Response label for user messaging.
 */
const assertNumberArray = (value, field, responseLabel) => {
  assertArray(value, field, responseLabel);
  const invalidEntry = value.find((item) => typeof item !== 'number' || Number.isNaN(item));
  if (invalidEntry !== undefined) {
    throw createLlmError(`Expected ${field} entries to be numbers.`, {
      code: 'INVALID_RESPONSE',
      userMessage: 'The AI returned an incomplete response. Please try again.',
      context: { field, responseLabel, invalidEntry, value },
    });
  }
};

/**
 * Request JSON from the Gemini API using a system prompt and user prompt string.
 *
 * @param {{systemPrompt: string, userPrompt: string, responseLabel?: string}} params - Prompt configuration.
 * @returns {Promise<object>} Parsed JSON payload.
 */
export const requestLlmJson = async ({ systemPrompt, userPrompt, responseLabel = 'response' }) => {
  if (!API_KEY) {
    throw createLlmError('Missing Gemini API key.', {
      code: 'CONFIG_MISSING',
      userMessage: 'LLM API key is missing. Please check configuration.',
      context: { responseLabel },
    });
  }

  try {
    const response = await fetchWithRetry(`${GEMINI_ENDPOINT}?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { responseMimeType: 'application/json' },
      }),
    });

    const responseText = extractResponseText(response, responseLabel);
    return parseResponseJson(responseText, responseLabel);
  } catch (error) {
    if (error instanceof LlmClientError) {
      throw error;
    }
    throw createLlmError(`LLM request failed for ${responseLabel}.`, {
      code: 'REQUEST_FAILED',
      userMessage: 'The AI request failed. Please try again.',
      cause: error,
      context: { responseLabel },
    });
  }
};

/**
 * Validate and return a case generation response.
 *
 * @param {object} payload - Parsed JSON payload.
 * @returns {object} Sanitized case payload.
 */
export const parseCaseResponse = (payload) => {
  if (!payload || typeof payload !== 'object') {
    throw createLlmError('Case response is not an object.', {
      code: 'INVALID_RESPONSE',
      userMessage: 'The AI returned an incomplete case. Please try again.',
      context: { payload },
    });
  }

  assertString(payload.title, 'title', 'case');
  assertArray(payload.facts, 'facts', 'case');
  assertBoolean(payload.is_jury_trial, 'is_jury_trial', 'case');

  if (!payload.judge || typeof payload.judge !== 'object') {
    throw createLlmError('Missing judge in case response.', {
      code: 'INVALID_RESPONSE',
      userMessage: 'The AI returned an incomplete case. Please try again.',
      context: { payload },
    });
  }

  assertString(payload.judge.name, 'judge.name', 'case');

  if (payload.is_jury_trial) {
    assertArray(payload.jurors, 'jurors', 'case');
  }

  return payload;
};

/**
 * Validate and return a jury strike response.
 *
 * @param {object} payload - Parsed JSON payload.
 * @returns {object} Sanitized jury response payload.
 */
export const parseJuryResponse = (payload) => {
  if (!payload || typeof payload !== 'object') {
    throw createLlmError('Jury response is not an object.', {
      code: 'INVALID_RESPONSE',
      userMessage: 'The AI returned an incomplete jury response. Please try again.',
      context: { payload },
    });
  }

  assertNumberArray(payload.opponent_strikes, 'opponent_strikes', 'jury');
  assertNumberArray(payload.seated_juror_ids, 'seated_juror_ids', 'jury');
  assertString(payload.judge_comment, 'judge_comment', 'jury');

  return payload;
};

/**
 * Validate and return a motion ruling response.
 *
 * @param {object} payload - Parsed JSON payload.
 * @returns {object} Sanitized motion response payload.
 */
export const parseMotionResponse = (payload) => {
  if (!payload || typeof payload !== 'object') {
    throw createLlmError('Motion response is not an object.', {
      code: 'INVALID_RESPONSE',
      userMessage: 'The AI returned an incomplete motion ruling. Please try again.',
      context: { payload },
    });
  }

  assertString(payload.ruling, 'ruling', 'motion');
  assertString(payload.outcome_text, 'outcome_text', 'motion');

  return payload;
};

/**
 * Validate and return a final verdict response.
 *
 * @param {object} payload - Parsed JSON payload.
 * @returns {object} Sanitized verdict response payload.
 */
export const parseVerdictResponse = (payload) => {
  if (!payload || typeof payload !== 'object') {
    throw createLlmError('Verdict response is not an object.', {
      code: 'INVALID_RESPONSE',
      userMessage: 'The AI returned an incomplete verdict. Please try again.',
      context: { payload },
    });
  }

  assertString(payload.final_ruling, 'final_ruling', 'verdict');
  assertNumber(payload.final_weighted_score, 'final_weighted_score', 'verdict');
  assertString(payload.judge_opinion, 'judge_opinion', 'verdict');

  return payload;
};
