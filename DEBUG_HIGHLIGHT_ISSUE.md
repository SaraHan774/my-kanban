# Highlight Debug - Ordered List & Table Issue Analysis

## Potential Root Causes

### 1. **Text Content Mismatch**
When markdown is rendered to HTML, the plain text extraction might not match the original:

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

**contentEl.textContent result:**
```
First item
Second item
```
⚠️ **The list numbers are LOST!** If user selected "1. First item", we save that text, but the rendered HTML doesn't have "1."

### 2. **TreeWalker Text Node Traversal**
Tables have complex structure with many nested elements:

**Markdown:**
```md
| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
```

**HTML:**
```html
<table>
  <thead><tr><th>Header 1</th><th>Header 2</th></tr></thead>
  <tbody><tr><td>Cell 1</td><td>Cell 2</td></tr></tbody>
</table>
```

**contentEl.textContent result:**
```
Header 1Header 2Cell 1Cell 2
```
⚠️ **No spaces between cells!** Text offset calculations will be wrong.

### 3. **Position Map Issues**
Our position map assumes linear text flow, but HTML structure breaks this:

```
<li>Text <strong>bold</strong> more</li>
```

TreeWalker visits: ["Text ", "bold", " more"] as separate text nodes
But we calculate offsets as if it's one continuous string.

## Execution Paths to Check

### Path 1: Highlight Creation (applyHighlight)
```typescript
// In PageView.tsx, line ~475
const { startOffset, endOffset, trimmedText } = highlightService.calculateTextOffsets(range, contentEl);
const plainText = contentEl.textContent || '';
```

**Issue:** `range.toString()` gives selected text, but `contentEl.textContent` might be different due to:
- List markers removed
- Table cell spacing collapsed
- Line breaks normalized

### Path 2: Highlight Rendering (applyHighlightsToHtml)
```typescript
// In highlightService.ts
const fullText = tempDiv.textContent || '';
const normalizedText = normalizeWhitespace(fullText);
```

**Issue:** When we try to match `highlight.text` against `fullText`:
- If `highlight.text` = "1. First item" (from user selection)
- But `fullText` = "First item" (from HTML rendering)
- Match will FAIL!

### Path 3: Text Matching Strategies
```typescript
// Strategy 1: firstWords/lastWords
const match = matchByFirstLastWords(normalizedText, fullText, firstWords, lastWords, ...);

// Strategy 2: Context
const startPos = matchByContext(fullText, normalizedText, searchText, contextBefore, contextAfter, ...);

// Strategy 3: Fuzzy
const fuzzyMatchPos = fuzzyMatch(normalizedText, normalizedSearchText, uniqueWordIndex);
```

**Issue:** All strategies assume the text is findable. But if the original text had:
- List markers ("1. ", "2. ")
- Table cell separators
- Blockquote markers ("> ")

These will be missing in the rendered HTML's textContent.

## Diagnostic Steps

### Step 1: Enable Debug Mode
Press **Cmd+Shift+D** in the app and check console for:
```
[HIGHLIGHT CREATE] { text, firstWords, lastWords, startOffset, endOffset, contextBefore, contextAfter }
```

Compare `text` with what's actually in the rendered HTML.

### Step 2: Check Text Content Extraction
Add logging to see what `contentEl.textContent` actually contains:
```typescript
console.log('Range text:', range.toString());
console.log('Container text:', containerEl.textContent);
```

### Step 3: Verify Matching Strategy
Check which strategy is being attempted:
```
[HIGHLIGHT MATCH] Attempting firstWords/lastWords
[HIGHLIGHT MATCH] ✗ Failed to find firstWords
```

If all 3 strategies fail, the text literally doesn't exist in the rendered HTML.

## Potential Solutions

### Solution 1: Strip Markdown Formatting from Saved Text
When creating highlight, detect and remove markdown formatting:
```typescript
const cleanText = trimmedText
  .replace(/^\d+\.\s+/, '')  // Remove list numbers
  .replace(/^>\s+/, '')       // Remove blockquote markers
  .replace(/^\*\s+/, '')      // Remove bullet points
```

### Solution 2: Use More Context
Increase context window from 20 to 50 characters:
```typescript
highlightService.extractHighlightContext(plainText, startOffset, endOffset, 50);
```

### Solution 3: Improve Text Node Traversal
Handle structured content differently:
- Detect if selection spans multiple `<li>` elements
- Adjust text extraction to account for table cells
- Insert virtual spaces between cells/rows

### Solution 4: Fallback to Position-Only Matching
If text matching fails, fall back to:
```typescript
// Use saved startOffset/endOffset directly
// But this breaks if document is edited
```

## Test Cases

Create a test page with:
```md
# Test Page

## Ordered List
1. First item with **bold**
2. Second item with [link](url)
3. Third item

## Table
| Column A | Column B |
|----------|----------|
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |

## Nested List
1. Parent item
   - Child item 1
   - Child item 2
2. Another parent
```

Try highlighting:
- [ ] "First item with bold" (across formatting)
- [ ] "Column A" (table header)
- [ ] "Cell 1" → "Cell 2" (across table cells)
- [ ] "Child item 1" (nested list)

Check debug console for each attempt.
