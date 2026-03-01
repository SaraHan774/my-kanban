# Highlight Test Plan - Ordered List & Table Issue

## Quick Diagnosis Script

Add this to browser console when viewing a page with lists/tables:

```javascript
// Get the content element
const contentEl = document.querySelector('.content');

// Check what textContent actually contains
console.log('=== TEXT CONTENT ===');
console.log(contentEl.textContent);

// Check HTML structure
console.log('=== HTML STRUCTURE ===');
console.log(contentEl.innerHTML.substring(0, 500));

// Simulate selection
const selection = window.getSelection();
if (selection.rangeCount > 0) {
  const range = selection.getRangeAt(0);
  console.log('=== SELECTION ===');
  console.log('Selected text:', range.toString());
  console.log('Start container:', range.startContainer);
  console.log('End container:', range.endContainer);
}
```

## Key Insight: CSS-Generated Content

### The Problem
Ordered lists use CSS counter for numbering:
```css
ol {
  counter-reset: list-counter;
}
ol li::before {
  content: counter(list-counter) ". ";
  counter-increment: list-counter;
}
```

**This means:**
- User sees: "1. First item"
- But `textContent` only has: "First item"
- **The number is CSS-generated, not in the DOM!**

### Test This
1. Create a page with:
```md
1. First item
2. Second item
```

2. Inspect in browser:
```html
<ol>
  <li>First item</li>  <!-- No "1." in actual text! -->
  <li>Second item</li>
</ol>
```

3. Try to highlight "First item" → Should WORK ✅
4. Try to highlight "1. First" → Will FAIL ❌ (because "1." doesn't exist in textContent)

## Root Cause Analysis

### Scenario 1: User Selects Pure Text (WORKS)
```
User selects: "First item"
range.toString(): "First item"
contentEl.textContent: "First itemSecond item"
Match: SUCCESS ✅
```

### Scenario 2: User Selects Including CSS Content (FAILS)
```
User selects: "1. First item" (visually)
range.toString(): "First item" (CSS content not included)
Saved highlight.text: "First item"
contentEl.textContent: "First itemSecond item"
Match: Should work, BUT...
```

**Wait!** If `range.toString()` doesn't include CSS content, why does it fail?

### Scenario 3: The Real Issue - Whitespace Collapsing

**Markdown:**
```md
1. First item
2. Second item
```

**HTML rendering:**
```html
<ol>
  <li>First item</li>
  <li>Second item</li>
</ol>
```

**contentEl.textContent:**
```
First itemSecond item
```
⚠️ **NO SPACE OR NEWLINE BETWEEN ITEMS!**

But when creating the highlight, we might be calculating offsets based on the markdown source, which HAS newlines!

### Scenario 4: Table Cell Spacing

**Markdown:**
```md
| A | B |
|---|---|
| 1 | 2 |
```

**contentEl.textContent:**
```
AB12
```
⚠️ **NO SEPARATORS!**

If user selects "A", we save:
- text: "A"
- startOffset: 0
- endOffset: 1
- contextBefore: ""
- contextAfter: "B12..."

When re-rendering, we look for "A" with context "B12", which will match.
But if the table structure changes, offsets will be wrong.

## Execution Path Trace

### Step 1: User Creates Highlight
```typescript
// PageView.tsx - applyHighlight()
const { startOffset, endOffset, trimmedText } = highlightService.calculateTextOffsets(range, contentEl);
// trimmedText = "First item"
// startOffset = 0 (in the <li> element's textContent)
// endOffset = 10

const plainText = contentEl.textContent || '';
// plainText = "First itemSecond item" (no spaces!)

const { contextBefore, contextAfter } = highlightService.extractHighlightContext(
  plainText, startOffset, endOffset
);
// contextBefore = "" (nothing before)
// contextAfter = "Second item"

const { firstWords, lastWords } = highlightService.extractAnchorWords(trimmedText);
// firstWords = "First item"
// lastWords = "First item" (same, because it's only 2 words)
```

### Step 2: Page Re-renders
```typescript
// highlightService.ts - applyHighlightsToHtml()
const tempDiv = document.createElement('div');
tempDiv.innerHTML = html; // HTML from markdown rendering

const fullText = tempDiv.textContent || '';
// fullText = "First itemSecond item"

// Try to match
const match = matchByFirstLastWords(
  normalizedText,  // "First itemSecond item"
  fullText,
  "First item",    // firstWords
  "First item",    // lastWords (same)
  positionMap,
  wordIndex
);
```

**This SHOULD work!** So why doesn't it?

## Hypothesis: The Issue is in Markdown → HTML Conversion

Let me check if there's a mismatch between:
1. `contentEl.textContent` when creating the highlight (live DOM)
2. `tempDiv.textContent` when re-rendering (from HTML string)

They might be different because:
- Live DOM might have extra whitespace nodes
- HTML parsing might normalize differently
- Mermaid blocks or other special elements might be handled differently

## Next Steps

1. **Enable debug mode** and create a highlight in a list
2. **Check console** for:
   ```
   [HIGHLIGHT CREATE] { text: "...", firstWords: "...", ... }
   [HIGHLIGHT MATCH] Attempting firstWords/lastWords { ... }
   [HIGHLIGHT MATCH] ✗ Failed ...
   ```
3. **Compare** what text was saved vs what text exists in rendered HTML
4. **Identify** the exact mismatch

## Potential Fix

If the issue is whitespace between list items, we can improve `normalizeWhitespace`:

```typescript
// Current
export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

// Enhanced for lists/tables
export function normalizeWhitespace(text: string): string {
  return text
    .replace(/\s+/g, ' ')  // Collapse all whitespace
    .replace(/>\s+</g, '><')  // Remove space between tags (if any)
    .trim();
}
```

Or, add spaces between block elements when extracting textContent:

```typescript
// In applyHighlightsToHtml, before getting textContent
const blockElements = tempDiv.querySelectorAll('li, td, th, p, div');
blockElements.forEach(el => {
  // Add space after each block element
  const lastChild = el.lastChild;
  if (lastChild && lastChild.nodeType === Node.TEXT_NODE) {
    lastChild.textContent += ' ';
  }
});

const fullText = tempDiv.textContent || '';
```

This would make "First itemSecond item" become "First item Second item".
