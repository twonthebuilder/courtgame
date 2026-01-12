/**
 * Fetches JSON with retry and exponential backoff.
 *
 * @param {string} url - Request URL.
 * @param {RequestInit} options - Fetch options.
 * @param {number} [retries=3] - Remaining retries.
 * @param {number} [backoff=1000] - Backoff delay in milliseconds.
 * @returns {Promise<unknown>} The parsed JSON response.
 */
export const fetchWithRetry = async (url, options, retries = 3, backoff = 1000) => {
  try {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  } catch (e) {
    if (retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, backoff));
      return fetchWithRetry(url, options, retries - 1, backoff * 2);
    }
    throw e;
  }
};
