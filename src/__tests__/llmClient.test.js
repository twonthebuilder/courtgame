import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithRetry } from '../lib/api';
import {
  LlmClientError,
  getLlmClientErrorMessage,
  requestLlmJson,
} from '../lib/llmClient';

vi.mock('../lib/config', () => ({
  API_KEY: 'test-key',
}));

vi.mock('../lib/api', () => ({
  fetchWithRetry: vi.fn(),
}));

describe('llm client wrappers', () => {
  beforeEach(() => {
    fetchWithRetry.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns parsed JSON from the response payload', async () => {
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
    expect(result).toEqual({ decision: 'ok' });
  });

  it('prefers user-friendly messages from LlmClientError', () => {
    const error = new LlmClientError('Bad response', {
      userMessage: 'Try again later.',
    });

    expect(getLlmClientErrorMessage(error, 'Fallback')).toBe('Try again later.');
    expect(getLlmClientErrorMessage(new Error('Oops'), 'Fallback')).toBe('Fallback');
  });
});
