import Editor from '@toast-ui/editor';
import mermaid from 'mermaid';

// Initialize mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
});

/**
 * Toast UI Editor plugin for Mermaid diagram rendering
 */
export function mermaidPlugin(context?: any, options?: any) {
  return {
    // Hook into markdown rendering
    toHTMLRenderers: {
      code(node: any) {
        const lang = node.info;
        const code = node.literal;

        if (lang === 'mermaid') {
          const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;

          // Render mermaid diagram asynchronously
          setTimeout(() => {
            const element = document.getElementById(id);
            if (element) {
              try {
                mermaid.render(`mermaid-svg-${id}`, code).then((result) => {
                  element.innerHTML = result.svg;
                  element.classList.add('mermaid-rendered');
                });
              } catch (error) {
                console.error('Mermaid rendering error:', error);
                element.innerHTML = `<pre class="mermaid-error">${code}</pre>`;
              }
            }
          }, 100);

          return {
            type: 'html',
            content: `<div id="${id}" class="mermaid-block" data-language="mermaid">${code}</div>`,
          };
        }

        // Default code block rendering
        return null;
      },
    },
  };
}
