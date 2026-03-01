# Context Before/After 전략 분석

## 🔍 현재 구조

### 3단계 Fallback (현재)

```typescript
// Strategy 1: firstWords/lastWords
if (highlight.firstWords && highlight.lastWords) {
  const match = matchByFirstLastWords(...);
  if (match) {
    return; // ✅ 성공 → 적용
  }
  return; // ❌ 실패 → 포기! (여기가 문제!)
}

// Strategy 2: Context (firstWords 없을 때만 실행됨)
if (highlight.contextBefore || highlight.contextAfter) {
  const startPos = matchByContext(...);
  if (startPos !== -1) {
    return; // ✅ 성공
  }
}

// Strategy 3: Fuzzy (마지막 수단)
const fuzzyMatchPos = fuzzyMatch(...);
```

### 🚨 발견된 문제

**Line 442의 `return;`** 때문에:
- firstWords/lastWords가 **실패**하면 즉시 포기
- context나 fuzzy는 **시도조차 안 함**

이것은 의도적 설계였지만, **너무 엄격합니다!**

## ❌ Context Before/After의 근본적 문제

### 1. **공백/줄바꿈 민감도**

**문제 케이스:**
```
저장 시 contextAfter: " ↵↵↵↵항목 ↵IEEPA ↵무역법 "
렌더링 후: " 항목 IEEPA 무역법 "  (줄바꿈 개수 변경)
```

→ **매칭 실패!** (공백 개수가 다름)

### 2. **20자 제한 = 너무 짧음**

```typescript
contextLength: number = 20  // 기본값
```

**문제:**
- 20자는 고유성 보장 불가
- 긴 문서에서 같은 문구가 여러 번 등장
- 잘못된 위치에 매칭될 수 있음

**예시:**
```markdown
... 핵심 개념 정리
1. 첫 번째 항목
... 핵심 개념 정리  ← 같은 문구 반복
2. 두 번째 항목
```

### 3. **구조 변경에 취약**

**Before:**
```markdown
> 인용구
- 리스트 항목
```

**After:**
```markdown
인용구  ← blockquote 제거
리스트 항목  ← 일반 텍스트로 변경
```

→ Context 완전히 바뀜, 매칭 불가능

### 4. **실제 사례 분석**

사용자의 실패 케이스:
```javascript
savedText: "IEEPA vs 무역법 122조 차이"
contextBefore: " 인상 예고) ↵↵핵심 개념 정리 ↵"
contextAfter: " ↵↵↵↵항목 ↵IEEPA ↵무역법 "

fullTextPreview: "1. 정치 체계 큰 그림 ↵세계 정치는..."
```

**문제:**
- 저장된 텍스트 자체가 렌더링된 HTML에 **존재하지 않음**
- Context는 의미 없음 (텍스트가 삭제됨)

## ✅ firstWords/lastWords가 더 나은 이유

### 왜 더 견고한가?

**1. 중간 단어 변경에 강함**
```
Original: "The quick brown fox jumps"
firstWords: "The quick brown"
lastWords: "brown fox jumps"

Edited: "The quick RED fox jumps"  ← 중간 단어 변경
→ firstWords/lastWords는 실패하지만, 의도된 동작!
→ 사용자가 하이라이트를 업데이트해야 함
```

**2. 구조 변경에 강함**
```markdown
Before:
> The quick brown fox

After:
The quick brown fox  ← blockquote 제거

→ 텍스트는 동일, firstWords/lastWords 매칭 성공! ✅
→ context는 실패 (">  " 사라짐) ❌
```

**3. Word Index로 O(1) 성능**
```typescript
const firstWordPositions = wordIndex.get(firstWord);
// O(1) lookup, 매우 빠름
```

vs Context:
```typescript
fullText.indexOf(pattern);
// O(N) search, 느림
```

**4. 고유성 보장**
- 3개 단어 조합 = 매우 고유함
- 20자 context = 고유성 낮음

