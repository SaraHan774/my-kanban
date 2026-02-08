import { SlashCommand } from '@/lib/slash-commands';

export interface AppSlashCommand extends SlashCommand {
  builtin?: boolean;
}

export const DEFAULT_SLASH_COMMANDS: AppSlashCommand[] = [
  { id: 'h1', key: 'h1', label: 'Heading 1', icon: 'H1', insert: '# ', builtin: true },
  { id: 'h2', key: 'h2', label: 'Heading 2', icon: 'H2', insert: '## ', builtin: true },
  { id: 'h3', key: 'h3', label: 'Heading 3', icon: 'H3', insert: '### ', builtin: true },
  { id: 'todo', key: 'todo', label: 'To-do', icon: '☐', insert: '- [ ] ', builtin: true },
  { id: 'code', key: 'code', label: 'Code Block', icon: '</>', insert: '```\n\n```', cursorOffset: 4, builtin: true },
  { id: 'table', key: 'table', label: 'Table', icon: '⊞', insert: '| Col 1 | Col 2 |\n|-------|-------|\n|       |       |', cursorOffset: 5, builtin: true },
  { id: 'hr', key: 'hr', label: 'Divider', icon: '—', insert: '---\n', builtin: true },
  { id: 'link', key: 'link', label: 'Link', icon: '🔗', insert: '[text](url)', cursorOffset: 4, builtin: true },
  { id: 'image', key: 'image', label: 'Image', icon: '🖼', insert: '![alt](url)', cursorOffset: 4, builtin: true },
  { id: 'quote', key: 'quote', label: 'Quote', icon: '❝', insert: '> ', builtin: true },
];
