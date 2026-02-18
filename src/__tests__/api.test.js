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

  it('retries retryable HTTP responses with exponential backoff', async () => {
    const jsonMock = vi.fn().mockResolvedValue({ ok: true });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, json: jsonMock });
    vi.stubGlobal('fetch', fetchMock);

    const promise = fetchWithRetry('/endpoint', { method: 'GET' }, 1, 1000);
    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ ok: true });
  });

  it('retries request timeouts and throws after exhaustion', async () => {
    const fetchMock = vi.fn((_, options) => {
      return new Promise((resolve, reject) => {
        options.signal.addEventListener('abort', () => {
          const abortError = new Error('Aborted');
          abortError.name = 'AbortError';
          reject(abortError);
        });
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const promise = fetchWithRetry('/endpoint', { method: 'GET' }, 1, 100, {
      attemptTimeoutMs: 50,
      maxElapsedMs: 1000,
      maxBackoffMs: 500,
    });
    const rejection = expect(promise).rejects.toMatchObject({ code: 'REQUEST_TIMEOUT' });

    await vi.advanceTimersByTimeAsync(201);
    await rejection;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry permanent failures', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    vi.stubGlobal('fetch', fetchMock);

    const promise = fetchWithRetry('/endpoint', { method: 'GET' }, 3, 1000);

    await expect(promise).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('stops retries when max elapsed time is exceeded', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetchMock);

    const promise = fetchWithRetry('/endpoint', { method: 'GET' }, 5, 1000, {
      maxElapsedMs: 500,
      maxBackoffMs: 1000,
      attemptTimeoutMs: 1000,
    });
    const rejection = expect(promise).rejects.toMatchObject({ code: 'NETWORK_ERROR' });

    await vi.advanceTimersByTimeAsync(501);
    await rejection;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
