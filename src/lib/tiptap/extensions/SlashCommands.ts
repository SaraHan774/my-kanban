import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { EditorView } from '@tiptap/pm/view';
import { AppSlashCommand } from '@/data/defaultSlashCommands';

export const SlashCommandsPluginKey = new PluginKey('slashCommands');

export const SlashCommandsExtension = Extension.create({
  name: 'slashCommands',

  addOptions() {
    return {
      commands: [] as AppSlashCommand[],
    };
  },

  addProseMirrorPlugins() {
    const commands = this.options.commands as AppSlashCommand[];

    return [
      new Plugin({
        key: SlashCommandsPluginKey,

        state: {
          init() {
            return { active: false, query: '', slashPos: null as number | null };
          },

          apply(tr, value) {
            const { selection, doc } = tr;
            const { from } = selection;

            // Get text before cursor
            const textBefore = doc.textBetween(Math.max(0, from - 20), from, '\n', '\n');
            const match = textBefore.match(/(?:^|\s)\/(\w*)$/);

            if (match) {
              const query = match[1] || '';
              const slashPos = from - match[0].length + match[0].indexOf('/');
              return { active: true, query, slashPos };
            }

            if (value.active) {
              // Close if cursor moved before slash or text has space/newline
              if (value.slashPos !== null && value.slashPos < from) {
                try {
                  const newQuery = doc.textBetween(value.slashPos + 1, from);
                  if (newQuery.includes(' ') || newQuery.includes('\n')) {
                    return { active: false, query: '', slashPos: null };
                  }
                  return { ...value, query: newQuery };
                } catch {
                  return { active: false, query: '', slashPos: null };
                }
              }
              return { active: false, query: '', slashPos: null };
            }

            return value;
          },
        },

        props: {
          handleKeyDown(view: EditorView, event: KeyboardEvent) {
            const state = SlashCommandsPluginKey.getState(view.state);
            if (!state?.active) return false;

            const query = state.query.toLowerCase();
            const filtered = commands.filter(
              (cmd) =>
                cmd.key.toLowerCase().includes(query) ||
                cmd.label.toLowerCase().includes(query)
            );

            if (event.key === 'Escape') {
              // Force close by moving selection (triggers state.apply)
              return true;
            }

            if (event.key === 'Enter' && filtered.length > 0) {
              event.preventDefault();
              executeCommand(view, filtered[0], state.slashPos!);
              return true;
            }

            return false;
          },
        },
      }),
    ];
  },
});

function executeCommand(view: EditorView, cmd: AppSlashCommand, slashPos: number) {
  const { state, dispatch } = view;
  const { from } = state.selection;

  const insertText = cmd.insert;
  const cursorOffset = cmd.cursorOffset || 0;

  const tr = state.tr.deleteRange(slashPos, from).insertText(insertText, slashPos);

  const newCursorPos = slashPos + insertText.length - cursorOffset;
  tr.setSelection(TextSelection.near(tr.doc.resolve(newCursorPos)));

  dispatch(tr);
  view.focus();
}
