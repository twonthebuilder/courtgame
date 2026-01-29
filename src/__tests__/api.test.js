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

    const promise = fetchWithRetry('/endpoint', { method: 'GET' }, { retries: 1, backoff: 1000 });
    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ ok: true });
  });

  it('throws after exhausting retries', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('boom'));
    vi.stubGlobal('fetch', fetchMock);

    const promise = fetchWithRetry('/endpoint', { method: 'GET' }, { retries: 0, backoff: 500 });

    await expect(promise).rejects.toThrow('boom');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('aborts requests that exceed the timeout', async () => {
    const fetchMock = vi.fn((_, options) => {
      return new Promise((_, reject) => {
        options.signal.addEventListener('abort', () => reject(new Error('AbortError')), {
          once: true,
        });
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const promise = fetchWithRetry('/endpoint', { method: 'GET' }, { retries: 0, timeoutMs: 500 });
    const rejection = expect(promise).rejects.toThrow('AbortError');

    await vi.advanceTimersByTimeAsync(500);

    await rejection;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('retries after timeouts without leaking timers', async () => {
    const jsonMock = vi.fn().mockResolvedValue({ ok: true });
    const fetchMock = vi
      .fn()
      .mockImplementationOnce((_, options) => {
        return new Promise((_, reject) => {
          options.signal.addEventListener('abort', () => reject(new Error('Timeout')), {
            once: true,
          });
        });
      })
      .mockResolvedValueOnce({ ok: true, json: jsonMock });
    vi.stubGlobal('fetch', fetchMock);

    const promise = fetchWithRetry('/endpoint', { method: 'GET' }, {
      retries: 1,
      backoff: 200,
      timeoutMs: 500,
    });

    await vi.advanceTimersByTimeAsync(500);
    await vi.advanceTimersByTimeAsync(200);

    const result = await promise;

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });
});
