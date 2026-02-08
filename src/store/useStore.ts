/**
 * Global application state using Zustand
 */

import { create } from 'zustand';
import { Page, AppConfig, DEFAULT_CONFIG } from '@/types';

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

  // Active pomodoro
  activePomodoroPageId: string | null;
  setActivePomodoroPageId: (pageId: string | null) => void;

  // Filter state
  activeFilters: {
    tags: string[];
    searchText: string;
  };
  setActiveFilters: (filters: { tags: string[]; searchText: string }) => void;
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

  // Active pomodoro
  activePomodoroPageId: null,
  setActivePomodoroPageId: (pageId) => set({ activePomodoroPageId: pageId }),

  // Filter state
  activeFilters: {
    tags: [],
    searchText: ''
  },
  setActiveFilters: (filters) => set({ activeFilters: filters })
}));
