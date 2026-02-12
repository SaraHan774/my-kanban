# Phase 3: Polish & Production - Implementation Plan

## Overview

Phase 3 focuses on production-ready polish, edge case handling, and comprehensive testing of the Toast UI Editor implementation.

**Status**: 🟡 Pending
**Estimated Duration**: 10-14 hours (6-8 hours with parallel execution)

---

## Completed Work (Phases 1 & 2)

### ✅ Phase 1: MVP - Core WYSIWYG
- Toast UI Editor integration
- Basic markdown editing with live preview
- Manual save functionality
- Image upload and paste support
- Code blocks with syntax highlighting
- Interactive checkboxes (task lists)

### ✅ Phase 2: Advanced Features
- Mermaid diagram rendering (mindmap, flowchart, sequence, etc.)
- Wiki links support (`[[Page Title]]` syntax)
- Slash command menu for quick formatting

---

## Phase 3 Tasks

### Step 3.1: Find/Replace Implementation (4-6 hours)

**Goal**: Add find and replace functionality that works with Toast UI Editor's ProseMirror-based architecture.

#### Current State
- Find/Replace UI exists in `src/components/FindBar.tsx`
- Currently works with textarea-based editor
- Uses native browser text selection API

#### Required Changes

**File**: `src/components/FindBar.tsx`

1. **Add Toast UI Editor Support**
   ```typescript
   interface FindBarProps {
     onClose: () => void;
     editorInstance?: Editor; // Add Toast UI Editor instance
     isToastEditor?: boolean; // Flag to switch between implementations
   }
   ```

2. **Implement ProseMirror-based Find**
   - Use Toast UI Editor's markdown content for searching
   - Convert line/column positions to ProseMirror positions
   - Highlight matches using decorations or temporary marks

3. **Find Algorithm**
   ```typescript
   const findMatches = (searchTerm: string, caseSensitive: boolean) => {
     const markdown = editorInstance.getMarkdown();
     const regex = new RegExp(
       searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
       caseSensitive ? 'g' : 'gi'
     );

     const matches: Array<{ line: number; col: number; length: number }> = [];
     const lines = markdown.split('\n');

     lines.forEach((line, lineIndex) => {
       let match;
       while ((match = regex.exec(line)) !== null) {
         matches.push({
           line: lineIndex,
           col: match.index,
           length: searchTerm.length
         });
       }
     });

     return matches;
   };
   ```

4. **Navigate to Match**
   - Focus editor on current match
   - Scroll to match position
   - Highlight current match differently from other matches

5. **Replace Functionality**
   ```typescript
   const replaceMatch = (matchIndex: number, replacement: string) => {
     const match = matches[matchIndex];
     const markdown = editorInstance.getMarkdown();
     const lines = markdown.split('\n');

     const line = lines[match.line];
     const newLine =
       line.substring(0, match.col) +
       replacement +
       line.substring(match.col + match.length);

     lines[match.line] = newLine;
     editorInstance.setMarkdown(lines.join('\n'), false);
   };

   const replaceAll = (searchTerm: string, replacement: string) => {
     const markdown = editorInstance.getMarkdown();
     const regex = new RegExp(
       searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
       'g'
     );
     const newMarkdown = markdown.replace(regex, replacement);
     editorInstance.setMarkdown(newMarkdown, false);
   };
   ```

6. **Keyboard Shortcuts**
   - Cmd+F: Open find bar (already exists)
   - Enter: Next match
   - Shift+Enter: Previous match
   - Cmd+G: Next match
   - Cmd+Shift+G: Previous match
   - Escape: Close find bar

#### Integration Points

**File**: `src/pages/PageViewNew.tsx`
- Pass Toast UI Editor instance to FindBar
- Set `isToastEditor={true}` flag
- Existing Cmd+F handler should work as-is