## 🔧 개선 방안

### Option 1: Context를 Fallback으로 활용 (권장)

```typescript
// Strategy 1: firstWords/lastWords
if (highlight.firstWords && highlight.lastWords) {
  const match = matchByFirstLastWords(...);
  if (match) {
    return; // ✅ 성공
  }
  // ❌ 실패 → context로 fallback (새로운 동작!)
}

// Strategy 2: Context (항상 시도)
if (highlight.contextBefore || highlight.contextAfter) {
  const startPos = matchByContext(...);
  if (startPos !== -1) {
    if (this.debugMode) {
      console.log('[HIGHLIGHT MATCH] ✓ Found via context fallback');
    }
    return;
  }
}

// Strategy 3: Fuzzy
...
```

**장점:**
- firstWords 실패 시 context로 재시도
- 중간 단어만 바뀐 경우 context가 성공할 수도
- 기존 하이라이트와 호환

**단점:**
- 잘못된 위치에 매칭될 가능성 (context가 부정확하므로)

### Option 2: Context 제거, firstWords만 사용

```typescript
// Strategy 1: firstWords/lastWords ONLY
if (highlight.firstWords && highlight.lastWords) {
  const match = matchByFirstLastWords(...);
  if (match) return;
}

// Strategy 2: Fuzzy (context 건너뛰기)
const fuzzyMatchPos = fuzzyMatch(...);
```

**장점:**
- 더 견고 (잘못된 매칭 방지)
- 코드 단순화
- 성능 향상

**단점:**
- 하위 호환성 깨짐 (오래된 하이라이트)
- Context만 있는 하이라이트는 매칭 불가

### Option 3: Context 길이 늘리기

```typescript
extractHighlightContext(
  plainText,
  startOffset,
  endOffset,
  50  // 20 → 50자로 증가
)
```

**장점:**
- 고유성 증가
- 기존 코드와 호환

**단점:**
- 근본 문제 해결 안 됨
- 여전히 구조 변경에 취약

## 💡 추천 솔루션

### 단기 (즉시 적용 가능)

**1. Context를 Fallback으로 변경**
```typescript
// Line 442의 `return;` 제거
// firstWords 실패 시 context 시도
```

**2. Context 길이 증가**
```typescript
contextLength: 50  // 20 → 50
```

**3. 더 나은 에러 메시지**
```typescript
console.warn('[HIGHLIGHT MATCH] All strategies failed', {
  // ... 상세 진단 정보
  recommendedAction: 'Delete this highlight or update the page content'
});
```

### 중기 (차기 버전)

**1. Highlight 자동 업데이트**
- 텍스트 일부만 변경된 경우 자동으로 재계산
- firstWords/lastWords 업데이트

**2. Orphaned Highlight 감지**
```typescript
// 3번 이상 실패한 하이라이트 표시
if (failCount > 3) {
  mark as "orphaned" in UI
  show "Update or Delete" button
}
```

**3. 더 스마트한 매칭**
```typescript
// Edit distance 기반 매칭
// "The quick brown fox" vs "The quick red fox"
// → 75% 유사도, 매칭 성공 가능
```

### 장기 (미래 개선)

**1. Incremental DOM Diffing**
- 페이지 변경 시 하이라이트 자동 업데이트
- Git diff처럼 텍스트 변화 추적

**2. Position-based + Text-based 하이브리드**
```typescript
{
  textMatch: { firstWords, lastWords },
  positionHint: { startOffset, endOffset },  // 힌트로만 사용
  confidence: 0.95
}
```

**3. Machine Learning 기반 매칭**
- 텍스트 임베딩으로 유사도 계산
- 구조 변경에도 강건

## 🎯 즉시 적용할 수정

사용자의 현재 문제 해결:

1. **Context fallback 활성화** (Line 442 수정)
2. **Debug 로깅 개선** (실패 원인 상세 표시)
3. **Orphaned highlight 정리 기능** 추가

수정하시겠습니까?
