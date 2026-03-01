# MCP Server Code Review - 실제 코드베이스와의 일치성 검증

## 📋 검토 일자
2024-03-01

## 🎯 검토 목적
My Kanban MCP 서버 코드가 실제 앱의 코드베이스(`src/services/`)와 일치하는지 확인

---

## ❌ 발견된 문제점 (수정 완료)

### 1. ID 생성 방식 불일치 ✅ 수정됨

**문제:**
```typescript
// ❌ MCP Server (Before)
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
// 결과: "1709276400000-xk9f2a8b" (UUID가 아님)

// ✅ Codebase (pageService.ts:81)
id: crypto.randomUUID()
// 결과: "550e8400-e29b-41d4-a716-446655440000" (표준 UUID v4)
```

**영향:**
- 다른 ID 형식으로 인한 호환성 문제
- ID 충돌 가능성 증가

**수정:**
```typescript
// ✅ MCP Server (After)
function generateId(): string {
  return crypto.randomUUID();
}
```

---

### 2. PageFrontmatter 필드 누락 ✅ 수정됨

**문제:**
```typescript
// ❌ MCP Server (Before) - 3개 필드 누락
interface PageFrontmatter {
  id: string;
  title: string;
  // ...
  highlights?: Highlight[];
  memos?: Memo[];
  [key: string]: any;  // ❌ 임의의 필드 허용
}

// ✅ Codebase (page.ts:75-90)
export interface PageFrontmatter {
  // ...
  googleCalendarEventId?: string;  // ❌ 누락
  pinned?: boolean;                // ❌ 누락
  pinnedAt?: string;               // ❌ 누락
  highlights?: Highlight[];
  memos?: Memo[];
}
```

**영향:**
- 구글 캘린더 연동 데이터 손실
- 핀 기능 데이터 손실
- 타입 안전성 저하

**수정:**
```typescript
// ✅ MCP Server (After)
interface PageFrontmatter {
  id: string;
  title: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  dueDate?: string;
  viewType: 'document' | 'kanban';
  parentId?: string;
  kanbanColumn?: string;
  googleCalendarEventId?: string;  // ✅ 추가
  pinned?: boolean;                // ✅ 추가
  pinnedAt?: string;               // ✅ 추가
  highlights?: Highlight[];
  memos?: Memo[];
  // [key: string]: any 제거
}
```

---

### 3. Frontmatter 정규화 누락 ✅ 수정됨

**문제:**
```typescript
// ❌ MCP Server (Before)
async function readPage(filename: string) {
  const parsed = matter(content);
  return {
    frontmatter: parsed.data as PageFrontmatter,  // ❌ 검증 없음
    content: parsed.content,
    path: filePath,
  };
}
```

**잠재적 문제:**
- 잘못된 데이터 타입 (tags가 문자열일 수 있음)
- 필수 필드 누락 (id, title 없을 수 있음)
- 기본값 없음

**Codebase 방식:**
```typescript
// ✅ Codebase (markdown.ts:117-136)
private normalizeFrontmatter(data: any): PageFrontmatter {
  const now = new Date().toISOString();

  return {
    id: data.id || crypto.randomUUID(),        // 기본값
    title: data.title || 'Untitled',           // 기본값
    tags: Array.isArray(data.tags) ? data.tags : [],  // 타입 검증
    createdAt: data.createdAt || now,
    updatedAt: data.updatedAt || now,
    viewType: data.viewType || 'document',
    ...(data.parentId && { parentId: data.parentId }),  // 조건부 포함
    highlights: Array.isArray(data.highlights) ? data.highlights : [],
    memos: Array.isArray(data.memos) ? data.memos : []
  };
}
```

**수정:**
```typescript
// ✅ MCP Server (After) - 동일한 정규화 함수 추가
function normalizeFrontmatter(data: any): PageFrontmatter {
  // ... (코드베이스와 동일)
}

async function readPage(filename: string) {
  const parsed = matter(content);
  return {
    frontmatter: normalizeFrontmatter(parsed.data),  // ✅ 정규화 적용
    content: parsed.content.trim(),
    path: filePath,
  };
}
```

---

### 4. YAML 직렬화 옵션 불일치 ✅ 수정됨

**문제:**
```typescript
// ❌ MCP Server (Before)
const fileContent = matter.stringify(content, frontmatter);
// gray-matter의 기본 YAML 옵션 사용
```

**Codebase 방식:**
```typescript
// ✅ Codebase (markdown.ts:66-68)
serialize(frontmatter: PageFrontmatter, content: string): string {
  const yamlStr = yaml.dump(frontmatter, {
    lineWidth: -1,        // 줄바꿈 안 함
    quotingType: '"',     // 큰따옴표 사용
    forceQuotes: false    // 필요할 때만 따옴표
  });
  return `---\n${yamlStr}---\n${content}\n`;
}
```

