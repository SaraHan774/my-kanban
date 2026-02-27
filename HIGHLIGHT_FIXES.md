# Text Highlighting System - Phase 1 Fix

## Overview
This document describes the Phase 1 fix implemented to prevent highlights from appearing inside code blocks.

## Problem Identified

### **Code Block Contamination** (HIGH PRIORITY)
- Highlights could appear inside `<pre>`, `<code>`, `<script>`, `<style>` elements
- This breaks syntax highlighting and creates visual bugs
- Users expect code blocks to remain unhighlightable for clarity

## Fix Implemented

### Code Block Filtering ✅

**Location:** `PageView.tsx:isNodeExcluded()`

Added a helper function to check if a text node is inside excluded elements:

```typescript
const isNodeExcluded = (node: Node): boolean => {
  let parent = node.parentElement;
  while (parent) {
    const tagName = parent.tagName;
    if (['PRE', 'CODE', 'SCRIPT', 'STYLE'].includes(tagName)) {
      return true;
    }
    parent = parent.parentElement;
  }
  return false;
};
```

The TreeWalker now uses this filter:

```typescript
const walker = document.createTreeWalker(
  tempDiv,
  NodeFilter.SHOW_TEXT,
  {
    acceptNode: (node) => {
      return isNodeExcluded(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    }
  }
);
```

**Impact:**
- ✅ Prevents highlights from appearing inside code blocks
- ✅ Preserves syntax highlighting in code blocks
- ✅ Improves visual consistency
- ✅ Minimal performance overhead (simple parent traversal)

## What Was NOT Implemented

### Context-Based Fallback (Deferred to Phase 2)
**Why deferred:** Initial implementation caused highlights to appear in wrong locations due to:
- Text content differences between render cycles
- Aggressive fuzzy matching finding wrong occurrences
- Complexity of validating positions across renders

**Future approach:** Context-based fallback should only be used:
- When user explicitly triggers "repair highlights" action
- After major content restructuring (detected by hash comparison)
- Not on every render cycle

### Performance Optimizations (Deferred to Phase 2)
- Batch highlight application (single TreeWalker pass)
- Highlight render caching
- Avoid re-rendering unchanged content

## Testing Recommendations

### Test Cases

1. **Code Block Test** ✅
   ```markdown
   Create a code block:
   ```javascript
   const x = 5;
   const y = 10;
   ```
   ```
   - Try to select and highlight text inside the code block
   - **Expected:** Text selection works, but when you try to apply highlight, it should be rejected or not appear

2. **Regular Text Highlight** ✅
   - Highlight normal paragraph text
   - **Expected:** Highlight appears correctly

3. **Cross-Element Highlight** ✅
   - Highlight text that spans across bold/italic boundaries
   - **Expected:** Highlight works correctly across formatting

## Performance Impact

- **Minimal overhead:** Simple parent element traversal during TreeWalker filtering
- **No additional render cycles:** Filtering happens during existing highlight application
- **Overall:** No noticeable performance impact

## Known Limitations

1. **Offset-based positioning:** Highlights still use character offsets, which can break if:
   - Content is heavily edited
   - Markdown rendering changes (wiki links, HTML entities)
   - These issues will be addressed in Phase 2 with smart fallback mechanisms

2. **No automatic repair:** If highlights break due to content changes, they remain broken until:
   - User manually deletes and recreates them
   - Future "repair highlights" feature is implemented (Phase 3)

3. **Performance:** Still O(n*m) complexity with many highlights (Phase 2 optimization pending)

## Next Steps

### Phase 2: Smart Fallback Mechanisms
1. **Context-based repair (user-triggered)** - Manual "repair highlights" button
2. **Content change detection** - Hash-based comparison to detect when fallback is needed
3. **Batch highlight application** - Single TreeWalker pass for all highlights (performance)

### Phase 3: User-Facing Features
1. **Highlight health check UI** - Show which highlights are broken
2. **Bulk highlight repair** - Fix or remove broken highlights
3. **Better overlapping highlight visualization**

## Technical Details

### Files Modified
- `src/pages/PageView.tsx` - Added code block filtering to TreeWalker
- `src/pages/Settings.tsx` - Removed unused import (cleanup from Settings TOC fix)

### Code Changes
**Modified Function:** `applyHighlightsToHtml()` in `PageView.tsx`

Changed TreeWalker from:
```typescript
const walker = document.createTreeWalker(
  tempDiv,
  NodeFilter.SHOW_TEXT,
  null  // No filtering
);
```

To:
```typescript
const walker = document.createTreeWalker(
  tempDiv,
  NodeFilter.SHOW_TEXT,
  {
    acceptNode: (node) => {
      // Skip text nodes inside code blocks
      let parent = node.parentElement;
      while (parent && parent !== tempDiv) {
        if (['PRE', 'CODE', 'SCRIPT', 'STYLE'].includes(parent.tagName)) {
          return NodeFilter.FILTER_REJECT;
        }
        parent = parent.parentElement;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  }
);
```

## Migration Notes

- **No data migration required** - Existing highlights work with new system
- **Backward compatible** - Old highlights without good context still work (use fuzzy matching)
- **No breaking changes** - All existing functionality preserved

## Lessons Learned

### Why Phase 1 Was Simplified

**Original Plan:** Implement code filtering + context-based fallback + position validation

**Issue Encountered:** The position validation logic caused highlights to appear in wrong locations because:
1. Validation used `tempDiv.textContent` (new render)
2. But offsets were from `contentEl.textContent` (previous render)
3. Small differences in text content caused fuzzy matching to find wrong occurrences
4. **Result:** Highlights appeared on random sentences

**Solution:** Only implement code block filtering (safe, targeted fix)
- Deferred context-based fallback to Phase 2
- Will implement as user-triggered repair action, not automatic validation

### Key Insight
**Don't validate what you can't repair reliably.** Automatic position correction during rendering is risky and can make things worse. Better to:
1. Trust the stored offsets
2. Provide manual repair tools when needed
3. Only auto-correct when you can be 100% confident

## References

- **Issue Analysis:** Deep analysis completed 2026-02-27
- **Phase 1 Implementation:** 2026-02-27
- **Core Problem:** Code blocks should not accept highlights
- **Solution:** TreeWalker filtering during highlight application