#### Testing Checklist
- [ ] Find single occurrence
- [ ] Find multiple occurrences
- [ ] Case-sensitive search
- [ ] Case-insensitive search
- [ ] Replace single match
- [ ] Replace all matches
- [ ] Navigate with keyboard (Enter, Shift+Enter)
- [ ] Navigate with buttons (Next, Previous)
- [ ] Find in code blocks
- [ ] Find in Mermaid diagrams
- [ ] Find in Wiki links
- [ ] Regex special characters escaped correctly
- [ ] Match highlighting visible
- [ ] Scroll to match works correctly

---

### Step 3.2: Edge Cases & Polish (3-4 hours)

**Goal**: Handle edge cases and polish the user experience.

#### 3.2.1: Markdown Round-trip Testing

**Test Cases**:
1. **Complex Formatting**
   - Nested lists (ordered + unordered)
   - Mixed formatting (bold + italic + code)
   - Tables with alignment
   - Blockquotes with nested content
   - Horizontal rules

2. **Special Characters**
   - HTML entities (`&nbsp;`, `&lt;`, `&gt;`)
   - Unicode characters (emojis, special symbols)
   - Escape sequences (`\*`, `\_`, `\[`, `\]`)

3. **Edge Cases**
   - Empty lines preservation
   - Trailing whitespace handling
   - Multiple consecutive blank lines
   - List items with multiple paragraphs
   - Code blocks with backticks inside

4. **Custom Syntax**
   - Mermaid diagrams with special characters
   - Wiki links with special characters
   - Mixed Mermaid + Wiki links in same document

**Validation Method**:
```typescript
const testRoundTrip = (markdown: string) => {
  // Load markdown
  editor.setMarkdown(markdown, false);

  // Get back markdown
  const result = editor.getMarkdown();

  // Compare (allowing for Toast UI normalization)
  const normalized1 = normalizeMarkdown(markdown);
  const normalized2 = normalizeMarkdown(result);

  console.assert(
    normalized1 === normalized2,
    'Round-trip failed',
    { original: markdown, result }
  );
};
```

#### 3.2.2: Performance Optimization

1. **Debounce onChange Handler**
   - Currently triggers on every keystroke
   - Add 300ms debounce for markdown serialization
   - Keep immediate updates for preview rendering

   ```typescript
   const debouncedOnChange = useDeferredValue(markdown);

   useEffect(() => {
     onChange(debouncedOnChange);
   }, [debouncedOnChange, onChange]);
   ```

2. **Mermaid Rendering Optimization**
   - Skip re-rendering already rendered diagrams
   - Use `data-mermaid-rendered` attribute (already implemented ✅)
   - Clear old diagrams on content change

3. **Wiki Links Rendering Optimization**
   - Prevent duplicate processing of same text nodes
   - Cache regex matches
   - Batch DOM updates

#### 3.2.3: Keyboard Shortcuts Verification

**Shortcuts to Test**:
- [x] Cmd+B: Bold (Toast UI native)
- [x] Cmd+I: Italic (Toast UI native)
- [ ] Cmd+S: Manual save (custom)
- [ ] Cmd+F: Find (custom)
- [ ] Escape: Close editor/find bar (custom)
- [x] Tab: List indentation (Toast UI native)
- [x] Shift+Tab: List outdentation (Toast UI native)

**Implementation**:
```typescript
// In PageViewNew.tsx
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
      e.preventDefault();
      setShowFindBar(true);
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [handleSave]);
```

#### 3.2.4: Theme Support

**Test Cases**:
- [ ] Light mode: all elements visible and styled correctly
- [ ] Dark mode: all elements visible and styled correctly
- [ ] Theme switching: no flash of unstyled content
- [ ] CSS variables properly applied:
  - `--text-primary`
  - `--text-secondary`
  - `--bg-primary`
  - `--bg-secondary`
  - `--bg-tertiary`
  - `--accent-primary`
  - `--border-color`

**Files to Check**:
- `src/components/editor/ToastEditor.css`
- `src/components/editor/SlashCommandMenu.css`

#### 3.2.5: Error Handling

