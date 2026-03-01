/**
 * Open an external URL in the system default browser.
 * Works in both Tauri (desktop) and browser environments.
 */
export async function openExternalUrl(url: string): Promise<void> {
  if ('__TAURI_INTERNALS__' in window) {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(url);
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
