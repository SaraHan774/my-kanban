/**
 * Open an external URL in the system default browser.
 * Works in both Tauri (desktop) and browser environments.
 */
export async function openExternalUrl(url: string): Promise<void> {
  console.log('[OPEN EXTERNAL] Called with URL:', url);
  console.log('[OPEN EXTERNAL] Is Tauri?', '__TAURI_INTERNALS__' in window);

  if ('__TAURI_INTERNALS__' in window) {
    try {
      console.log('[OPEN EXTERNAL] Using Tauri opener plugin');
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl(url);
      console.log('[OPEN EXTERNAL] ✓ Tauri openUrl completed');
    } catch (err) {
      console.error('[OPEN EXTERNAL] ✗ Tauri openUrl failed:', err);
      throw err;
    }
  } else {
    console.log('[OPEN EXTERNAL] Using window.open');
    const result = window.open(url, '_blank', 'noopener,noreferrer');
    console.log('[OPEN EXTERNAL] window.open result:', result);
  }
}
