/**
 * Clipboard + toast — use after SOC actions (copy ID, hash, IOC).
 */
export async function copyWithToast(text, addToast, successMessage = 'Copied to clipboard') {
  if (text == null || String(text) === '') {
    addToast({ variant: 'error', message: 'Nothing to copy.' });
    return false;
  }
  try {
    await navigator.clipboard.writeText(String(text));
    addToast({ variant: 'success', message: successMessage });
    return true;
  } catch {
    addToast({ variant: 'error', message: 'Clipboard unavailable — copy manually.' });
    return false;
  }
}
