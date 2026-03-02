# Highlight Edge Cases Analysis

## 📋 Edge Case 카테고리

### 1. Markdown Syntax 변환 (Inline Elements)
| Markdown | HTML | Offset 변화 | 대응 여부 |
|----------|------|------------|----------|
| `**bold**` | `<strong>bold</strong>` | -4 chars (**, **) | ⚠️ Partial |
| `*italic*` | `<em>italic</em>` | -2 chars (*, *) | ⚠️ Partial |
| `~~strike~~` | `<del>strike</del>` | -4 chars (~~, ~~) | ⚠️ Partial |
| `` `code` `` | `<code>code</code>` | -2 chars (\`, \`) | ⚠️ Partial |
| `[link](url)` | `<a href="url">link</a>` | URL 부분 제거 | ⚠️ Partial |
| `[[wiki]]` | `<a data-page-ref="wiki">wiki</a>` | -4 chars ([[, ]]) | ⚠️ Partial |

### 2. Markdown Syntax 변환 (Block Elements)
| Markdown | HTML | Offset 변화 | 대응 여부 |
|----------|------|------------|----------|
| `# Header` | `<h1 id="header">Header</h1>` | -2 chars (# ) | ⚠️ Partial |
| `## Header` | `<h2 id="header">Header</h2>` | -3 chars (## ) | ⚠️ Partial |
| `- item` | `<li>item</li>` | -2 chars (- ) | ⚠️ Partial |
| `1. item` | `<li>item</li>` | -3 chars (1. ) | ⚠️ Partial |
| `> quote` | `<blockquote><p>quote</p></blockquote>` | -2 chars (> ) | ⚠️ Partial |

### 3. Whitespace 처리
| Case | Markdown | HTML textContent | 대응 여부 |
|------|----------|------------------|----------|
| 연속 공백 | `a  b` | `a b` | ✅ Normalized |
| 줄바꿈 (GFM breaks) | `a\nb` | `a b` (with `<br>`) | ⚠️ Complex |
| Tab | `a\tb` | `a b` | ✅ Normalized |
| 블록 요소 사이 | `<li>A</li><li>B</li>` | `AB` → `A B` | ✅ insertSpacesBetweenBlocks |

### 4. 특수 블록
| Case | 대응 여부 | 비고 |
|------|----------|------|
| Code blocks | ❌ Not supported | 하이라이트 비활성화 필요 |
| Mermaid blocks | ❌ Not supported | 하이라이트 비활성화 필요 |
| 이미지 alt text | ⚠️ Partial | Alt text는 보이지 않음 |
| HTML comments | ❌ Stripped | Markdown에는 있지만 HTML에 없음 |

### 5. HTML Entities
| Case | Markdown | HTML | 대응 여부 |
|------|----------|------|----------|
| Ampersand | `&` | `&amp;` | ⚠️ Length mismatch |
| Less than | `<` | `&lt;` | ⚠️ Length mismatch |
| Greater than | `>` | `&gt;` | ⚠️ Length mismatch |
| Quote | `"` | `&quot;` | ⚠️ Length mismatch |

### 6. 중첩 구조
| Case | 예시 | 대응 여부 |
|------|------|----------|
| Bold + Italic | `***text***` | ⚠️ Complex |
| Link with bold | `[**bold link**](url)` | ⚠️ Complex |
| List with code | `- item with `code`` | ⚠️ Complex |

## 🐛 발견된 주요 버그

### Bug #1: buildMarkdownToHtmlOffsetMap의 단방향 Skip
**위치:** `highlightService.ts:266-269`

```typescript
} else {
  // Mismatch - likely markdown syntax that was removed
  // Skip in markdown, continue in HTML
  mdPos++;  // ← 문제: 항상 markdown만 skip!
}
```

**문제:**
- Markdown에만 있는 문자: OK (**, __, # 등)
- HTML에만 있는 문자: FAIL! (insertSpacesBetweenBlocks가 추가한 공백 등)
- 결과: Offset이 점점 어긋남

**영향:**
- 리스트 항목이 많을수록 offset 오차 증가
- 복잡한 문서에서 하이라이트 실패율 상승

### Bug #2: HTML Entities 미처리
**문제:**
- `&` → `&amp;` (1글자 → 5글자)
- Offset 계산 시 고려되지 않음

**영향:**
- `&`가 포함된 텍스트 하이라이트 실패

### Bug #3: 줄바꿈 처리 불일치
**문제:**
- GFM breaks 설정: `breaks: true` (line 16)
- `a\nb` → `a<br>b` (HTML)
- textContent: `a\nb` (그대로)
- 하지만 normalizeWhitespace: `a b` (공백으로)

**영향:**
- 줄바꿈이 있는 텍스트 하이라이트 위치 오차

## 📊 현재 알고리즘 성능 추정

| 문서 복잡도 | 예상 성공률 | 실패 원인 |
|------------|-----------|----------|
| 단순 텍스트 | ~95% | Whitespace 차이 |
| Bold/Italic 포함 | ~80% | Offset mismatch |
| 리스트 (5개 이상) | ~60% | 누적 offset 오차 |
| 복잡한 문서 (리스트+링크+강조) | ~40% | Multiple mismatches |
| HTML entities 포함 | ~30% | Length mismatch |

## 🎯 개선 필요 사항

### Priority 1: 양방향 Skip 알고리즘
- Markdown과 HTML 모두 skip 가능하도록 개선
- LCS (Longest Common Subsequence) 기반 alignment 고려

### Priority 2: HTML Entities 처리
- Markdown → HTML 변환 시 entity encoding 반영
- Offset mapping에 entity 길이 고려

### Priority 3: 더 나은 Fallback
- firstWords/lastWords 매칭 정확도 향상
- 여러 occurrence 처리 개선

### Priority 4: 디버깅 강화
- 실패 케이스 상세 로깅
- Offset mismatch 원인 분석 도구

## 🔧 권장 해결 방법

1. **Short-term (Quick Fix):**
   - 양방향 skip 로직 추가
   - 더 나은 heuristic (문자 유사도 기반)

2. **Long-term (Robust):**
   - Myers diff algorithm 또는 similar text alignment
   - Character-level diffing
   - More sophisticated offset mapping

3. **Alternative (Radical):**
   - HTML-based highlighting (no markdown offset)
   - Range API 사용으로 직접 DOM selection
   - Offset 개념 완전 제거
