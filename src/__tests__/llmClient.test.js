import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithRetry } from '../lib/api';
import { getActiveApiKey } from '../lib/runtimeConfig';
import {
  LlmClientError,
  getLlmClientErrorMessage,
  parseCaseResponse,
  requestLlmJson,
} from '../lib/llmClient';

vi.mock('../lib/runtimeConfig', () => ({
  getActiveApiKey: vi.fn(() => 'test-key'),
}));

vi.mock('../lib/api', () => ({
  fetchWithRetry: vi.fn(),
}));

describe('llm client wrappers', () => {
  beforeEach(() => {
    fetchWithRetry.mockReset();
    getActiveApiKey.mockReset().mockReturnValue('test-key');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns parsed JSON and raw text from the response payload', async () => {
    fetchWithRetry.mockResolvedValue({
      candidates: [{ content: { parts: [{ text: '{"decision":"ok"}' }] } }],
    });

    const result = await requestLlmJson({
      systemPrompt: 'System',
      userPrompt: 'User',
      responseLabel: 'case',
    });

    expect(fetchWithRetry).toHaveBeenCalledWith(
      expect.stringContaining('generativelanguage.googleapis.com'),
      expect.objectContaining({ method: 'POST' })
    );
    expect(result).toEqual({
      parsed: { decision: 'ok' },
      rawText: '{"decision":"ok"}',
    });
  });

  it('maps timeout failures to a timeout user message', async () => {
    const timeoutError = new Error('timeout');
    timeoutError.code = 'REQUEST_TIMEOUT';
    fetchWithRetry.mockRejectedValue(timeoutError);

    await expect(
      requestLlmJson({
        systemPrompt: 'System',
        userPrompt: 'User',
        responseLabel: 'case',
      })
    ).rejects.toMatchObject({
      code: 'REQUEST_TIMEOUT',
      userMessage: 'The AI request timed out. Please try again.',
    });
  });

  it('maps rate-limit failures to a rate-limit user message', async () => {
    const rateLimitError = new Error('429');
    rateLimitError.status = 429;
    fetchWithRetry.mockRejectedValue(rateLimitError);

    await expect(
      requestLlmJson({
        systemPrompt: 'System',
        userPrompt: 'User',
        responseLabel: 'case',
      })
    ).rejects.toMatchObject({
      code: 'RATE_LIMIT',
      userMessage: 'The AI is rate-limited right now. Please wait a moment and retry.',
    });
  });

  it('maps auth failures to an auth-specific user message', async () => {
    const authError = new Error('403');
    authError.status = 403;
    fetchWithRetry.mockRejectedValue(authError);

    await expect(
      requestLlmJson({
        systemPrompt: 'System',
        userPrompt: 'User',
        responseLabel: 'case',
      })
    ).rejects.toMatchObject({
      code: 'AUTH_FAILED',
      userMessage: 'AI authentication failed. Please verify your API key and permissions.',
    });
  });

  it('prefers user-friendly messages from LlmClientError', () => {
    const error = new LlmClientError('Bad response', {
      userMessage: 'Try again later.',
    });

    expect(getLlmClientErrorMessage(error, 'Fallback')).toBe('Try again later.');
    expect(getLlmClientErrorMessage(new Error('Oops'), 'Fallback')).toBe('Fallback');
  });

  it('keeps the missing key message unchanged', async () => {
    getActiveApiKey.mockReturnValue('');

    await expect(
      requestLlmJson({
        systemPrompt: 'System',
        userPrompt: 'User',
        responseLabel: 'case',
      })
    ).rejects.toMatchObject({
      userMessage: 'LLM API key is missing. Please check configuration.',
    });
  });

  it('rejects duplicate juror ids in case responses', () => {
    const payload = {
      title: 'Case',
      facts: ['Fact'],
      is_jury_trial: true,
      judge: { name: 'Judge' },
      jurors: [
        { id: 1, name: 'A' },
        { id: 1, name: 'B' },
      ],
      opposing_counsel: { name: 'Opposing' },
    };

    expect(() => parseCaseResponse(payload)).toThrow('Duplicate juror id');
  });

  it('rejects non-numeric juror ids in case responses', () => {
    const payload = {
      title: 'Case',
      facts: ['Fact'],
      is_jury_trial: true,
      judge: { name: 'Judge' },
      jurors: [{ id: 'one', name: 'A' }],
      opposing_counsel: { name: 'Opposing' },
    };

    expect(() => parseCaseResponse(payload)).toThrow('jurors[0].id');
  });
});
