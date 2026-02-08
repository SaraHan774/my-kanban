/**
 * Global application state using Zustand
 */

import { create } from 'zustand';
import { Page, AppConfig, DEFAULT_CONFIG, SortOptions } from '@/types';
import { AppSlashCommand, DEFAULT_SLASH_COMMANDS } from '@/data/defaultSlashCommands';

const SLASH_COMMANDS_KEY = 'kanban-slash-commands';

const loadSlashCommands = (): AppSlashCommand[] => {
  try {
    const stored = localStorage.getItem(SLASH_COMMANDS_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return DEFAULT_SLASH_COMMANDS;
};

const saveSlashCommands = (commands: AppSlashCommand[]) => {
  localStorage.setItem(SLASH_COMMANDS_KEY, JSON.stringify(commands));
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

  // Slash commands
  slashCommands: AppSlashCommand[];
  addSlashCommand: (cmd: AppSlashCommand) => void;
  updateSlashCommand: (cmd: AppSlashCommand) => void;
  removeSlashCommand: (id: string) => void;
  resetSlashCommands: () => void;
}

export const useStore = create<AppState>((set) => ({
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

  // Slash commands
  slashCommands: loadSlashCommands(),
  addSlashCommand: (cmd) =>
    set((state) => {
      const updated = [...state.slashCommands, cmd];
      saveSlashCommands(updated);
      return { slashCommands: updated };
    }),
  updateSlashCommand: (cmd) =>
    set((state) => {
      const updated = state.slashCommands.map((c) => (c.id === cmd.id ? cmd : c));
      saveSlashCommands(updated);
      return { slashCommands: updated };
    }),
  removeSlashCommand: (id) =>
    set((state) => {
      const updated = state.slashCommands.filter((c) => c.id !== id);
      saveSlashCommands(updated);
      return { slashCommands: updated };
    }),
  resetSlashCommands: () =>
    set(() => {
      saveSlashCommands(DEFAULT_SLASH_COMMANDS);
      return { slashCommands: DEFAULT_SLASH_COMMANDS };
    }),
}));
