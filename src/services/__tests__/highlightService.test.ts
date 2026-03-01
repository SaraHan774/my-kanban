import { describe, it, expect } from 'vitest';
import {
  normalizeWhitespace,
  buildPositionMap,
  buildWordIndex,
  matchByFirstLastWords,
  matchByContext,
  fuzzyMatch,
} from '../highlightService';

describe('highlightService - Pure Functions', () => {
  describe('normalizeWhitespace', () => {
    it('collapses multiple spaces into one', () => {
      expect(normalizeWhitespace('hello  world')).toBe('hello world');
    });

    it('collapses tabs and newlines', () => {
      expect(normalizeWhitespace('hello\t\nworld')).toBe('hello world');
    });

    it('trims leading and trailing whitespace', () => {
      expect(normalizeWhitespace('  hello world  ')).toBe('hello world');
    });

    it('handles mixed whitespace', () => {
      expect(normalizeWhitespace('hello   \t\n  world')).toBe('hello world');
    });

    it('handles empty string', () => {
      expect(normalizeWhitespace('')).toBe('');
    });

    it('handles only whitespace', () => {
      expect(normalizeWhitespace('   \t\n  ')).toBe('');
    });
  });

  describe('buildPositionMap', () => {
    it('maps positions for text with double spaces', () => {
      const text = 'hello  world';
      const map = buildPositionMap(text);
      // 'hello ' -> positions 0-5 (normalized: 0-5)
      // ' ' (second space) -> collapsed
      // 'world' -> positions 7-11 (normalized: 6-10)
      expect(map[0]).toBe(0); // 'h'
      expect(map[5]).toBe(5); // first space
      expect(map[6]).toBe(7); // 'w' (skips second space)
    });

    it('maps positions for text with tabs', () => {
      const text = 'hello\tworld';
      const map = buildPositionMap(text);
      expect(map[5]).toBe(5); // tab position
      expect(map[6]).toBe(6); // 'w'
    });

    it('handles single character', () => {
      const text = 'a';
      const map = buildPositionMap(text);
      expect(map[0]).toBe(0);
    });

    it('handles consecutive whitespace', () => {
      const text = 'a   b';
      const map = buildPositionMap(text);
      expect(map[0]).toBe(0); // 'a'
      expect(map[1]).toBe(1); // first space
      expect(map[2]).toBe(4); // 'b' (skips two spaces)
    });
  });

  describe('buildWordIndex', () => {
    it('indexes single occurrence of each word', () => {
      const text = 'the quick brown fox';
      const index = buildWordIndex(text);
      expect(index.get('the')).toEqual([0]);
      expect(index.get('quick')).toEqual([4]);
      expect(index.get('brown')).toEqual([10]);
      expect(index.get('fox')).toEqual([16]);
    });

    it('indexes multiple occurrences of same word', () => {
      const text = 'the quick brown fox jumps over the lazy dog';
      const index = buildWordIndex(text);
      // 'the' at position 0, and 'the' at position 31 (after "over ")
      expect(index.get('the')).toEqual([0, 31]);
    });

    it('handles empty string', () => {
      const index = buildWordIndex('');
      expect(index.size).toBe(0);
    });

    it('handles single word', () => {
      const index = buildWordIndex('hello');
      expect(index.get('hello')).toEqual([0]);
    });

    it('ignores empty words from consecutive spaces', () => {
      const text = normalizeWhitespace('hello  world');
      const index = buildWordIndex(text);
      expect(index.size).toBe(2);
      expect(index.get('hello')).toEqual([0]);
      expect(index.get('world')).toEqual([6]);
    });
  });
});

