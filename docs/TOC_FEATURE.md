# Table of Contents Feature

## Overview
The Table of Contents (ToC) feature provides automatic heading navigation for long documents in PageView.

## Features
- ✅ **Automatic extraction** - Headings (h1-h6) are automatically detected from markdown
- ✅ **Hierarchical display** - Visual indentation shows heading structure
- ✅ **Quick navigation** - Click any heading to scroll smoothly to that section
- ✅ **Keyboard shortcut** - Toggle with `Cmd+Shift+T` (or `Ctrl+Shift+T` on Windows/Linux)
- ✅ **Minimal impact** - Only ~15 lines of changes to PageView.tsx
- ✅ **Smart hiding** - Automatically hides in edit mode and immerse mode

## Usage

### Toggle ToC Panel
- **Keyboard**: Press `Cmd+Shift+T` (macOS) or `Ctrl+Shift+T` (Windows/Linux)
- **Mouse**: Click the ToC icon (📋) in the toolbar

### Navigate to Heading
- Click any heading in the ToC panel
- The page will smoothly scroll to that section

### Visual Hierarchy
- **H1** - Bold, 14px font, 16px left padding
- **H2** - 13px font, 28px left padding
- **H3** - 13px font, 40px left padding (secondary text color)
- **H4** - 12px font, 52px left padding (secondary text color)
- **H5** - 12px font, 64px left padding (tertiary text color)
- **H6** - 12px font, 76px left padding (tertiary text color)

## Implementation Details

### Files Created (3 files, ~350 lines)
1. **`src/services/tocService.ts`** (~80 lines)
   - `extractHeadings(markdown)` - Parses markdown and extracts heading data
   - `generateSlug(text)` - Creates URL-safe IDs with collision handling
   - Handles duplicate headings (adds numeric suffixes: `intro`, `intro-1`, `intro-2`)

2. **`src/components/TocPanel.tsx`** (~40 lines)
   - Displays hierarchical list of headings
   - Empty state when no headings exist
   - Click handler for navigation

3. **`src/components/TocPanel.css`** (~120 lines)
   - Matches app theme (light/dark mode)
   - CSS variables for colors
   - Responsive scrollbar styling

### Files Modified (3 files, ~35 lines total)
1. **`src/services/markdown.ts`** (~20 lines)
   - Custom `heading` renderer in marked.js configuration
   - Injects unique IDs to all headings: `<h1 id="slug">...</h1>`
   - Tracks heading counts to handle duplicates

2. **`src/pages/PageView.tsx`** (~15 lines)
   - Added state: `showToc`, `tocHeadings`
   - Extract headings in `renderHtml()`
   - Keyboard shortcut: `Cmd+Shift+T`
   - Click handler: `handleTocClick()`
   - Toolbar button for ToC toggle
   - Conditional rendering of TocPanel

3. **`src/services/index.ts`** (~1 line)
   - Export `tocService`

## Edge Cases Handled
✅ **No headings** - Shows "No headings" message
✅ **Duplicate headings** - Adds numeric suffixes (`overview`, `overview-1`, `overview-2`)
✅ **Special characters** - Strips from slugs (e.g., `React \`useState\`` → `react-usestate`)
✅ **Long documents** - ToC panel scrolls independently
✅ **Edit mode** - ToC panel automatically hides
✅ **Immerse mode** - ToC panel automatically hides

## Testing

### Automated Tests
All tests passing ✅ (11/11 tests)
```bash
npm test -- tocService.test.ts
```

Test coverage:
- ✅ Extract headings from markdown
- ✅ Handle duplicate headings with numeric suffixes
- ✅ Handle special characters in headings
- ✅ Return empty array when no headings exist
- ✅ Handle all heading levels (h1-h6)
- ✅ Generate URL-safe slugs
- ✅ Replace spaces with hyphens
- ✅ Remove special characters
- ✅ Collapse multiple hyphens
- ✅ Trim leading/trailing hyphens
- ✅ Handle code in backticks

### Manual Testing Checklist
- [ ] ToC shows headings after page load
- [ ] Clicking ToC item scrolls to heading smoothly
- [ ] Duplicate headings get unique IDs (check with DevTools)
- [ ] ToC hides when entering edit mode
- [ ] ToC hides in immerse mode
- [ ] ToC updates when content changes
- [ ] Keyboard shortcut `Cmd+Shift+T` toggles ToC
- [ ] Toolbar button toggles ToC
- [ ] Empty state shows when no headings exist
- [ ] Long heading text truncates with ellipsis
- [ ] ToC scrolls independently from content (test with 20+ headings)
- [ ] Special characters in headings render correctly

## Performance
- **Heading extraction**: O(n) where n = markdown length
- **marked.lexer()**: Optimized library, negligible cost
- **DOM queries**: `getElementById()` is O(1)
- **Expected impact**: Negligible even for 1000+ headings

## Design Decisions

### Why Parse Before Rendering (Hybrid Approach)?
- ✅ Single function call in `renderHtml()` - minimal PageView impact
- ✅ Structured data from marked's AST (depth, text)
- ✅ No fragile DOM parsing after rendering
- ✅ Consistent with existing markdown processing pipeline

### Why Local Component State (Not Zustand)?
- ✅ Follows FindBar pattern - toggle visibility without persistence
- ✅ Only 2 new state variables needed
- ✅ No need to persist ToC state across sessions

### Why Not File System Structure?
- ✅ Headings are document content, not file metadata
- ✅ Auto-generated from markdown, no manual maintenance
- ✅ Works with any markdown document, no special format needed

## Future Enhancements (Not Implemented)
- [ ] Active heading highlighting (scroll spy)
- [ ] Resizable ToC panel width
- [ ] ToC search/filter
- [ ] Collapse/expand heading sections
- [ ] Export ToC as markdown list
- [ ] Right-side ToC position option

## Migration Notes
- **No breaking changes**
- **No data migration needed**
- **Existing pages work without modification**
- **Headings in old documents automatically get ToC**
