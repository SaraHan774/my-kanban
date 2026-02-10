/**
 * Config Service
 * Persists app settings to .kanban-config.json in the workspace root.
 * Falls back to localStorage when file system is unavailable.
 */

import { fileSystemService } from './fileSystemFactory';
import { AppSlashCommand, DEFAULT_SLASH_COMMANDS } from '@/data/defaultSlashCommands';

const CONFIG_FILE = '.kanban-config.json';

// localStorage keys (used as cache / fallback)
const LS_COLUMN_COLORS = 'kanban-column-colors';
const LS_SLASH_COMMANDS = 'kanban-slash-commands';
const LS_THEME = 'kanban-theme';
const LS_COLUMN_ORDER = 'kanban-column-order';
const LS_ZOOM_LEVEL = 'kanban-zoom-level';

export interface KanbanSettings {
  columnColors: Record<string, string>;
  slashCommands: AppSlashCommand[];
  theme: 'light' | 'dark' | 'auto';
  columnOrder: string[];
  zoomLevel: number;
}

const DEFAULT_SETTINGS: KanbanSettings = {
  columnColors: {},
  slashCommands: DEFAULT_SLASH_COMMANDS,
  theme: 'auto',
  columnOrder: [],
  zoomLevel: 100,
};

class ConfigService {
  /**
   * Load settings from .kanban-config.json.
   * Returns null if file doesn't exist or FS is unavailable.
   */
  async loadFromFile(): Promise<KanbanSettings | null> {
    try {
      if (!fileSystemService.getRootHandle()) return null;
      const raw = await fileSystemService.readFile(CONFIG_FILE);
      const parsed = JSON.parse(raw);
      return {
        columnColors: parsed.columnColors ?? DEFAULT_SETTINGS.columnColors,
        slashCommands: parsed.slashCommands ?? DEFAULT_SETTINGS.slashCommands,
        theme: parsed.theme ?? DEFAULT_SETTINGS.theme,
        columnOrder: parsed.columnOrder ?? DEFAULT_SETTINGS.columnOrder,
        zoomLevel: parsed.zoomLevel ?? DEFAULT_SETTINGS.zoomLevel,
      };
    } catch {
      return null;
    }
  }

  /**
   * Save settings to .kanban-config.json.
   * Silently fails if FS is unavailable.
   */
  async saveToFile(settings: KanbanSettings): Promise<void> {
    try {
      if (!fileSystemService.getRootHandle()) return;
      const json = JSON.stringify(settings, null, 2);
      await fileSystemService.writeFile(CONFIG_FILE, json);
    } catch (err) {
      console.warn('Failed to save config to file:', err);
    }
  }

  /**
   * Load settings from localStorage (synchronous, used for initial render).
   */
  loadFromLocalStorage(): KanbanSettings {
    const settings = { ...DEFAULT_SETTINGS };

    try {
      const colors = localStorage.getItem(LS_COLUMN_COLORS);
      if (colors) settings.columnColors = JSON.parse(colors);
    } catch { /* ignore */ }

    try {
      const cmds = localStorage.getItem(LS_SLASH_COMMANDS);
      if (cmds) settings.slashCommands = JSON.parse(cmds);
    } catch { /* ignore */ }

    const theme = localStorage.getItem(LS_THEME) as KanbanSettings['theme'] | null;
    if (theme) settings.theme = theme;

    try {
      const order = localStorage.getItem(LS_COLUMN_ORDER);
      if (order) settings.columnOrder = JSON.parse(order);
    } catch { /* ignore */ }

    try {
      const zoom = localStorage.getItem(LS_ZOOM_LEVEL);
      if (zoom) settings.zoomLevel = JSON.parse(zoom);
    } catch { /* ignore */ }

    return settings;
  }

  /**
   * Save settings to localStorage (synchronous cache).
   */
  saveToLocalStorage(settings: KanbanSettings): void {
    localStorage.setItem(LS_COLUMN_COLORS, JSON.stringify(settings.columnColors));
    localStorage.setItem(LS_SLASH_COMMANDS, JSON.stringify(settings.slashCommands));
    localStorage.setItem(LS_THEME, settings.theme);
    localStorage.setItem(LS_COLUMN_ORDER, JSON.stringify(settings.columnOrder));
    localStorage.setItem(LS_ZOOM_LEVEL, JSON.stringify(settings.zoomLevel));
  }

  /**
   * Save to both localStorage (sync) and file (async).
   */
  save(settings: KanbanSettings): void {
    this.saveToLocalStorage(settings);
    this.saveToFile(settings);
  }
}

export const configService = new ConfigService();
