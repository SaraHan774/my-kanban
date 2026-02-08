import { describe, it, expect, beforeEach } from 'vitest';
import { MarkdownService } from '../markdown';

describe('MarkdownService', () => {
  let service: MarkdownService;

  beforeEach(() => {
    service = new MarkdownService();
  });

  describe('parse', () => {
    it('should parse markdown with YAML frontmatter', () => {
      const md = `---
id: "test-id"
title: "Test Page"
tags: ["a", "b"]
createdAt: "2024-01-01T00:00:00.000Z"
updatedAt: "2024-01-01T00:00:00.000Z"
viewType: "document"
---

# Test Page

Content here.`;

      const result = service.parse(md, 'workspace/Test');

      expect(result.frontmatter.id).toBe('test-id');
      expect(result.frontmatter.title).toBe('Test Page');
      expect(result.frontmatter.tags).toEqual(['a', 'b']);
      expect(result.frontmatter.viewType).toBe('document');
      expect(result.content).toContain('# Test Page');
      expect(result.path).toBe('workspace/Test');
    });

    it('should normalise missing fields with defaults', () => {
      const md = `---
title: "Minimal"
---

Content.`;
      const result = service.parse(md, 'workspace/Min');

      expect(result.frontmatter.id).toBeDefined();
      expect(result.frontmatter.tags).toEqual([]);
      expect(result.frontmatter.viewType).toBe('document');
    });
  });

  describe('serialize', () => {
    it('should round-trip through parse → serialize → parse', () => {
      const original = `---
id: "rt-id"
title: "Round Trip"
tags: ["x"]
createdAt: "2024-01-01T00:00:00.000Z"
updatedAt: "2024-01-01T00:00:00.000Z"
viewType: "document"
---

# Round Trip

Body.`;

      const parsed = service.parse(original, 'p');
      const serialized = service.serialize(parsed.frontmatter, parsed.content);
      const reparsed = service.parse(serialized, 'p');

      expect(reparsed.frontmatter.id).toBe('rt-id');
      expect(reparsed.frontmatter.title).toBe('Round Trip');
      expect(reparsed.content).toBe(parsed.content);
    });
  });

  describe('toHtml', () => {
    it('should convert markdown heading to HTML', async () => {
      const html = await service.toHtml('# Hello');
      expect(html).toContain('<h1>');
      expect(html).toContain('Hello');
    });
  });

  describe('getExcerpt', () => {
    it('should strip markdown syntax and truncate', () => {
      const excerpt = service.getExcerpt('**bold** and *italic*', 10);
      expect(excerpt).not.toContain('**');
      expect(excerpt.length).toBeLessThanOrEqual(13); // 10 + '...'
    });

    it('should return empty string for empty input', () => {
      expect(service.getExcerpt('')).toBe('');
    });
  });
});
