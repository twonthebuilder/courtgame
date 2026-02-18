/**
 * Fetches JSON with retry and exponential backoff.
 *
 * @param {string} url - Request URL.
 * @param {RequestInit} options - Fetch options.
 * @param {number} [retries=3] - Remaining retries.
 * @param {number} [backoff=1000] - Backoff delay in milliseconds.
 * @param {{attemptTimeoutMs?: number, maxElapsedMs?: number, maxBackoffMs?: number}} [retryOptions] - Retry guardrails.
 * @returns {Promise<unknown>} The parsed JSON response.
 */
export const fetchWithRetry = async (url, options = {}, retries = 3, backoff = 1000, retryOptions = {}) => {
  const { attemptTimeoutMs = 10000, maxElapsedMs = 30000, maxBackoffMs = 8000 } = retryOptions;
  const startedAt = Date.now();
  let retriesRemaining = retries;
  let currentBackoff = backoff;

  while (true) {
    const controller = new AbortController();
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, attemptTimeoutMs);
    const upstreamSignal = options.signal;
    const abortFromUpstream = () => controller.abort();

    if (upstreamSignal) {
      if (upstreamSignal.aborted) {
        abortFromUpstream();
      } else {
        upstreamSignal.addEventListener('abort', abortFromUpstream, { once: true });
      }
    }

    try {
      let response;
      try {
        response = await fetch(url, { ...options, signal: controller.signal });
      } catch (error) {
        const requestError = new Error(
          timedOut ? 'Request timed out.' : 'Network request failed.',
          { cause: error }
        );
        requestError.code = timedOut ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR';
        requestError.retryable = timedOut || !controller.signal.aborted;
        throw requestError;
      }

      if (!response.ok) {
        const error = new Error(`HTTP error! status: ${response.status}`);
        error.code = 'HTTP_ERROR';
        error.status = response.status;
        error.retryable = response.status === 429 || response.status >= 500;
        throw error;
      }

      return response.json();
    } catch (error) {
      const elapsedMs = Date.now() - startedAt;
      const canRetry = error?.retryable === true;
      const retryWindowRemainingMs = maxElapsedMs - elapsedMs;

      if (!canRetry || retriesRemaining <= 0 || retryWindowRemainingMs <= 0) {
        throw error;
      }

      const delayMs = Math.min(currentBackoff, maxBackoffMs, retryWindowRemainingMs);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      retriesRemaining -= 1;
      currentBackoff = Math.min(currentBackoff * 2, maxBackoffMs);
    } finally {
      clearTimeout(timeoutId);
      if (upstreamSignal) {
        upstreamSignal.removeEventListener('abort', abortFromUpstream);
      }
    }
  }
};
