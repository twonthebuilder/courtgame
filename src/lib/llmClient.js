import { fetchWithRetry } from './api';
import { getActiveApiKey } from './runtimeConfig';

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
 * Ensure a value is either undefined/null or a non-empty string.
 *
 * @param {unknown} value - Value to validate.
 * @param {string} field - Field name for error context.
 * @param {string} responseLabel - Response label for user messaging.
 */
const assertOptionalString = (value, field, responseLabel) => {
  if (value === undefined || value === null) return;
  assertString(value, field, responseLabel);
};

/**
 * Ensure a value is either undefined/null or a number.
 *
 * @param {unknown} value - Value to validate.
 * @param {string} field - Field name for error context.
 * @param {string} responseLabel - Response label for user messaging.
 */
const assertOptionalNumber = (value, field, responseLabel) => {
  if (value === undefined || value === null) return;
  assertNumber(value, field, responseLabel);
};

/**
 * Coerce unknown values into safe string fields for profile display.
 *
 * @param {unknown} value - Value to sanitize.
 * @returns {string} Trimmed string or empty string.
 */
const normalizeProfileField = (value) => (typeof value === 'string' ? value.trim() : '');

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
 * Normalize evidence entries into docket-ready objects.
 *
 * @param {unknown} value - Evidence payload from the model.
 * @returns {{id: number, text: string, status: 'admissible' | 'suppressed'}[]} Evidence entries.
 */
const normalizeEvidenceItems = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      if (typeof item === 'string') {
        return { id: index + 1, text: item.trim(), status: 'admissible' };
      }
      if (item && typeof item === 'object') {
        const id = typeof item.id === 'number' ? item.id : index + 1;
        const text = typeof item.text === 'string' ? item.text.trim() : '';
        const status = item.status === 'suppressed' ? 'suppressed' : 'admissible';
        return { id, text, status };
      }
      return null;
    })
    .filter((item) => item && item.text.length > 0);
};

/**
 * Request JSON from the Gemini API using a system prompt and user prompt string.
 *
 * @param {{systemPrompt: string, userPrompt: string, responseLabel?: string}} params - Prompt configuration.
 * @returns {Promise<object>} Parsed JSON payload.
 */
