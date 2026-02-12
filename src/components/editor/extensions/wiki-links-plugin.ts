/**
 * Toast UI Editor plugin for Wiki-style [[links]]
 */
export function wikiLinksPlugin(pluginContext?: any, options?: any) {
  return {
    // Custom inline parser for [[Page Title]]
    toHTMLRenderers: {
      text(node: any, context: any) {
        const text = node.literal;

        // Match [[Page Title]] pattern
        const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;

        if (wikiLinkRegex.test(text)) {
          const html = text.replace(wikiLinkRegex, (match: string, title: string) => {
            // Generate page ID from title (lowercase, replace spaces with hyphens)
            const pageId = title.toLowerCase().replace(/\s+/g, '-');

            return `<a href="/page/${pageId}" class="wiki-link" data-wiki-link="${title}">${title}</a>`;
          });

          return {
            type: 'html',
            content: html,
          };
        }

        // Default text rendering
        return null;
      },
    },

    // Markdown mode: highlight [[links]] syntax
    markdownPlugins: [
      {
        name: 'wikiLinks',
        tokenizer(stream: any) {
          const match = stream.match(/\[\[([^\]]+)\]\]/);
          if (match) {
            return {
              type: 'wikiLink',
              title: match[1],
            };
          }
          return null;
        },
      },
    ],
  };
}

/**
 * Helper to convert wiki link text to page navigation
 */
export function handleWikiLinkClick(event: MouseEvent, navigate: (path: string) => void) {
  const target = event.target as HTMLElement;

  if (target.classList.contains('wiki-link')) {
    event.preventDefault();
    const href = target.getAttribute('href');
    if (href) {
      navigate(href);
    }
  }
}
