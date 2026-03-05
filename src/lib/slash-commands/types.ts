import type { Editor } from '@tiptap/core';

export interface SlashCommand {
  id: string;
  key: string;
  label: string;
  icon: string;
  insert: string;
  cursorOffset?: number;
  action?: (editor: Editor) => void;
}