**영향:**
- YAML 출력 형식이 다름
- 파일 비교 시 불필요한 diff 발생

**수정:**
```typescript
// ✅ MCP Server (After)
async function writePage(filename: string, frontmatter: PageFrontmatter, content: string) {
  frontmatter.updatedAt = new Date().toISOString();

  const yamlStr = yaml.dump(frontmatter, {
    lineWidth: -1,
    quotingType: '"',
    forceQuotes: false
  });
  const fileContent = `---\n${yamlStr}---\n${content}\n`;
  await fs.writeFile(filePath, fileContent, 'utf-8');
}
```

---

### 5. 파일명 Sanitization 불일치 ✅ 수정됨

**문제:**
```typescript
// ❌ MCP Server (Before)
const filename = `${title.replace(/[/\\?%*:|"<>]/g, '-')}.md`;
// - 다른 regex 패턴
// - 공백 처리 안 함
// - trim 안 함
```

**Codebase 방식:**
```typescript
// ✅ Codebase (pageService.ts:258-263)
private sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '-')  // 정확한 문자들
    .replace(/\s+/g, ' ')            // 여러 공백 → 하나로
    .trim();                         // 앞뒤 공백 제거
}
```

**수정:**
```typescript
// ✅ MCP Server (After)
function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

// create_page에서 사용
const sanitizedName = sanitizeFileName(title);
const filename = `${sanitizedName}.md`;
```

---

## ✅ 올바르게 구현된 부분

### 1. Highlight & Memo 타입 정의 ✅
```typescript
// ✅ 코드베이스와 완전히 일치
interface Highlight {
  id: string;
  text: string;
  color: string;
  style: 'highlight' | 'underline';
  startOffset: number;
  endOffset: number;
  contextBefore: string;
  contextAfter: string;
  createdAt: string;
}

interface Memo {
  id: string;
  type: 'independent' | 'linked';
  note: string;
  highlightId?: string;
  highlightText?: string;
  highlightColor?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  order: number;
}
```

### 2. 파일 구조 ✅
```typescript
// ✅ 단일 .md 파일 사용 (폴더/index.md 아님)
workspace/
├── Page1.md
├── Page2.md
└── Page3.md
```

### 3. gray-matter 사용 ✅
```typescript
// ✅ 동일한 라이브러리 사용
import matter from 'gray-matter';
```

---

## 📊 수정 전후 비교

| 항목 | 수정 전 | 수정 후 |
|------|---------|---------|
| ID 생성 | ❌ 타임스탬프+랜덤 | ✅ UUID v4 |
| PageFrontmatter 필드 | ❌ 3개 누락 | ✅ 완전 일치 |
| Frontmatter 정규화 | ❌ 없음 | ✅ 구현됨 |
| YAML 직렬화 | ❌ 기본 옵션 | ✅ 코드베이스 동일 |
| 파일명 Sanitization | ❌ 불완전 | ✅ 완전 일치 |
| 타입 안전성 | ⚠️ `[key: string]: any` | ✅ 명시적 타입 |

---

## 🧪 테스트 체크리스트

### 필수 테스트
- [ ] 새 페이지 생성 → UUID 형식 확인
- [ ] Frontmatter 읽기 → 정규화 확인
- [ ] 하이라이트 추가 → 타입 일치 확인
- [ ] 메모 추가 → 타입 일치 확인
- [ ] 특수문자 파일명 → Sanitization 확인
- [ ] 기존 앱에서 파일 읽기 → 호환성 확인
- [ ] MCP로 생성한 파일 → 앱에서 읽기 확인

### 테스트 명령어
```bash
# 빌드
cd mcp-kanban-server
npm run build

# 테스트 파일 생성
# Claude Desktop에서:
# "Test Page.md 파일을 만들어줘"

# 생성된 파일 확인
cat ../workspace/Test\ Page.md

# ID가 UUID 형식인지 확인
# frontmatter의 id 필드가 "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" 형식
```

---

## 📝 결론

### 수정 완료됨 ✅
모든 불일치 사항이 수정되었으며, MCP 서버가 이제 실제 코드베이스와 완전히 일치합니다.

### 주요 개선사항
1. **데이터 무결성**: UUID 사용 + 정규화로 데이터 일관성 보장
2. **타입 안전성**: 명시적 타입으로 런타임 에러 방지
3. **호환성**: 코드베이스와 동일한 로직으로 완전 호환
4. **유지보수성**: 코드베이스 변경 시 동기화 쉬움

### 다음 단계
1. Claude Desktop에서 테스트
2. 기존 파일 읽기/쓰기 검증
3. 프로덕션 배포

---

## 🔗 참조 파일

- **Codebase**:
  - `src/services/pageService.ts` (line 66-101, 258-263)
  - `src/services/markdown.ts` (line 66-68, 117-136)
  - `src/types/page.ts` (line 14-90)

- **MCP Server**:
  - `mcp-kanban-server/src/index.ts` (전체)
