import { describe, it, expect } from 'vitest';
import { tocService } from './tocService';

describe('TocService', () => {
  describe('extractHeadings', () => {
    it('should extract headings from markdown', () => {
      const markdown = `
# Introduction
Some content here.

## Getting Started
More content.

### Installation
Details about installation.

## Usage
How to use it.
`;

      const headings = tocService.extractHeadings(markdown);

      expect(headings).toHaveLength(4);
      expect(headings[0]).toEqual({
        id: 'introduction',
        text: 'Introduction',
        level: 1,
        rawText: 'Introduction'
      });
      expect(headings[1]).toEqual({
        id: 'getting-started',
        text: 'Getting Started',
        level: 2,
        rawText: 'Getting Started'
      });
      expect(headings[2]).toEqual({
        id: 'installation',
        text: 'Installation',
        level: 3,
        rawText: 'Installation'
      });
      expect(headings[3]).toEqual({
        id: 'usage',
        text: 'Usage',
        level: 2,
        rawText: 'Usage'
      });
    });

    it('should handle duplicate headings with numeric suffixes', () => {
      const markdown = `
# Introduction
Some content.

## Overview
First overview.

## Overview
Second overview.

### Overview
Third overview (nested).
`;

      const headings = tocService.extractHeadings(markdown);

      expect(headings).toHaveLength(4);
      expect(headings[0].id).toBe('introduction');
      expect(headings[1].id).toBe('overview');
      expect(headings[2].id).toBe('overview-1');
      expect(headings[3].id).toBe('overview-2');
    });

    it('should handle special characters in headings', () => {
      const markdown = `
# React \`useState\` Hook
## API & Configuration
### Step 1: Installation
`;

      const headings = tocService.extractHeadings(markdown);

      expect(headings).toHaveLength(3);
      expect(headings[0].id).toBe('react-usestate-hook');
      expect(headings[1].id).toBe('api-configuration');
      expect(headings[2].id).toBe('step-1-installation');
    });

    it('should return empty array when no headings exist', () => {
      const markdown = 'Just some regular text without any headings.';
      const headings = tocService.extractHeadings(markdown);
      expect(headings).toHaveLength(0);
    });

    it('should handle all heading levels (h1-h6)', () => {
      const markdown = `
# Level 1
## Level 2
### Level 3
#### Level 4
##### Level 5
###### Level 6
`;

      const headings = tocService.extractHeadings(markdown);

      expect(headings).toHaveLength(6);
      expect(headings[0].level).toBe(1);
      expect(headings[1].level).toBe(2);
      expect(headings[2].level).toBe(3);
      expect(headings[3].level).toBe(4);
      expect(headings[4].level).toBe(5);
      expect(headings[5].level).toBe(6);
    });
  });

  describe('generateSlug', () => {
    it('should convert text to lowercase slug', () => {
      expect(tocService.generateSlug('Hello World')).toBe('hello-world');
    });

    it('should replace spaces with hyphens', () => {
      expect(tocService.generateSlug('Multiple   Spaces')).toBe('multiple-spaces');
    });

    it('should remove special characters', () => {
      expect(tocService.generateSlug('Hello! @World# $Test%')).toBe('hello-world-test');
    });

    it('should collapse multiple hyphens', () => {
      expect(tocService.generateSlug('Hello---World')).toBe('hello-world');
    });

    it('should trim leading and trailing hyphens', () => {
      expect(tocService.generateSlug('---Hello World---')).toBe('hello-world');
    });

    it('should handle code in backticks', () => {
      expect(tocService.generateSlug('Using `useState` Hook')).toBe('using-usestate-hook');
    });
  });
});
