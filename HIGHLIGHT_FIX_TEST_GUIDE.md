# Highlight Fix - List & Table 테스트 가이드

## 🔧 적용된 수정사항

### 1. **강화된 디버그 로깅**
- 하이라이트 생성 시 상세 정보 출력
- 매칭 실패 시 원인 진단 정보 제공
- HTML 구조와 textContent 비교 로깅

### 2. **Block Element 공백 처리**
List와 table에서 텍스트 추출 시 공백이 사라지는 문제를 수정:

**Before:**
```
<li>First</li><li>Second</li> → textContent: "FirstSecond" ❌
<td>A</td><td>B</td> → textContent: "AB" ❌
```

**After:**
```
<li>First</li><li>Second</li> → textContent: "First Second " ✅
<td>A</td><td>B</td> → textContent: "A B " ✅
```

처리되는 block elements:
- `<li>` - List items
- `<td>`, `<th>` - Table cells
- `<p>`, `<div>` - Paragraphs and divs
- `<h1>` ~ `<h6>` - Headings
- `<blockquote>` - Blockquotes
- `<pre>` - Code blocks

## 🧪 테스트 방법

### Step 1: Dev Server 실행
```bash
cd /Users/gahee/my-kanban-highlight
npm run dev
```

브라우저에서 http://localhost:5173 접속

### Step 2: 테스트 페이지 생성

다음 내용으로 새 페이지를 만드세요:

```markdown
# Highlight Test - Lists & Tables

## Ordered List Test
1. First item with some text
2. Second item with **bold text**
3. Third item with [link](https://example.com)

## Unordered List Test
- Bullet point A
- Bullet point B with _italic_
- Bullet point C

## Table Test
| Column A | Column B | Column C |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |

## Nested List Test
1. Parent item one
   - Child item 1-1
   - Child item 1-2
2. Parent item two
   - Child item 2-1

## Mixed Content
Some text before the list.

1. List item with context
2. Another list item

Some text after the list.

| Before | After |
|--------|-------|
| Value1 | Value2 |

More text here.
```

### Step 3: Debug Mode 활성화

페이지를 보는 상태에서:
1. **Cmd+Shift+D** (Mac) 또는 **Ctrl+Shift+D** (Windows) 누르기
2. Toast 메시지 확인: "Highlight debug: ON"
3. 브라우저 개발자 도구 열기 (F12)
4. Console 탭 열기

### Step 4: 하이라이트 생성 테스트

#### Test Case 1: Ordered List Item
1. "First item with some text" 텍스트 선택
2. 하이라이트 색상 선택
3. Console에서 다음 로그 확인:
   ```
   [HIGHLIGHT CREATE] {
     text: "First item with some text",
     firstWords: "First item with",
     lastWords: "with some text",
     startOffset: ...,
     endOffset: ...,
     contextBefore: "",
     contextAfter: "Second item with...",
     plainTextPreview: "First item with some text Second item..."
   }
   ```

4. 페이지 새로고침 (Cmd+R)
5. Console에서 다음 로그 확인:
   ```
   [HIGHLIGHT RENDER] Starting highlight rendering
   [HIGHLIGHT RENDER] Text analysis
   [HIGHLIGHT MATCH] Attempting firstWords/lastWords
   [HIGHLIGHT MATCH] ✓ Found { strategy: "firstWords/lastWords", ... }
   ```

**예상 결과:** 하이라이트가 정상적으로 표시됨 ✅

#### Test Case 2: Table Cell
1. "Cell 2" 텍스트 선택
2. 하이라이트 생성
3. Console 로그 확인:
   ```
   [HIGHLIGHT CREATE] {
     text: "Cell 2",
     contextBefore: "Cell 1 ",  // ← 공백 있어야 함!
     contextAfter: " Cell 3"     // ← 공백 있어야 함!
   }
   ```

4. 페이지 새로고침
5. 하이라이트 표시 확인

**예상 결과:** 하이라이트가 정상적으로 표시됨 ✅

#### Test Case 3: Across List Items (Edge Case)
1. "Second item" ~ "Third item" 선택 (여러 list item에 걸쳐서)
2. 하이라이트 생성
3. Console 확인

**예상 결과:** 여러 줄에 걸친 하이라이트도 표시됨 ✅

#### Test Case 4: Table Row
1. "Cell 1" ~ "Cell 3" 선택 (테이블 한 행 전체)
2. 하이라이트 생성
3. Console 확인

**예상 결과:** 테이블 행 전체가 하이라이트됨 ✅

### Step 5: 실패 케이스 진단

만약 하이라이트가 표시되지 않으면, Console에서:

```
[HIGHLIGHT MATCH] ✗ Failed to find firstWords/lastWords {
  id: "...",
  savedText: "...",
  firstWords: "...",
  lastWords: "...",
  normalizedTextPreview: "...",  // ← 이 텍스트에서 찾으려고 시도
  fullTextPreview: "...",
  suggestion: "Text might have been in a list/table that was reformatted"
}
```

**확인할 사항:**
1. `savedText`와 `normalizedTextPreview`를 비교
2. 저장된 텍스트가 실제로 존재하는지 확인
3. 공백이 제대로 삽입되었는지 확인

## 🔍 진단 체크리스트

### 문제가 해결된 경우 ✅
- [ ] List item 하이라이트가 표시됨
- [ ] Table cell 하이라이트가 표시됨
- [ ] 여러 줄에 걸친 하이라이트가 표시됨
- [ ] Console에 `✓ Found` 로그가 출력됨
- [ ] `contextBefore`, `contextAfter`에 공백이 포함됨

### 문제가 여전히 발생하는 경우 ❌
Console 로그를 복사해서 다음 정보 제공:
1. `[HIGHLIGHT CREATE]` 로그 전체
2. `[HIGHLIGHT MATCH]` 로그 전체
3. 어떤 텍스트를 선택했는지
4. 페이지의 마크다운 소스

## 🐛 알려진 제한사항

### 1. CSS 생성 콘텐츠
List 번호(1., 2., 3.)는 CSS로 생성되므로 실제 textContent에 포함되지 않습니다.
- ✅ "First item" 선택 → 작동
- ❌ "1. First" 선택 → "1."은 선택 불가 (CSS 콘텐츠)

### 2. 마크다운 편집
페이지를 외부에서 편집하여 list/table 구조가 변경되면:
- firstWords/lastWords로 재매칭 시도
- 텍스트가 완전히 삭제되면 하이라이트 표시 안 됨

### 3. Mermaid 블록
Mermaid 다이어그램 내부의 텍스트는 하이라이트 불가:
- Mermaid 블록은 `<pre class="mermaid">`로 렌더링
- 다이어그램 렌더링 후 SVG로 변환되어 텍스트 매칭 불가능

## 📊 성능 영향

`insertSpacesBetweenBlocks` 메서드 추가로 인한 성능 영향:
- **복잡도:** O(B) where B = block elements 수
- **일반적인 페이지:** < 100 block elements → < 1ms
- **매우 긴 문서:** 1000+ block elements → ~10ms
- **영향:** 무시할 수 있는 수준 (하이라이트 렌더링은 사용자 액션 시만 발생)

## 🎯 Next Steps

테스트 결과에 따라:

### ✅ 모든 테스트 통과
→ Phase 5로 진행: Documentation & Cleanup

### ⚠️ 일부 케이스 실패
→ Console 로그 분석 후 추가 수정

### ❌ 대부분 실패
→ `insertSpacesBetweenBlocks` 로직 재검토
