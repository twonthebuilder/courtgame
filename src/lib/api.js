/**
 * Fetches JSON with retry and exponential backoff.
 *
 * @param {string} url - Request URL.
 * @param {RequestInit} options - Fetch options.
 * @param {{retries?: number, backoff?: number, timeoutMs?: number}} [retryOptions] - Retry and timeout options.
 * @returns {Promise<unknown>} The parsed JSON response.
 */
export const fetchWithRetry = async (
  url,
  options,
  { retries = 3, backoff = 1000, timeoutMs } = {}
) => {
  const controller = new AbortController();
  if (options?.signal) {
    if (options.signal.aborted) {
      controller.abort();
    } else {
      options.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }
  const timeoutId =
    typeof timeoutMs === 'number' && timeoutMs > 0
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  } catch (e) {
    if (retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, backoff));
      return fetchWithRetry(url, options, {
        retries: retries - 1,
        backoff: backoff * 2,
        timeoutMs,
      });
    }
    throw e;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};
