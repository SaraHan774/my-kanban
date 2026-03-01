# Quick Fix: Hover Menu 문제

## 즉시 확인할 사항

### 1. highlightsVisible 상태 확인

Console에서:
```javascript
// React DevTools 없이 간접 확인
const content = document.querySelector('.content');
const marks = content?.querySelectorAll('mark.highlight');
console.log('Highlights visible:', marks?.length > 0);

// 또는 직접 확인
// 페이지 상단에 하이라이트 토글 버튼 있는지 확인
// 눈 아이콘 버튼이 활성화되어 있는지
```

### 2. 편집 모드 확인

```javascript
// 편집 모드인지 확인
const editor = document.querySelector('[contenteditable="true"]');
console.log('Editing:', editor !== null);

// 편집 모드면 hover 메뉴 안 나옴!
// Esc 키로 종료
```

### 3. 이벤트 리스너 재등록 강제

Console에서 강제로 재등록:
```javascript
const container = document.querySelector('.content');
const marks = container.querySelectorAll('mark.highlight[data-highlight-id]');

marks.forEach(mark => {
  mark.addEventListener('mouseenter', (e) => {
    console.log('HOVER!', mark.getAttribute('data-highlight-id'));
    alert('Hovered: ' + mark.textContent.substring(0, 20));
  });
});

console.log('이벤트 리스너 수동 등록 완료, 하이라이트에 hover 해보세요');
```

## 가장 가능성 높은 원인

### HMR로 인한 이벤트 리스너 소실

**증상:**
- Vite hot updated 로그가 계속 나옴
- 페이지가 자동으로 새로고침되면서 리스너 소실

**해결:**
1. **Cmd+Shift+R**로 완전 새로고침
2. 또는 브라우저 캐시 클리어
3. 개발 서버 재시작

## 코드 수정 (근본 해결)

문제가 지속되면 다음 수정 적용:

### useEffect에 key 추가

```typescript
// 현재
}, [htmlContent, editing, highlightsVisible]);

// 수정
}, [htmlContent, editing, highlightsVisible, page?.highlights?.length]);
```

이렇게 하면 highlights 개수가 변경될 때마다 이벤트 리스너 재등록.

### 또는 더 강력한 방법

```typescript
const [eventListenerKey, setEventListenerKey] = useState(0);

// highlights가 변경될 때 key 업데이트
useEffect(() => {
  setEventListenerKey(prev => prev + 1);
}, [page?.highlights]);

// 이벤트 리스너 useEffect
}, [htmlContent, editing, highlightsVisible, eventListenerKey]);
```
