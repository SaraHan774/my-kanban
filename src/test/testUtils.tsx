import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Page } from '@/types';

/** Render with BrowserRouter wrapper */
export function renderWithRouter(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, {
    wrapper: ({ children }) => <BrowserRouter>{children}</BrowserRouter>,
    ...options,
  });
}

/** Create a mock Page with sensible defaults */
export function createMockPage(overrides: Partial<Page> = {}): Page {
  return {
    id: crypto.randomUUID(),
    title: 'Mock Page',
    tags: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    viewType: 'document',
    path: 'workspace/Mock Page',
    content: 'Mock content',
    ...overrides,
  };
}