export const requestLlmJson = async ({ systemPrompt, userPrompt, responseLabel = 'response' }) => {
  const apiKey = getActiveApiKey();
  if (!apiKey) {
    throw createLlmError('Missing Gemini API key.', {
      code: 'CONFIG_MISSING',
      userMessage: 'LLM API key is missing. Please check configuration.',
      context: { responseLabel },
    });
  }

  try {
    const response = await fetchWithRetry(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
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
    const seenJurorIds = new Set();
    payload.jurors.forEach((juror, index) => {
      const fieldLabel = `jurors[${index}].id`;
      assertNumber(juror?.id, fieldLabel, 'case');
      if (seenJurorIds.has(juror.id)) {
        throw createLlmError(`Duplicate juror id at ${fieldLabel}.`, {
          code: 'INVALID_RESPONSE',
          userMessage: 'The AI returned an incomplete case. Please try again.',
          context: { field: fieldLabel, responseLabel: 'case', value: juror.id },
        });
      }
      seenJurorIds.add(juror.id);
    });
  }

  const opposingCounselPayload = payload.opposing_counsel;
  const opposingStatement = normalizeProfileField(payload.opposing_statement);
  const hasOpposingCounsel =
    opposingCounselPayload && typeof opposingCounselPayload === 'object' && !Array.isArray(opposingCounselPayload);
  const hasOpposingStatement = opposingStatement.length > 0;

  if (!hasOpposingCounsel && !hasOpposingStatement) {
    throw createLlmError('Missing opposing counsel profile in case response.', {
      code: 'INVALID_RESPONSE',
      userMessage: 'The AI returned an incomplete case. Please try again.',
      context: { payload },
    });
  }

  const normalizedOpposingCounsel = {
    name: normalizeProfileField(opposingCounselPayload?.name),
    age_range: normalizeProfileField(opposingCounselPayload?.age_range),
    bio: normalizeProfileField(opposingCounselPayload?.bio) || opposingStatement,
    style_tells: normalizeProfileField(opposingCounselPayload?.style_tells),
    current_posture: normalizeProfileField(opposingCounselPayload?.current_posture),
  };

  return {
    ...payload,
    evidence: normalizeEvidenceItems(payload.evidence),
    opposing_counsel: normalizedOpposingCounsel,
  };
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
  assertNumber(payload.score, 'score', 'motion');
  assertArray(payload.evidence_status_updates, 'evidence_status_updates', 'motion');

  payload.evidence_status_updates.forEach((update, index) => {
    if (!update || typeof update !== 'object') {
      throw createLlmError(`Evidence status update ${index + 1} is not an object.`, {
        code: 'INVALID_RESPONSE',
        userMessage: 'The AI returned an incomplete motion ruling. Please try again.',
        context: { update, index },
      });
    }
    assertNumber(update.id, `evidence_status_updates[${index}].id`, 'motion');
    if (update.status !== 'admissible' && update.status !== 'suppressed') {
      throw createLlmError(
        `Evidence status update ${index + 1} has invalid status.`,
        {
          code: 'INVALID_RESPONSE',
          userMessage: 'The AI returned an incomplete motion ruling. Please try again.',
          context: { update, index },
        }
      );
    }
  });

  return payload;
};

/**
 * Validate and return a motion text response.
 *
 * @param {object} payload - Parsed JSON payload.
 * @returns {object} Sanitized motion text payload.
 */
export const parseMotionTextResponse = (payload) => {
  if (!payload || typeof payload !== 'object') {
    throw createLlmError('Motion text response is not an object.', {
      code: 'INVALID_RESPONSE',
      userMessage: 'The AI returned an incomplete motion. Please try again.',
      context: { payload },
    });
  }

  assertString(payload.text, 'text', 'motion_text');

  return payload;
};

/**
 * Validate and return a final verdict response.
 *
 * @param {object} payload - Parsed JSON payload.
 * @param {{isJuryTrial?: boolean, seatedJurorIds?: number[], docketJurorIds?: number[]}} [context] - Docket context.
 * @returns {object} Sanitized verdict response payload.
 */
export const parseVerdictResponse = (payload, context = {}) => {
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
  assertOptionalString(payload.overflow_reason_code, 'overflow_reason_code', 'verdict');
  assertOptionalString(payload.overflow_explanation, 'overflow_explanation', 'verdict');

  const isJuryTrial = context.isJuryTrial === true;
  if (isJuryTrial) {
    assertString(payload.jury_verdict, 'jury_verdict', 'verdict');
    assertString(payload.jury_reasoning, 'jury_reasoning', 'verdict');
    assertNumber(payload.jury_score, 'jury_score', 'verdict');
  } else if (context.isJuryTrial === false) {
    assertOptionalString(payload.jury_verdict, 'jury_verdict', 'verdict');
    assertOptionalString(payload.jury_reasoning, 'jury_reasoning', 'verdict');
    assertOptionalNumber(payload.jury_score, 'jury_score', 'verdict');
    const juryVerdict = typeof payload.jury_verdict === 'string' ? payload.jury_verdict.trim() : '';
    const hasNonBenchVerdict =
      juryVerdict.length > 0 && !['n/a', 'na'].includes(juryVerdict.toLowerCase());
    const hasNonBenchReasoning =
      typeof payload.jury_reasoning === 'string' &&
      payload.jury_reasoning.trim().length > 0 &&
      !['n/a', 'na'].includes(payload.jury_reasoning.trim().toLowerCase());
    const hasNonBenchScore =
      typeof payload.jury_score === 'number' && payload.jury_score !== 0;
    if (hasNonBenchVerdict || hasNonBenchReasoning || hasNonBenchScore) {
      throw createLlmError('Bench trials must not include jury-only outputs.', {
        code: 'INVALID_RESPONSE',
        userMessage: 'The AI returned an invalid verdict. Please retry.',
        context: { payload },
      });
    }
  }

  if (Array.isArray(context.seatedJurorIds) && Array.isArray(context.docketJurorIds)) {
    const docketJurors = new Set(context.docketJurorIds);
    const invalidJuror = context.seatedJurorIds.find((id) => !docketJurors.has(id));
    if (invalidJuror !== undefined) {
      throw createLlmError('Seated juror IDs were not found in the docket.', {
        code: 'INVALID_RESPONSE',
        userMessage: 'The AI returned an invalid verdict. Please retry.',
        context: { invalidJuror, seatedJurorIds: context.seatedJurorIds },
      });
    }
  }

  if (payload.final_weighted_score > 100) {
    if (!payload.overflow_reason_code || !payload.overflow_explanation) {
      throw createLlmError('Overflow scoring requires a reason code and explanation.', {
        code: 'INVALID_RESPONSE',
        userMessage: 'The AI returned an incomplete verdict. Please retry.',
        context: { payload },
      });
    }
  }

  return payload;
};
