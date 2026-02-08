import { ViewType } from './page';

/**
 * Filter criteria for searching and filtering pages
 */
export interface FilterCriteria {
  tags?: string[];  // OR logic: match any tag
  dateRange?: DateRangeFilter;
  searchText?: string;  // Full-text search in title + content
  viewType?: ViewType[];
  hasChildren?: boolean;  // Filter pages with/without sub-pages
}

/**
 * Date range filter
 */
export interface DateRangeFilter {
  start?: string;  // ISO 8601
  end?: string;
  field: 'createdAt' | 'updatedAt' | 'dueDate';
}

/**
 * Sort options
 */
export interface SortOptions {
  field: 'title' | 'createdAt' | 'updatedAt' | 'dueDate';
  direction: 'asc' | 'desc';
}
