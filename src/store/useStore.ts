/**
 * Global application state using Zustand
 */

import { create } from 'zustand';
import { Page, AppConfig, DEFAULT_CONFIG, SortOptions } from '@/types';
import { AppSlashCommand, DEFAULT_SLASH_COMMANDS } from '@/data/defaultSlashCommands';
import { configService, FontSettings, DEFAULT_FONT_SETTINGS } from '@/services/configService';

// Load initial settings from localStorage (synchronous, fast first render)
const initialSettings = configService.loadFromLocalStorage();

/** Collect current settings from state and persist to both localStorage + file */
const persistSettings = (state: {
  columnColors: Record<string, string>;
  slashCommands: AppSlashCommand[];
  theme: 'light' | 'dark' | 'auto';
  columnOrder: string[];
  fontSettings: FontSettings;
}) => {
  configService.save({
    columnColors: state.columnColors,
    slashCommands: state.slashCommands,
    theme: state.theme,
    columnOrder: state.columnOrder,
    fontSettings: state.fontSettings,
  });
};

interface AppState {
  // File system access
  hasFileSystemAccess: boolean;
  setHasFileSystemAccess: (hasAccess: boolean) => void;

  // Current page
  currentPage: Page | null;
  setCurrentPage: (page: Page | null) => void;

  // All pages cache
  pages: Page[];
  setPages: (pages: Page[]) => void;
  addPage: (page: Page) => void;
  updatePageInStore: (page: Page) => void;
  removePage: (pageId: string) => void;

  // App configuration
  config: AppConfig;
  setConfig: (config: AppConfig) => void;

  // UI state
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;

  // Filter state
  activeFilters: {
    tags: string[];
    searchText: string;
  };
  setActiveFilters: (filters: { tags: string[]; searchText: string }) => void;

  // Sort state
  sortOptions: SortOptions | null;
  setSortOptions: (sort: SortOptions | null) => void;

  // Theme (persisted)
  theme: 'light' | 'dark' | 'auto';
  setTheme: (theme: 'light' | 'dark' | 'auto') => void;

  // Column colors
  columnColors: Record<string, string>;
  setColumnColor: (column: string, color: string) => void;
  removeColumnColor: (column: string) => void;

  // Slash commands
  slashCommands: AppSlashCommand[];
  addSlashCommand: (cmd: AppSlashCommand) => void;
  updateSlashCommand: (cmd: AppSlashCommand) => void;
  removeSlashCommand: (id: string) => void;
  resetSlashCommands: () => void;

  // Column order (persisted)
  columnOrder: string[];
  setColumnOrder: (order: string[]) => void;

  // Font settings (persisted)
  fontSettings: FontSettings;
  setFontSettings: (fontSettings: FontSettings) => void;

  // Settings persistence
  loadSettingsFromFile: () => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  // File system access
  hasFileSystemAccess: false,
  setHasFileSystemAccess: (hasAccess) => set({ hasFileSystemAccess: hasAccess }),

  // Current page
  currentPage: null,
  setCurrentPage: (page) => set({ currentPage: page }),

  // All pages cache
  pages: [],
  setPages: (pages) => set({ pages }),
  addPage: (page) => set((state) => ({ pages: [...state.pages, page] })),
  updatePageInStore: (page) =>
    set((state) => ({
      pages: state.pages.map((p) => (p.id === page.id ? page : p)),
      currentPage: state.currentPage?.id === page.id ? page : state.currentPage
    })),
  removePage: (pageId) =>
    set((state) => ({
      pages: state.pages.filter((p) => p.id !== pageId),
      currentPage: state.currentPage?.id === pageId ? null : state.currentPage
    })),

  // App configuration
  config: DEFAULT_CONFIG,
  setConfig: (config) => set({ config }),

  // UI state
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  // Filter state
  activeFilters: {
    tags: [],
    searchText: ''
  },
  setActiveFilters: (filters) => set({ activeFilters: filters }),

  // Sort state
  sortOptions: null,
  setSortOptions: (sort) => set({ sortOptions: sort }),

  // Theme
  theme: initialSettings.theme,
  setTheme: (theme) => {
    set({ theme });
    const state = get();
    persistSettings({ ...state, theme });
  },

  // Column colors
  columnColors: initialSettings.columnColors,
  setColumnColor: (column, color) =>
    set((state) => {
      const updated = { ...state.columnColors, [column.toLowerCase()]: color };
      persistSettings({ ...state, columnColors: updated });
      return { columnColors: updated };
    }),
  removeColumnColor: (column) =>
    set((state) => {
      const updated = { ...state.columnColors };
      delete updated[column.toLowerCase()];
      persistSettings({ ...state, columnColors: updated });
      return { columnColors: updated };
    }),

  // Slash commands
  slashCommands: initialSettings.slashCommands,
  addSlashCommand: (cmd) =>
    set((state) => {
      const updated = [...state.slashCommands, cmd];
      persistSettings({ ...state, slashCommands: updated });
      return { slashCommands: updated };
    }),
  updateSlashCommand: (cmd) =>
    set((state) => {
      const updated = state.slashCommands.map((c) => (c.id === cmd.id ? cmd : c));
      persistSettings({ ...state, slashCommands: updated });
      return { slashCommands: updated };
    }),
  removeSlashCommand: (id) =>
    set((state) => {
      const updated = state.slashCommands.filter((c) => c.id !== id);
      persistSettings({ ...state, slashCommands: updated });
      return { slashCommands: updated };
    }),
  resetSlashCommands: () =>
    set((state) => {
      persistSettings({ ...state, slashCommands: DEFAULT_SLASH_COMMANDS });
      return { slashCommands: DEFAULT_SLASH_COMMANDS };
    }),

  // Column order
  columnOrder: initialSettings.columnOrder,
  setColumnOrder: (order) => {
    set((state) => {
      persistSettings({ ...state, columnOrder: order });
      return { columnOrder: order };
    });
  },

  // Font settings
  fontSettings: initialSettings.fontSettings,
  setFontSettings: (fontSettings) => {
    set({ fontSettings });
    const state = get();
    persistSettings({ ...state, fontSettings });
  },

  // Load settings from .kanban-config.json (called when FS access is granted)
  loadSettingsFromFile: async () => {
    const fileSettings = await configService.loadFromFile();
    if (fileSettings) {
      // File exists → use file as source of truth
      set({
        columnColors: fileSettings.columnColors,
        slashCommands: fileSettings.slashCommands,
        theme: fileSettings.theme,
        columnOrder: fileSettings.columnOrder,
        fontSettings: fileSettings.fontSettings,
      });
      // Sync localStorage cache
      configService.saveToLocalStorage(fileSettings);
    } else {
      // File doesn't exist → migrate current state (from localStorage) to file
      const state = get();
      await configService.saveToFile({
        columnColors: state.columnColors,
        slashCommands: state.slashCommands,
        theme: state.theme,
        columnOrder: state.columnOrder,
        fontSettings: state.fontSettings,
      });
    }
  },
}));
