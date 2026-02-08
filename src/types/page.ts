/**
 * Core Page interface - represents a page/card in the system
 * Every entity in the app is a Page (Notion-style unified model)
 */
export interface Page {
  // Metadata (stored in YAML frontmatter)
  id: string;  // UUID
  title: string;
  tags: string[];
  createdAt: string;  // ISO 8601
  updatedAt: string;
  dueDate?: string;
  viewType: ViewType;
  kanbanColumn?: string;  // ID of column this page is in (if parent is kanban)
  kanbanColumns?: KanbanColumn[];  // Columns if this page is a kanban board
  pomodoroSessions?: PomodoroSession[];
  googleCalendarEventId?: string;

  // Runtime properties (not stored in frontmatter)
  path: string;  // File system path (e.g., "workspace/Project A/Task 1")
  content: string;  // Markdown content (below frontmatter)
  children?: Page[];  // Sub-pages (dynamically loaded)
  parent?: Page;  // Parent page reference
}

/**
 * Page view types
 */
export type ViewType = 'document' | 'kanban' | 'list';

/**
 * Kanban column definition
 */
export interface KanbanColumn {
  id: string;
  name: string;
  order: number;
  color?: string;
}

/**
 * Pomodoro timer session
 */
export interface PomodoroSession {
  id: string;
  startTime: string;  // ISO 8601
  duration: number;  // minutes (25, 50, etc.)
  completed: boolean;
  notes?: string;
}

/**
 * Frontmatter interface - what gets serialized to YAML
 */
export interface PageFrontmatter {
  id: string;
  title: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  dueDate?: string;
  viewType: ViewType;
  kanbanColumn?: string;
  kanbanColumns?: KanbanColumn[];
  pomodoroSessions?: PomodoroSession[];
  googleCalendarEventId?: string;
}

/**
 * Raw page data from file system
 */
export interface RawPageData {
  frontmatter: PageFrontmatter;
  content: string;
  path: string;
}
