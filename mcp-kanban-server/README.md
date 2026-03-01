# My Kanban MCP Server

MCP (Model Context Protocol) 서버로, Claude가 My Kanban 앱의 하이라이트와 메모를 직접 읽고 수정할 수 있게 합니다.

## 기능

### 📄 페이지 관리
- `create_page` - 새로운 페이지 생성 (콘텐츠, 하이라이트, 메모 포함)
- `list_pages` - 모든 페이지 목록 조회 (하이라이트/메모 개수 포함)
- `read_page` - 특정 페이지의 모든 하이라이트와 메모 읽기

### ✏️ 하이라이트 기능
- `add_highlight` - 새로운 하이라이트 추가
- `delete_highlight` - 하이라이트 삭제

### 📝 메모 기능
- `add_memo` - 새로운 메모 추가 (독립형 또는 하이라이트 연결형)
- `update_memo` - 기존 메모 수정
- `delete_memo` - 메모 삭제

## 설치

```bash
cd mcp-kanban-server
npm install
npm run build
```

## 사용 방법

### 1. Claude Desktop 설정에 MCP 서버 추가

`~/Library/Application Support/Claude/claude_desktop_config.json` 파일을 수정:

```json
{
  "mcpServers": {
    "my-kanban": {
      "command": "node",
      "args": [
        "/Users/gahee/my-kanban/mcp-kanban-server/dist/index.js"
      ],
      "env": {
        "KANBAN_WORKSPACE": "/Users/gahee/my-kanban/workspace"
      }
    }
  }
}
```

### 2. Claude Desktop 재시작

설정을 적용하려면 Claude Desktop을 완전히 종료했다가 다시 실행하세요.

### 3. Claude에게 요청하기

이제 Claude에게 이렇게 요청할 수 있습니다:

```
모든 페이지 목록을 보여줘
```

```
"Meeting Notes.md" 페이지의 하이라이트를 읽어줘
```

```
"Project Plan.md" 파일에 하이라이트를 추가해줘:
- 텍스트: "Q1 목표 달성"
- 색상: #FFEB3B
- 스타일: highlight
```

```
방금 추가한 하이라이트에 메모 남겨줘: "중요! 3월 말까지 완료 필요"
```

## 예시 사용 시나리오

### 시나리오 1: 뉴스 기사 분석 (신규 파일 생성)

```
Claude, 다음 뉴스 기사로 "AI News 2024.md" 파일을 만들고,
주요 내용을 하이라이트하고 메모로 요약해줘:

[뉴스 기사 내용 붙여넣기...]
```

Claude가 자동으로:
1. 새 파일 생성
2. 기사 내용 저장
3. 중요한 부분 하이라이트
4. 각 하이라이트에 요약 메모 추가

### 시나리오 2: 중요한 부분 하이라이트하기

```
Claude, "Product Spec.md" 파일을 읽고 가장 중요한 부분 3곳에 노란색 하이라이트를 추가해줘
```

### 시나리오 3: 하이라이트에 메모 추가

```
Claude, 방금 추가한 하이라이트들에 각각 왜 중요한지 메모를 남겨줘
```

### 시나리오 4: 메모 검토 및 수정

```
Claude, "Meeting Notes.md"의 모든 메모를 읽고 중복되거나 불필요한 메모는 삭제해줘
```

### 시나리오 5: 하이라이트 요약

```
Claude, "Book Notes.md"의 모든 하이라이트를 읽고 한 문단으로 요약해줘
```

## 데이터 형식

### Highlight
```typescript
{
  id: string;
  text: string;              // 하이라이트된 텍스트
  color: string;             // 색상 (예: "#FFEB3B")
  style: 'highlight' | 'underline';
  startOffset: number;       // 텍스트 시작 위치
  endOffset: number;         // 텍스트 끝 위치
  contextBefore: string;     // 앞 문맥
  contextAfter: string;      // 뒷 문맥
  createdAt: string;         // ISO 타임스탬프
}
```

### Memo
```typescript
{
  id: string;
  type: 'independent' | 'linked';
  note: string;              // 메모 내용
  highlightId?: string;      // 연결된 하이라이트 ID (linked 타입인 경우)
  highlightText?: string;    // 하이라이트 텍스트 (참조용)
  highlightColor?: string;   // 하이라이트 색상 (참조용)
  tags?: string[];           // 태그
  createdAt: string;
  updatedAt: string;
  order: number;             // 메모 순서
}
```

## 개발

### 빌드
```bash
npm run build
```

### Watch 모드
```bash
npm run watch
```

### 테스트 실행
```bash
npm run dev
```

## 문제 해결

### MCP 서버가 연결되지 않는 경우
1. Claude Desktop을 완전히 종료했는지 확인
2. `claude_desktop_config.json` 경로가 올바른지 확인
3. `KANBAN_WORKSPACE` 환경 변수가 올바른 workspace 경로를 가리키는지 확인
4. `npm run build`를 실행했는지 확인

### Claude가 도구를 못 찾는 경우
- Claude Desktop을 재시작
- View → Developer → Toggle Developer Tools에서 콘솔 확인
- MCP 서버 연결 상태 확인

## 라이선스

MIT
