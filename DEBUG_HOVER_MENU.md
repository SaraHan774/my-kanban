# Highlight Hover Menu 디버깅 가이드

## 문제: 하이라이트에 마우스 hover 시 삭제 팔레트가 나타나지 않음

## 진단 단계

### Step 1: 하이라이트가 렌더링되는지 확인

브라우저 Console에서 다음 명령어 실행:

```javascript
// 1. 모든 highlight mark 요소 찾기
const marks = document.querySelectorAll('mark.highlight[data-highlight-id]');
console.log('Total highlights found:', marks.length);

// 2. 각 highlight 정보 출력
marks.forEach((mark, i) => {
  console.log(`Highlight ${i + 1}:`, {
    id: mark.getAttribute('data-highlight-id'),
    text: mark.textContent,
    class: mark.className,
    visible: mark.offsetParent !== null
  });
});

// 3. 첫 번째 highlight에 수동으로 hover 이벤트 발생
if (marks.length > 0) {
  marks[0].dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
  console.log('Dispatched mouseenter event on first highlight');
}
```

### Step 2: 이벤트 리스너 확인

```javascript
// highlight mark에 이벤트 리스너가 붙어있는지 확인
const mark = document.querySelector('mark.highlight[data-highlight-id]');
if (mark) {
  console.log('Event listeners:', getEventListeners(mark));
  // Chrome DevTools에서만 작동 (getEventListeners)
}
```

### Step 3: highlightsVisible 상태 확인

```javascript
// React DevTools로 확인하거나, 직접 체크:
// PageView 컴포넌트에서 highlightsVisible이 true인지 확인

// Console에서 간접적으로 확인:
const marks = document.querySelectorAll('mark.highlight');
console.log('Highlights visible:', marks.length > 0);
```

### Step 4: hover 메뉴 상태 확인

```javascript
// hover 메뉴가 DOM에 존재하는지
const hoverMenu = document.querySelector('[class*="HighlightHoverMenu"]');
console.log('Hover menu element:', hoverMenu);
console.log('Hover menu visible:', hoverMenu?.style.display !== 'none');
```

## 예상 원인 및 해결방법

### 원인 1: 하이라이트가 렌더링 실패

**증상:**
```javascript
marks.length === 0  // 하이라이트가 없음
```

**원인:**
- Console에서 본 `[HIGHLIGHT MATCH] ✗ Failed` 에러
- 텍스트 매칭 실패로 하이라이트가 아예 렌더링 안 됨

**해결:**
1. 실패한 하이라이트 삭제
2. 새로운 하이라이트 재생성
3. 텍스트가 실제로 존재하는지 확인 (Cmd+F)

### 원인 2: highlightsVisible = false

**증상:**
```javascript
marks.length === 0 && page.highlights.length > 0
```

**원인:**
- 하이라이트 visibility가 꺼져있음

**해결:**
- 페이지 상단의 하이라이트 토글 버튼 클릭
- 또는 단축키로 토글

### 원인 3: editing 모드

**증상:**
- 편집 모드에서 hover 메뉴가 안 나타남

**원인:**
```typescript
if (!container || editing || !highlightsVisible) return;
```

**해결:**
- 편집 모드 종료 (Esc 키)
- View 모드에서만 hover 메뉴 작동

### 원인 4: 이벤트 리스너 미등록

**증상:**
```javascript
getEventListeners(mark).mouseenter === undefined
```

**원인:**
- useEffect가 실행되지 않음
- htmlContent 변경이 감지되지 않음

**해결:**
- 페이지 새로고침
- 다른 페이지로 이동했다가 돌아오기

### 원인 5: CSS z-index 문제

**증상:**
- hover 메뉴가 생성되지만 다른 요소 뒤에 숨김

**해결:**
- Elements 탭에서 hover 메뉴 element 확인
- z-index 값 확인
- 다른 요소가 위를 가리는지 확인

## 테스트 시나리오

### 정상 작동 확인

1. **새 하이라이트 생성**
   - 텍스트 선택
   - 색상 선택
   - 하이라이트 생성 확인

2. **Hover 테스트**
   - 생성된 하이라이트에 마우스 올리기
   - 메뉴가 나타나는지 확인
   - 색상 변경 버튼 확인
   - 삭제 버튼 확인

3. **기능 테스트**
   - 색상 변경 클릭
   - 삭제 클릭
   - 메모 연결 (memo mode)

## 임시 해결책 (Workaround)

hover 메뉴가 작동하지 않을 경우:

### 방법 1: 하이라이트 직접 삭제

페이지 편집 모드 (E 키) → frontmatter에서:
```yaml
highlights:
  - id: "problematic-id"
    # 이 항목 삭제
```

### 방법 2: 브라우저 Console에서 삭제

```javascript
// 1. 하이라이트 찾기
const pageId = 'current-page-id';  // 실제 페이지 ID로 변경
const highlightId = 'highlight-id-to-delete';  // 삭제할 하이라이트 ID

// 2. useStore에서 삭제 (React DevTools 필요)
// 또는 페이지 수동 편집
```

## 코드 점검

hover 메뉴 관련 코드 위치:

### PageView.tsx
- **Line 902-959**: useEffect로 hover 이벤트 리스너 설정
- **Line 1548**: HighlightHoverMenu 컴포넌트 렌더링
- **Dependencies**: `[htmlContent, editing, highlightsVisible]`

### highlightService.ts
- **Line 604**: `mark.setAttribute('data-highlight-id', highlight.id)`
- mark 요소 생성 시 반드시 data-highlight-id 추가됨

### 잠재적 버그

**useEffect dependencies:**
```typescript
}, [htmlContent, editing, highlightsVisible]);
```

이것은 정상입니다. `hoveredHighlightId`는 의존성에 없어도 됨 (closure로 접근).

**하지만** 만약 `htmlContent`가 변경되지 않으면 이벤트 리스너가 재등록되지 않습니다.

## 즉시 적용 가능한 Fix

만약 이벤트 리스너 문제라면:

```typescript
// useEffect dependencies에 themeVersion 추가
}, [htmlContent, editing, highlightsVisible, themeVersion]);
```

이렇게 하면 테마 변경 시에도 이벤트 리스너가 재등록됩니다.
