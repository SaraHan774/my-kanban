export interface SlashCommand {
  id: string;
  key: string;
  label: string;
  icon: string;
  insert: string;
  cursorOffset?: number;
}