1. **Mermaid Rendering Errors**
   - Show original code block if rendering fails
   - Log error to console
   - Remove `data-mermaid-rendered` to allow retry

   ✅ Already implemented in ToastEditor.tsx

2. **Image Upload Errors**
   - Show error message to user
   - Fallback gracefully (don't insert broken image)

   ✅ Already implemented in ToastEditor.tsx

3. **Editor Initialization Errors**
   ```typescript
   try {
     const editor = new Editor({ ... });
   } catch (error) {
     console.error('Editor initialization failed:', error);
     // Show error UI to user
     return <div>Failed to load editor. Please refresh.</div>;
   }
   ```

---

### Step 3.3: Testing & Validation (3-4 hours)

**Goal**: Comprehensive testing of all features.

#### Test Categories

##### 1. Functional Tests

**Markdown Features**:
- [ ] Headings (H1-H6)
- [ ] Bold text
- [ ] Italic text
- [ ] Strikethrough
- [ ] Inline code
- [ ] Code blocks with syntax highlighting
- [ ] Ordered lists
- [ ] Unordered lists
- [ ] Task lists (checkboxes)
- [ ] Nested lists
- [ ] Blockquotes
- [ ] Horizontal rules
- [ ] Links
- [ ] Images
- [ ] Tables

**Custom Features**:
- [ ] Mermaid diagrams (all types: flowchart, mindmap, sequence, etc.)
- [ ] Wiki links (`[[Page Title]]`)
- [ ] Slash commands (all commands work)

**Editor Features**:
- [ ] Manual save (Cmd+S)
- [ ] Auto-reload when switching pages
- [ ] Content persistence across page navigation
- [ ] Frontmatter preservation
- [ ] Image upload via toolbar
- [ ] Image paste from clipboard
- [ ] Image drag-and-drop

**Find/Replace**:
- [ ] Find single match
- [ ] Find multiple matches
- [ ] Replace single match
- [ ] Replace all matches
- [ ] Case-sensitive search
- [ ] Navigate with keyboard
- [ ] Close with Escape

##### 2. Integration Tests

**Page Lifecycle**:
1. Create new page → Add content → Save → Reload
2. Load existing page → Edit → Save → Verify changes
3. Load page with images → Images display correctly
4. Load page with Mermaid → Diagrams render
5. Load page with Wiki links → Links are clickable

**Multi-Page Navigation**:
1. Edit Page A → Navigate to Page B → Content saved
2. Edit Page A → Edit Page B → Both save correctly
3. Use Wiki link to navigate → Target page loads

**Image Management**:
1. Upload image → Image saved to `.images/` folder
2. Delete page → Images remain (for other pages to reference)
3. Paste image → Unique filename generated (hash-based)

##### 3. Performance Tests

**Large Documents**:
- [ ] 10KB markdown file loads quickly
- [ ] 50KB markdown file loads without lag
- [ ] 100KB markdown file handles gracefully
- [ ] No typing lag with 1000+ lines
- [ ] Smooth scrolling with long content

**Many Diagrams**:
- [ ] 5 Mermaid diagrams render correctly
- [ ] 10 Mermaid diagrams render without slowdown
- [ ] Complex Mermaid diagrams (100+ nodes) render

**Many Wiki Links**:
- [ ] 50 Wiki links process correctly
- [ ] 100 Wiki links don't slow down editing

##### 4. Edge Cases

**Empty States**:
- [ ] Empty file loads correctly
- [ ] File with only frontmatter
- [ ] File with only whitespace

**Special Content**:
- [ ] Markdown with HTML entities
- [ ] Markdown with escape sequences
- [ ] Code blocks with triple backticks inside
- [ ] Wiki links with special characters
- [ ] Mermaid with Unicode characters

**Error Recovery**:
- [ ] Invalid Mermaid syntax → Shows code block
- [ ] Network error during save → Shows error
- [ ] Browser refresh during edit → No data loss

##### 5. Accessibility Tests

- [ ] Keyboard navigation works (no mouse required)
- [ ] Tab order is logical
- [ ] Focus indicators visible
- [ ] Screen reader friendly (aria labels)

##### 6. Browser Compatibility

**Chrome**:
- [ ] All features work
- [ ] No console errors

**Firefox**:
- [ ] All features work
- [ ] No console errors

**Safari**:
- [ ] All features work
- [ ] No console errors

**Edge**:
- [ ] All features work
- [ ] No console errors

---

## Success Criteria

### Must Have ✅
- [ ] All existing markdown files load correctly
- [ ] No data loss in markdown round-trip
- [ ] All features work: images, code, Mermaid, Wiki links, checkboxes, slash commands
- [ ] Keyboard shortcuts work: Cmd+B, Cmd+I, Cmd+S, Cmd+F
- [ ] Dark/light theme support maintained
- [ ] Performance acceptable (no lag during typing)
- [ ] Find/Replace functionality complete

### Nice to Have 🎯
- [ ] Bubble menu for text selection formatting
- [ ] Floating menu for quick block insertion
- [ ] Table visual editor
- [ ] Undo/Redo UI buttons (currently keyboard-only)

---

## Files to Modify

### Step 3.1 (Find/Replace)
- `src/components/FindBar.tsx` - Add Toast UI Editor support
- `src/pages/PageViewNew.tsx` - Pass editor instance to FindBar

### Step 3.2 (Polish)
- `src/components/editor/ToastEditor.tsx` - Performance optimizations
- `src/pages/PageViewNew.tsx` - Keyboard shortcuts
- `src/components/editor/ToastEditor.css` - Theme verification

### Step 3.3 (Testing)
- Create `src/tests/editor.test.tsx` (optional)
- Manual testing checklist (this document)

---

## Testing Strategy

### 1. Manual Testing
Use this document as a checklist, test each item systematically.

### 2. User Acceptance Testing
- Have non-developer users test the editor
- Collect feedback on usability
- Compare to previous markdown textarea experience

### 3. Performance Profiling
```typescript
// Add performance markers
performance.mark('editor-init-start');
const editor = new Editor({ ... });
performance.mark('editor-init-end');
performance.measure('editor-init', 'editor-init-start', 'editor-init-end');

// Check measurements
const measures = performance.getEntriesByType('measure');
console.table(measures);
```

### 4. Memory Profiling
- Open Chrome DevTools → Memory
- Take heap snapshot before loading large file
- Load file → Take another snapshot
- Check for memory leaks

---

## Rollout Plan

### Phase 3 Completion
1. All tests pass ✅
2. No critical bugs 🐛
3. Performance acceptable ⚡
4. User feedback positive 👍

### Production Release
1. Merge `feature/toast-ui-editor-phase2` → `main`
2. Bump version to `0.4.0`
3. Create release notes
4. Tag release: `v0.4.0-toast-ui-editor`

### Post-Release Monitoring
- Monitor user feedback
- Track performance metrics
- Fix any reported bugs
- Plan Phase 4 enhancements (if needed)

---

## Timeline

**Parallel Execution** (Recommended):
- Step 3.1 (Find/Replace): 4-6 hours
- Step 3.2 (Polish): 3-4 hours (can partially overlap with 3.1)
- Step 3.3 (Testing): 3-4 hours (after 3.1 and 3.2)

**Total**: 6-8 hours with parallelization, 10-14 hours sequential

---

## Notes

- Focus on **stability** over new features
- Prioritize **data integrity** (no markdown corruption)
- Keep **backward compatibility** (existing files must work)
- Maintain **performance** (no slowdowns vs. old editor)

---

## Next Steps After Phase 3

**Potential Phase 4 Enhancements** (Future):
1. Auto-save functionality (debounced)
2. Collaboration features (multi-user editing)
3. AI writing assistance
4. Custom toolbar customization
5. Export to PDF/HTML
6. Import from other formats
7. Version history / git integration
8. Vim mode (for power users)

---

**Document Version**: 1.0
**Last Updated**: 2026-02-13
**Author**: Claude Sonnet 4.5
**Status**: Ready for Implementation
