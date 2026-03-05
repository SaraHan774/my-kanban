import { Extension } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion, { SuggestionOptions } from '@tiptap/suggestion';

export interface WikiLinkSuggestionOptions {
  suggestion: Omit<SuggestionOptions, 'editor'>;
}

/**
 * WikiLink suggestion extension
 * Provides autocomplete when typing [[
 */
export const WikiLinkSuggestion = Extension.create<WikiLinkSuggestionOptions>({
  name: 'wikiLinkSuggestion',

  addOptions() {
    return {
      suggestion: {
        char: '[[',
        pluginKey: new PluginKey('wikiLinkSuggestion'),
        command: ({ editor, range, props }) => {
          // Insert wiki link when suggestion is selected
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .setWikiLink({
              ref: props.id,
              displayText: props.label,
            })
            .run();
        },
        allow: ({ state, range }) => {
          const $from = state.doc.resolve(range.from);
          const type = state.schema.nodes.wikiLink;

          if (!type) {
            return false;
          }

          // Don't allow nested wiki links
          return !$from.parent.type.spec.code && !$from.node().type.spec.code;
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
