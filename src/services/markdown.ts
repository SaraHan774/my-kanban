/**
 * Markdown Service
 * Handles parsing and serializing markdown files with YAML frontmatter
 */

import matter from 'gray-matter';
import { marked } from 'marked';
import { PageFrontmatter, RawPageData } from '@/types';

export class MarkdownService {
  /**
   * Parse a markdown file with frontmatter
   * @param content - Raw markdown content with frontmatter
   * @param path - File path (for metadata)
   */
  parse(content: string, path: string): RawPageData {
    const { data, content: markdownContent } = matter(content);

    return {
      frontmatter: this.normalizeFrontmatter(data),
      content: markdownContent.trim(),
      path
    };
  }

  /**
   * Serialize frontmatter and content back to markdown
   * @param frontmatter - Page frontmatter
   * @param content - Markdown content
   */
  serialize(frontmatter: PageFrontmatter, content: string): string {
    return matter.stringify(content, frontmatter);
  }

  /**
   * Convert markdown to HTML
   * @param markdown - Markdown content
   */
  async toHtml(markdown: string): Promise<string> {
    return marked(markdown);
  }

  /**
   * Normalize frontmatter data to ensure all required fields exist
   * @private
   */
  private normalizeFrontmatter(data: any): PageFrontmatter {
    const now = new Date().toISOString();

    return {
      id: data.id || crypto.randomUUID(),
      title: data.title || 'Untitled',
      tags: Array.isArray(data.tags) ? data.tags : [],
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now,
      viewType: data.viewType || 'document',
      ...(data.dueDate && { dueDate: data.dueDate }),
      ...(data.kanbanColumn && { kanbanColumn: data.kanbanColumn }),
      ...(data.kanbanColumns && { kanbanColumns: data.kanbanColumns }),
      ...(data.pomodoroSessions && { pomodoroSessions: data.pomodoroSessions }),
      ...(data.googleCalendarEventId && { googleCalendarEventId: data.googleCalendarEventId })
    };
  }

  /**
   * Extract plain text excerpt from markdown (for card previews)
   * @param markdown - Markdown content
   * @param maxLength - Maximum length of excerpt
   */
  getExcerpt(markdown: string, maxLength: number = 150): string {
    // Remove markdown syntax for plain text
    let text = markdown
      .replace(/#{1,6}\s+/g, '') // Headers
      .replace(/\*\*(.+?)\*\*/g, '$1') // Bold
      .replace(/\*(.+?)\*/g, '$1') // Italic
      .replace(/`(.+?)`/g, '$1') // Inline code
      .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Links
      .replace(/```[\s\S]*?```/g, '[code]') // Code blocks
      .replace(/\n+/g, ' ') // Newlines
      .trim();

    if (text.length > maxLength) {
      text = text.substring(0, maxLength) + '...';
    }

    return text;
  }
}

// Singleton instance
export const markdownService = new MarkdownService();
