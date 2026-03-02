import { marked } from 'marked';

export interface TocHeading {
  id: string;        // URL-safe slug (e.g., "introduction", "api-overview-1")
  text: string;      // Display text
  level: number;     // 1-6 (h1-h6)
  rawText: string;   // Original markdown text
}

export class TocService {
  /**
   * Extract headings from markdown content
   * @param markdown - Raw markdown text
   * @returns Array of TocHeading objects with unique IDs
   */
  extractHeadings(markdown: string): TocHeading[] {
    const tokens = marked.lexer(markdown);
    const headings: TocHeading[] = [];
    const slugCounts = new Map<string, number>();

    for (const token of tokens) {
      if (token.type === 'heading') {
        const slug = this.generateSlug(token.text);
        const count = slugCounts.get(slug) || 0;
        slugCounts.set(slug, count + 1);
        const id = count > 0 ? `${slug}-${count}` : slug;

        headings.push({
          id,
          text: token.text,
          level: token.depth,
          rawText: token.text
        });
      }
    }

    return headings;
  }

  /**
   * Generate URL-safe slug from heading text
   * @param text - Heading text
   * @returns Lowercase slug with hyphens
   */
  generateSlug(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')  // Remove special chars
      .replace(/\s+/g, '-')      // Spaces to hyphens
      .replace(/-+/g, '-')       // Collapse multiple hyphens
      .replace(/^-+|-+$/g, '')   // Trim leading/trailing hyphens
      .trim();
  }
}

// Singleton instance
export const tocService = new TocService();
