import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithRetry } from '../lib/api';

describe('fetchWithRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('retries failed requests with exponential backoff', async () => {
    const jsonMock = vi.fn().mockResolvedValue({ ok: true });
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ ok: true, json: jsonMock });
    vi.stubGlobal('fetch', fetchMock);

    const promise = fetchWithRetry('/endpoint', { method: 'GET' }, 1, 1000);
    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ ok: true });
  });

  it('throws after exhausting retries', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('boom'));
    vi.stubGlobal('fetch', fetchMock);

    const promise = fetchWithRetry('/endpoint', { method: 'GET' }, 0, 500);

    await expect(promise).rejects.toThrow('boom');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
