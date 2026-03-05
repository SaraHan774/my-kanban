import { Node, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export interface WikiLinkOptions {
  HTMLAttributes: Record<string, any>;
  onNavigate?: (pageRef: string, isIdBased: boolean) => void;
}

// Helper function to check if a string looks like a UUID/ID
function looksLikeId(str: string): boolean {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidPattern.test(str);
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    wikiLink: {
      /**
       * Insert a wiki link
       */
      setWikiLink: (attributes: { ref: string; displayText?: string }) => ReturnType;
    };
  }
}

/**
 * WikiLink extension for Tiptap
 * Supports [[Page Title]] and [[page-id|Display Text]] syntax
 */
export const WikiLink = Node.create<WikiLinkOptions>({
  name: 'wikiLink',

  group: 'inline',

  inline: true,

  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
      onNavigate: undefined,
    };
  },

  addAttributes() {
    return {
      ref: {
        default: null,
        parseHTML: element => element.getAttribute('data-ref'),
        renderHTML: attributes => {
          if (!attributes.ref) {
            return {};
          }

          return {
            'data-ref': attributes.ref,
          };
        },
      },
      displayText: {
        default: null,
        parseHTML: element => element.textContent,
      },
      isIdBased: {
        default: false,
        parseHTML: element => element.getAttribute('data-id-based') === 'true',
        renderHTML: attributes => {
          return {
            'data-id-based': attributes.isIdBased ? 'true' : 'false',
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'a[data-ref]',
        priority: 60,
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    const displayText = node.attrs.displayText || node.attrs.ref;

    return [
      'a',
      mergeAttributes(
        {
          class: 'wiki-link',
          href: '#',
          'data-ref': node.attrs.ref,
          'data-id-based': node.attrs.isIdBased ? 'true' : 'false',
        },
        this.options.HTMLAttributes,
        HTMLAttributes
      ),
      displayText,
    ];
  },

  renderText({ node }) {
    const displayText = node.attrs.displayText;
    const ref = node.attrs.ref;

    if (displayText && displayText !== ref) {
      return `[[${ref}|${displayText}]]`;
    }

    return `[[${ref}]]`;
  },

  addCommands() {
    return {
      setWikiLink:
        attributes =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              ref: attributes.ref,
              displayText: attributes.displayText || attributes.ref,
              isIdBased: looksLikeId(attributes.ref),
            },
          });
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('wikiLinkClick'),
        props: {
          handleClick: (_view, _pos, event) => {
            const target = event.target as HTMLElement;

            if (target.classList.contains('wiki-link')) {
              event.preventDefault();

              const ref = target.getAttribute('data-ref');
              const isIdBased = target.getAttribute('data-id-based') === 'true';

              if (ref && this.options.onNavigate) {
                this.options.onNavigate(ref, isIdBased);
              }

              return true;
            }

            return false;
          },
        },
      }),
    ];
  },
});