describe('highlightService - Matching Strategies', () => {
  describe('matchByFirstLastWords', () => {
    it('finds text using first and last words', () => {
      const fullText = 'The quick brown fox jumps over the lazy dog';
      const normalizedText = normalizeWhitespace(fullText);
      const positionMap = buildPositionMap(fullText);
      const wordIndex = buildWordIndex(normalizedText);

      const result = matchByFirstLastWords(
        normalizedText,
        fullText,
        'quick brown',
        'lazy dog',
        positionMap,
        wordIndex
      );

      expect(result).not.toBeNull();
      expect(result!.startPos).toBe(4); // 'quick' starts at position 4
      expect(result!.endPos).toBe(43); // end of 'dog'
    });

    it('finds text with word index optimization', () => {
      const fullText = 'Hello world, this is a test. Hello again!';
      const normalizedText = normalizeWhitespace(fullText);
      const positionMap = buildPositionMap(fullText);
      const wordIndex = buildWordIndex(normalizedText);

      // First occurrence of 'Hello'
      const result = matchByFirstLastWords(
        normalizedText,
        fullText,
        'Hello world',
        'a test',
        positionMap,
        wordIndex
      );

      expect(result).not.toBeNull();
      expect(result!.startPos).toBe(0);
    });

    it('returns null when first words not found', () => {
      const fullText = 'The quick brown fox';
      const normalizedText = normalizeWhitespace(fullText);
      const positionMap = buildPositionMap(fullText);
      const wordIndex = buildWordIndex(normalizedText);

      const result = matchByFirstLastWords(
        normalizedText,
        fullText,
        'not present',
        'fox',
        positionMap,
        wordIndex
      );

      expect(result).toBeNull();
    });

    it('returns null when last words not found after first words', () => {
      const fullText = 'The quick brown fox jumps';
      const normalizedText = normalizeWhitespace(fullText);
      const positionMap = buildPositionMap(fullText);
      const wordIndex = buildWordIndex(normalizedText);

      const result = matchByFirstLastWords(
        normalizedText,
        fullText,
        'quick',
        'dog', // not present
        positionMap,
        wordIndex
      );

      expect(result).toBeNull();
    });

    it('handles text with extra whitespace', () => {
      const fullText = 'The  quick   brown fox jumps';
      const normalizedText = normalizeWhitespace(fullText);
      const positionMap = buildPositionMap(fullText);
      const wordIndex = buildWordIndex(normalizedText);

      const result = matchByFirstLastWords(
        normalizedText,
        fullText,
        'quick brown',
        'fox jumps', // Non-overlapping with first words
        positionMap,
        wordIndex
      );

      expect(result).not.toBeNull();
    });
  });

  describe('matchByContext', () => {
    it('finds text with exact context match', () => {
      const fullText = 'Hello world, this is a test message here';
      const normalizedText = normalizeWhitespace(fullText);
      const positionMap = buildPositionMap(fullText);

      const startPos = matchByContext(
        fullText,
        normalizedText,
        'test',
        'this is a ',
        ' message',
        positionMap
      );

      // 'Hello world, this is a test message here'
      //  0         1         2         3
      //  01234567890123456789012345678901234567890
      //                       ^ position 21
      expect(startPos).toBe(23); // 'test' starts at 23
    });

    it('finds text with normalized whitespace context', () => {
      const fullText = 'Hello  world,  this  is  a  test  message  here';
      const normalizedText = normalizeWhitespace(fullText);
      const positionMap = buildPositionMap(fullText);

      const startPos = matchByContext(
        fullText,
        normalizedText,
        'test',
        'this is a ',
        ' message',
        positionMap
      );

      expect(startPos).toBeGreaterThan(0);
    });

    it('returns -1 when context not found', () => {
      const fullText = 'Hello world';
      const normalizedText = normalizeWhitespace(fullText);
      const positionMap = buildPositionMap(fullText);

      const startPos = matchByContext(
        fullText,
        normalizedText,
        'test',
        'not present',
        'context',
        positionMap
      );

      expect(startPos).toBe(-1);
    });

    it('handles empty context', () => {
      const fullText = 'Hello world test message';
      const normalizedText = normalizeWhitespace(fullText);
      const positionMap = buildPositionMap(fullText);

      const startPos = matchByContext(
        fullText,
        normalizedText,
        'test',
        '',
        '',
        positionMap
      );

      expect(startPos).toBe(12); // 'test' at position 12
    });
  });

  describe('fuzzyMatch', () => {
    it('matches text with identical content', () => {
      const text = 'The quick brown fox';
      const search = 'quick brown';

      const result = fuzzyMatch(text, search, 4);
      expect(result).toBe(4);
    });

    it('handles whitespace differences in search text', () => {
      const text = 'Thequickbrownfox';
      const search = 'quick brown fox';

      const result = fuzzyMatch(text, search, 3);
      expect(result).toBe(3);
    });

    it('handles whitespace differences in target text', () => {
      const text = 'The quick  brown  fox'; // Extra spaces
      const search = 'quick brown fox';

      const result = fuzzyMatch(text, search, 4);
      expect(result).toBe(4);
    });

    it('returns -1 when characters do not match', () => {
      const text = 'The quick brown fox';
      const search = 'quick yellow';

      const result = fuzzyMatch(text, search, 4);
      expect(result).toBe(-1);
    });

    it('returns -1 when search text is longer than remaining text', () => {
      const text = 'The quick';
      const search = 'quick brown fox';

      const result = fuzzyMatch(text, search, 4);
      expect(result).toBe(-1);
    });

    it('handles mixed whitespace types', () => {
      const text = 'The\tquick\nbrown fox';
      const search = 'quick brown fox';

      const result = fuzzyMatch(text, search, 4);
      expect(result).toBe(4);
    });

    it('matches at start position', () => {
      const text = 'quick brown fox';
      const search = 'quick';

      const result = fuzzyMatch(text, search, 0);
      expect(result).toBe(0);
    });
  });
});

describe('highlightService - Integration', () => {
  it('combines strategies to find text robustly', () => {
    const fullText = 'The  quick   brown fox jumps over the lazy dog';
    const normalizedText = normalizeWhitespace(fullText);
    const positionMap = buildPositionMap(fullText);
    const wordIndex = buildWordIndex(normalizedText);

    // Should find using firstWords/lastWords even with whitespace differences
    const result = matchByFirstLastWords(
      normalizedText,
      fullText,
      'quick brown',
      'lazy dog',
      positionMap,
      wordIndex
    );

    expect(result).not.toBeNull();
  });
});
