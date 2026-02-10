import { useEffect } from 'react';
import mermaid from 'mermaid';

let initialized = false;

function initMermaid() {
  if (initialized) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
  });
  initialized = true;
}

/**
 * Renders mermaid diagrams inside the given container element.
 * Call this after HTML content with `.mermaid` blocks is set via dangerouslySetInnerHTML.
 */
export function useMermaid(containerRef: React.RefObject<HTMLElement | null>, htmlContent: string) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const mermaidElements = container.querySelectorAll<HTMLElement>('.mermaid');
    console.log('[useMermaid] Found', mermaidElements.length, 'mermaid elements');
    if (mermaidElements.length === 0) return;

    initMermaid();

    // Detect dark mode and update mermaid theme
    const isDark =
      document.documentElement.getAttribute('data-theme') === 'dark' ||
      (document.documentElement.getAttribute('data-theme') !== 'light' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);

    mermaid.initialize({
      startOnLoad: false,
      theme: isDark ? 'dark' : 'default',
      securityLevel: 'loose',
    });

    // Mermaid requires unique IDs; reset processed elements
    mermaidElements.forEach((el) => {
      el.removeAttribute('data-processed');
    });

    mermaid.run({ nodes: Array.from(mermaidElements) })
      .then(() => {
        console.log('[useMermaid] Successfully rendered', mermaidElements.length, 'diagrams');
      })
      .catch((err) => {
        console.error('[useMermaid] Mermaid rendering failed:', err);
      });
  }, [htmlContent, containerRef]);
}
