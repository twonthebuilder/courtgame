/**
 * Copies the provided text to the user's clipboard with a legacy fallback.
 *
 * @param {string} text - The text to copy.
 * @returns {Promise<boolean>}
 */
export const copyToClipboard = async (text) => {
  if (!navigator.clipboard) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    let didCopy = false;
    try {
      didCopy = document.execCommand('copy');
    } catch (err) {
      console.error('Fallback copy failed', err);
    }
    document.body.removeChild(textArea);
    return didCopy;
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Clipboard copy failed', err);
    return false;
  }
};
