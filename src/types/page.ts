/**
 * Core Page interface - represents a page/card in the system
 *
 * Kanban model:
 *  - A board page has viewType='kanban'. Its `tags` define the columns.
 *  - A card (child of a board) has `kanbanColumn` set to one of the parent's tags.
 *  - The board can be displayed as kanban or list (UI toggle, not a separate type).
 */
export interface Page {
  // Metadata (stored in YAML frontmatter)
  id: string;
  title: string;
  tags: string[];               // On a board, these ARE the kanban columns
  createdAt: string;
  updatedAt: string;
  dueDate?: string;
  viewType: ViewType;
  kanbanColumn?: string;         // Which column this card belongs to (= one of parent's tags)
  googleCalendarEventId?: string;

  // Runtime properties (not stored in frontmatter)
  path: string;
  content: string;
  children?: Page[];
  parent?: Page;
}

/**
 * Page view types
 *  - 'document': a regular page (or a card inside a board)
 *  - 'kanban': a board whose children are grouped into columns by tags
 */
export type ViewType = 'document' | 'kanban';

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
