# My Kanban 개선 로드맵

**작성일:** 2026-02-28
**관점:** 개인 생산성 도구
**목적:** Notion 유료 없이 보드뷰 사용 + 회사 보안 정책 준수

---

## 📌 프로젝트 컨텍스트

### 원래 목적
- Notion 유료 결제 회피 (개인 보드뷰 사용 목적)
- 회사 컴퓨터 제약 해결 (클라우드 제한적, Git/Google Drive OK)
- 로컬 우선 도구로 데이터 완전 통제

### 현재 달성한 것
- ✅ Notion 보드뷰 대체 (Board, List, Compact)
- ✅ 마크다운 페이지 편집
- ✅ 로컬 파일 저장 → Git 친화적
- ✅ 드래그 앤 드롭 칸반
- ✅ 계층적 페이지 구조
- ✅ 이미지, 다이어그램, 코드 블록 지원

### 필요 없는 것
- ❌ 협업 기능 (개인 도구)
- ❌ 클라우드 서버 (로컬 우선)
- ❌ 모바일 앱 (데스크탑 중심)
- ❌ 상업화 (개인 프로젝트)

---

## 🎯 개선 우선순위

### Priority 1: 개인 생산성 극대화
- 로컬 AI 통합 (완전 오프라인)
- 주간/월간 요약 자동 생성
- 템플릿 시스템
- 빠른 캡처

### Priority 2: Git 워크플로우 개선
- Git UI 통합
- 자동 커밋 옵션
- 충돌 해결 도구

### Priority 3: 검색 & 필터 강화
- 전역 검색 속도 개선
- 고급 필터
- 정규식 지원

### Priority 4: 멀티 디바이스 (개인)
- 집 ↔ 회사 동기화 매끄럽게
- Google Drive 통합 (옵션)

---

## 🚀 Phase 1: AI 기반 생산성 (1-2개월)

### 1.1 로컬 AI 통합 (Ollama)

**목표:** 완전 오프라인, 프라이버시 보장된 AI 기능

**구현 계획:**

```typescript
// services/localAIService.ts
import Ollama from 'ollama';

interface LocalAIConfig {
  model: string; // 'llama3.2', 'mistral', etc.
  baseUrl: string; // 'http://localhost:11434'
}

class LocalAIService {
  private ollama: Ollama;

  async summarizePage(content: string): Promise<string> {
    const response = await this.ollama.chat({
      model: 'llama3.2',
      messages: [{
        role: 'user',
        content: `다음 마크다운 페이지를 3줄로 요약해주세요:\n\n${content}`
      }]
    });
    return response.message.content;
  }

  async generateWeeklySummary(pages: Page[]): Promise<string> {
    // 지난 주 생성/수정된 페이지 분석
    const summary = {
      newPages: pages.filter(/* 신규 */),
      updatedPages: pages.filter(/* 수정 */),
      completedTodos: this.countCompletedTodos(pages),
      columnStats: this.getColumnStats(pages)
    };

    return await this.ollama.chat({
      model: 'llama3.2',
      messages: [{
        role: 'user',
        content: this.buildWeeklySummaryPrompt(summary)
      }]
    });
  }

  async suggestTags(content: string): Promise<string[]> {
    // 내용 분석해서 태그 제안
  }

  async improveSearch(query: string, pages: Page[]): Promise<Page[]> {
    // 시맨틱 검색 (임베딩 기반)
  }
}
```

**설정 UI (Settings.tsx):**

```tsx
<div className="settings-section">
  <h3>🤖 로컬 AI (Ollama)</h3>

  <label>
    <input type="checkbox" checked={aiEnabled} />
    Enable local AI features
  </label>

  <select value={aiModel}>
    <option value="llama3.2">Llama 3.2 (3B - 빠름)</option>
    <option value="llama3.2:7b">Llama 3.2 (7B - 균형)</option>
    <option value="mistral">Mistral (7B - 한국어 좋음)</option>
  </select>

  <p className="help-text">
    Ollama 설치 필요: <a href="https://ollama.ai">ollama.ai</a>
  </p>

  <button onClick={testConnection}>Test Connection</button>
</div>
```

**기능:**
- ✅ 페이지 요약 (긴 페이지 읽기 전 미리보기)
- ✅ 주간/월간 리뷰 자동 생성
- ✅ 태그 자동 제안
- ✅ 시맨틱 검색 (검색어와 의미적으로 유사한 페이지 찾기)
- ✅ 마크다운 자동 정리 (포맷팅, 링크 수정 등)

**장점:**
- 완전 오프라인 (회사에서도 사용 가능)
- 프라이버시 보장 (데이터 외부로 안 나감)
- 무료 (Ollama 오픈소스)
- 빠름 (로컬 GPU 활용)

**단점:**
- Ollama 설치 필요
- GPU 없으면 느릴 수 있음 (CPU 모드 가능)
- 모델 다운로드 필요 (1-4GB)

---

### 1.2 주간 요약 자동 생성

**기능 설명:**

```typescript
// services/weeklyReviewService.ts
interface WeeklyReviewConfig {
  enabled: boolean;
  dayOfWeek: number; // 0 = Sunday
  time: string; // "20:00"
  autoGenerate: boolean;
  saveLocation: string; // "Reviews" folder
}

async function generateWeeklyReview(): Promise<Page> {
  const weeklyData = await analyzeWeeklyActivity();

  // AI로 인사이트 생성 (선택적)
  const aiSummary = aiEnabled
    ? await localAI.generateWeeklySummary(weeklyData)
    : null;

  const content = `
# 주간 리뷰 - ${getWeekRange()}

## 📊 이번 주 활동

### 생성된 페이지 (${weeklyData.newPages.length}개)
${weeklyData.newPages.map(p => `- [[${p.title}]]`).join('\n')}

### 업데이트된 페이지 (${weeklyData.updatedPages.length}개)
${weeklyData.updatedPages.map(p => `- [[${p.title}]]`).join('\n')}

### 완료된 작업
- ✅ Todo 완료: ${weeklyData.completedTodos}개
- 🔄 컬럼 이동: ${weeklyData.columnMoves}개

### 컬럼별 분포
${Object.entries(weeklyData.columnDistribution)
  .map(([col, count]) => `- ${col}: ${count}개`)
  .join('\n')}

## 💡 AI 인사이트 (Powered by Llama 3.2)

${aiSummary || '(AI 비활성화)'}

## 📝 다음 주 계획

- [ ]
- [ ]
- [ ]

---
*자동 생성: ${new Date().toLocaleString('ko-KR')}*
  `;

  return {
    id: generateId(),
    title: `주간 리뷰 - Week ${getWeekNumber()}`,
    content,
    parentId: getReviewsFolder(),
    kanbanColumn: 'Archive',
    tags: ['review', 'weekly'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    viewType: 'document'
  };
}
```

**Tauri 백그라운드 스케줄링:**

```rust
// src-tauri/src/scheduler.rs
use tokio_cron_scheduler::{JobScheduler, Job};

pub async fn setup_weekly_review(app_handle: tauri::AppHandle) {
    let scheduler = JobScheduler::new().await.unwrap();

    // 매주 일요일 오후 8시
    let job = Job::new_async("0 0 20 * * SUN", move |_uuid, _lock| {
        let app_handle = app_handle.clone();
        Box::pin(async move {
            // Frontend로 이벤트 전송
            app_handle.emit_all("generate-weekly-review", {}).unwrap();
        })
    }).unwrap();

    scheduler.add(job).await.unwrap();
    scheduler.start().await.unwrap();
}
```

**UI 옵션 (Settings):**

```tsx
<div className="settings-section">
  <h3>📅 주간 리뷰</h3>

  <label>
    <input type="checkbox" checked={weeklyReviewEnabled} />
    자동으로 주간 리뷰 생성
  </label>

  <div className="schedule-settings">
    <label>
      요일:
      <select value={dayOfWeek}>
        <option value="0">일요일</option>
        <option value="6">토요일</option>
        <option value="5">금요일</option>
      </select>
    </label>

    <label>
      시간:
      <input type="time" value={reviewTime} />
    </label>
  </div>

  <label>
    저장 위치:
    <select value={saveFolder}>
      <option value="root">루트</option>
      <option value="reviews">Reviews 폴더</option>
      <option value="archive">Archive 폴더</option>
    </select>
  </label>

  <button onClick={generateNow}>지금 생성</button>
</div>
```

**추가 기능:**
- 월간 리뷰 (한 달 단위)
- 분기별 리뷰 (3개월)
- 커스텀 기간 (지난 2주, 지난 30일 등)

---

### 1.3 태그 자동 제안

**기능:**

```typescript
// PageEditor.tsx
const [suggestedTags, setSuggestedTags] = useState<string[]>([]);

useEffect(() => {
  const analyzeTags = async () => {
    if (!aiEnabled) return;

    // 내용 분석해서 태그 제안
    const suggestions = await localAI.suggestTags(content);
    setSuggestedTags(suggestions);
  };

  // Debounce: 내용 변경 후 2초 뒤 실행
  const timer = setTimeout(analyzeTags, 2000);
  return () => clearTimeout(timer);
}, [content]);

// UI
<div className="tag-suggestions">
  {suggestedTags.map(tag => (
    <button
      key={tag}
      className="suggested-tag"
      onClick={() => addTag(tag)}
    >
      + {tag}
    </button>
  ))}
</div>
```

**AI 프롬프트:**

```
다음 마크다운 문서의 내용을 분석해서 적절한 태그 3-5개를 제안해주세요.
기존 태그: [${existingTags.join(', ')}]

내용:
${content.slice(0, 1000)} // 처음 1000자만

규칙:
- 간결하게 (1-2 단어)
- 소문자
- 기존 태그와 일관성 유지
- 너무 일반적인 태그 피하기 (예: "노트", "메모")

JSON 배열로 답변: ["tag1", "tag2", "tag3"]
```

---

## 🎨 Phase 2: 템플릿 & 빠른 캡처 (1개월)

### 2.1 템플릿 시스템

**데이터 모델:**

```typescript
// types/template.ts
interface PageTemplate {
  id: string;
  name: string;
  description: string;
  icon?: string;
  category: string; // 'work', 'personal', 'project', etc.
  content: string; // 마크다운 템플릿
  frontmatter: Partial<Page>; // 기본 메타데이터
  variables?: TemplateVariable[]; // {{title}}, {{date}} 등
}

interface TemplateVariable {
  name: string;
  type: 'text' | 'date' | 'select' | 'number';
  label: string;
  defaultValue?: string;
  options?: string[]; // for select type
}

// 예시 템플릿
const WEEKLY_REVIEW_TEMPLATE: PageTemplate = {
  id: 'weekly-review',
  name: '주간 리뷰',
  description: '매주 돌아보는 리뷰 템플릿',
  icon: '📅',
  category: 'personal',
  frontmatter: {
    tags: ['review', 'weekly'],
    kanbanColumn: 'Archive'
  },
  variables: [
    { name: 'weekNumber', type: 'number', label: '주차' },
    { name: 'startDate', type: 'date', label: '시작일' },
    { name: 'endDate', type: 'date', label: '종료일' }
  ],
  content: `# 주간 리뷰 - Week {{weekNumber}}

**기간:** {{startDate}} ~ {{endDate}}

## 이번 주 성과
-

## 배운 것
-

## 다음 주 계획
- [ ]
- [ ]
- [ ]

## 회고
`
};
```

**템플릿 사용 UI:**

```tsx
// components/TemplateModal.tsx
function TemplateModal({ onClose, onCreate }) {
  const [category, setCategory] = useState<string>('all');
  const [selected, setSelected] = useState<PageTemplate | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});

  const templates = useTemplates(); // Built-in + Custom
  const filteredTemplates = category === 'all'
    ? templates
    : templates.filter(t => t.category === category);

  const handleCreate = () => {
    const content = renderTemplate(selected.content, variables);
    const page = {
      ...selected.frontmatter,
      title: variables.title || selected.name,
      content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    onCreate(page);
  };

  return (
    <Modal>
      <div className="template-categories">
        <button onClick={() => setCategory('all')}>All</button>
        <button onClick={() => setCategory('work')}>Work</button>
        <button onClick={() => setCategory('personal')}>Personal</button>
        <button onClick={() => setCategory('project')}>Project</button>
      </div>

      <div className="template-grid">
        {filteredTemplates.map(template => (
          <div
            key={template.id}
            className={`template-card ${selected?.id === template.id ? 'selected' : ''}`}
            onClick={() => setSelected(template)}
          >
            <div className="template-icon">{template.icon}</div>
            <h4>{template.name}</h4>
            <p>{template.description}</p>
          </div>
        ))}
      </div>

      {selected && (
        <div className="template-variables">
          <h3>템플릿 설정</h3>
          {selected.variables?.map(variable => (
            <label key={variable.name}>
              {variable.label}:
              {variable.type === 'select' ? (
                <select
                  value={variables[variable.name]}
                  onChange={(e) => setVariables({...variables, [variable.name]: e.target.value})}
                >
                  {variable.options.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={variable.type}
                  value={variables[variable.name] || variable.defaultValue}
                  onChange={(e) => setVariables({...variables, [variable.name]: e.target.value})}
                />
              )}
            </label>
          ))}
        </div>
      )}

      <div className="modal-actions">
        <button onClick={onClose}>취소</button>
        <button onClick={handleCreate} disabled={!selected}>생성</button>
      </div>
    </Modal>
  );
}
```

**기본 템플릿 제공:**

```typescript
// data/defaultTemplates.ts
export const DEFAULT_TEMPLATES: PageTemplate[] = [
  {
    id: 'blank',
    name: '빈 페이지',
    icon: '📄',
    category: 'general',
    content: ''
  },
  {
    id: 'meeting-notes',
    name: '회의록',
    icon: '📝',
    category: 'work',
    content: `# {{title}}

**날짜:** {{date}}
**참석자:** {{attendees}}

## 안건
-

## 논의 내용
-

## 액션 아이템
- [ ]
- [ ]

## 다음 회의
`
  },
  {
    id: 'project-brief',
    name: '프로젝트 브리프',
    icon: '🚀',
    category: 'project',
    content: `# {{projectName}}

## 목표
-

## 범위
**In scope:**
-

**Out of scope:**
-

## 타임라인
- Start: {{startDate}}
- End: {{endDate}}

## 팀
- PM:
- Dev:
- Design:

## 리소스
-

## 리스크
-
`
  },
  {
    id: 'daily-note',
    name: '데일리 노트',
    icon: '📆',
    category: 'personal',
    content: `# {{date}}

## 오늘의 목표
- [ ]
- [ ]
- [ ]

## 메모
-

## 완료한 일
- [x]

## 내일 할 일
- [ ]
`
  },
  {
    id: 'book-notes',
    name: '독서 노트',
    icon: '📚',
    category: 'personal',
    content: `# {{bookTitle}}

**저자:** {{author}}
**읽은 날짜:** {{date}}
**평점:** {{rating}}/5

## 요약
-

## 인상 깊은 문구
>

## 배운 점
-

## 적용할 점
- [ ]
`
  }
];
```

**커스텀 템플릿 생성:**

```tsx
// Settings.tsx - Template Management
<div className="settings-section">
  <h3>📋 템플릿 관리</h3>

  <div className="template-list">
    {customTemplates.map(template => (
      <div key={template.id} className="template-item">
        <span>{template.icon} {template.name}</span>
        <div className="template-actions">
          <button onClick={() => editTemplate(template)}>편집</button>
          <button onClick={() => deleteTemplate(template.id)}>삭제</button>
        </div>
      </div>
    ))}
  </div>

  <button onClick={createNewTemplate}>+ 새 템플릿</button>

  <div className="help-text">
    <p>현재 페이지를 템플릿으로 저장할 수 있습니다.</p>
    <p>변수: {{title}}, {{date}}, {{author}} 등</p>
  </div>
</div>
```

**슬래시 커맨드 통합:**

```typescript
// 기존 슬래시 커맨드에 템플릿 추가
const TEMPLATE_COMMANDS: SlashCommand[] = DEFAULT_TEMPLATES.map(template => ({
  id: `template-${template.id}`,
  label: template.name,
  icon: template.icon,
  description: template.description,
  action: () => insertTemplate(template)
}));

// /meeting → 회의록 템플릿 삽입
// /weekly → 주간 리뷰 템플릿 삽입
```

---

### 2.2 빠른 캡처 (Quick Capture)

**목표:** 아이디어를 빠르게 캡처해서 나중에 정리

**글로벌 단축키 (Tauri):**

```rust
// src-tauri/src/main.rs
use tauri::Manager;
use tauri_plugin_global_shortcut::GlobalShortcutExt;

#[tauri::command]
fn show_quick_capture(app: tauri::AppHandle) {
    if let Some(window) = app.get_window("quick-capture") {
        window.show().unwrap();
        window.set_focus().unwrap();
    } else {
        let window = tauri::WindowBuilder::new(
            &app,
            "quick-capture",
            tauri::WindowUrl::App("/quick-capture".into())
        )
        .title("Quick Capture")
        .inner_size(600.0, 400.0)
        .resizable(false)
        .always_on_top(true)
        .build()
        .unwrap();

        window.show().unwrap();
    }
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // Cmd+Shift+N (macOS) / Ctrl+Shift+N (Windows/Linux)
            app.global_shortcut().register("CmdOrCtrl+Shift+N", |app| {
                show_quick_capture(app.app_handle());
            })?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Quick Capture UI:**

```tsx
// pages/QuickCapture.tsx
export function QuickCapture() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [targetColumn, setTargetColumn] = useState('Inbox');

  const handleCapture = async () => {
    const page: Page = {
      id: generateId(),
      title: title || `Quick Note ${new Date().toLocaleString()}`,
      content,
      kanbanColumn: targetColumn,
      tags: ['inbox', 'quick-capture'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      viewType: 'document'
    };

    await pageService.createPage(page);

    // 저장 후 창 닫기
    setTitle('');
    setContent('');
    window.close(); // Tauri window
  };

  return (
    <div className="quick-capture">
      <h2>⚡ Quick Capture</h2>

      <input
        type="text"
        placeholder="제목 (선택사항)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
      />

      <textarea
        placeholder="내용을 입력하세요..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={10}
      />

      <div className="capture-options">
        <label>
          저장 위치:
          <select value={targetColumn} onChange={(e) => setTargetColumn(e.target.value)}>
            <option value="Inbox">Inbox</option>
            <option value="To Do">To Do</option>
            <option value="Ideas">Ideas</option>
          </select>
        </label>
      </div>

      <div className="capture-actions">
        <button onClick={() => window.close()}>취소 (Esc)</button>
        <button onClick={handleCapture} className="primary">
          저장 (Cmd+Enter)
        </button>
      </div>

      <div className="capture-hint">
        💡 Cmd+Shift+N 으로 언제든지 열 수 있습니다
      </div>
    </div>
  );
}
```

**키보드 단축키:**

```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Cmd+Enter / Ctrl+Enter: 저장
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleCapture();
    }

    // Esc: 취소
    if (e.key === 'Escape') {
      window.close();
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);
```

**추가 기능:**
- 클립보드 내용 자동 붙여넣기
- 웹 URL 캡처 (제목, 링크 자동 추출)
- 이미지 첨부
- 음성 메모 (Speech-to-Text)

---

## ⚙️ Phase 3: Git 워크플로우 개선 (1-2개월)

### 3.1 Git UI 통합

**목표:** 앱 내에서 Git 작업을 매끄럽게

**현재 워크플로우 문제점:**
```
1. 파일 편집
2. 터미널 열기
3. cd workspace
4. git add .
5. git commit -m "message"
6. git push
→ 너무 번거로움, 자주 까먹음
```

**개선된 워크플로우:**
```
1. 파일 편집
2. 하단 상태바에 "2 changes" 표시
3. 클릭 → Git 패널 열림
4. Commit message 입력 → Commit & Push
→ 훨씬 빠름
```

**구현:**

```typescript
// services/gitService.ts
import simpleGit, { SimpleGit } from 'simple-git';

class GitService {
  private git: SimpleGit;

  constructor(workspacePath: string) {
    this.git = simpleGit(workspacePath);
  }

  async getStatus(): Promise<GitStatus> {
    const status = await this.git.status();
    return {
      modified: status.modified,
      created: status.created,
      deleted: status.deleted,
      renamed: status.renamed,
      staged: status.staged,
      branch: status.current,
      ahead: status.ahead,
      behind: status.behind
    };
  }

  async commit(message: string, files?: string[]): Promise<void> {
    if (files) {
      await this.git.add(files);
    } else {
      await this.git.add('.');
    }
    await this.git.commit(message);
  }

  async push(): Promise<void> {
    await this.git.push();
  }

  async pull(): Promise<void> {
    await this.git.pull();
  }

  async sync(): Promise<void> {
    // Pull → Commit → Push
    await this.pull();
    const status = await this.getStatus();
    if (status.modified.length > 0 || status.created.length > 0) {
      await this.commit(this.generateAutoCommitMessage(status));
      await this.push();
    }
  }

  private generateAutoCommitMessage(status: GitStatus): string {
    const parts = [];
    if (status.created.length > 0) parts.push(`${status.created.length} new`);
    if (status.modified.length > 0) parts.push(`${status.modified.length} updated`);
    if (status.deleted.length > 0) parts.push(`${status.deleted.length} deleted`);
    return `Auto: ${parts.join(', ')} - ${new Date().toLocaleString()}`;
  }

  async getDiff(file: string): Promise<string> {
    return await this.git.diff([file]);
  }

  async getLog(count: number = 10): Promise<GitCommit[]> {
    const log = await this.git.log({ maxCount: count });
    return log.all;
  }
}
```

**Git 패널 UI:**

```tsx
// components/GitPanel.tsx
export function GitPanel() {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [commitMessage, setCommitMessage] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [showDiff, setShowDiff] = useState<string | null>(null);

  useEffect(() => {
    // 5초마다 상태 체크
    const interval = setInterval(async () => {
      const s = await gitService.getStatus();
      setStatus(s);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCommit = async () => {
    await gitService.commit(commitMessage, selectedFiles);
    setCommitMessage('');
    setSelectedFiles([]);
    // Refresh status
    setStatus(await gitService.getStatus());
  };

  const handleSync = async () => {
    await gitService.sync();
    setStatus(await gitService.getStatus());
  };

  if (!status) return <div>Loading...</div>;

  const hasChanges = status.modified.length + status.created.length + status.deleted.length > 0;

  return (
    <div className="git-panel">
      <div className="git-header">
        <h3>Git Changes</h3>
        <div className="git-actions">
          <button onClick={handleSync} disabled={!hasChanges}>
            🔄 Sync
          </button>
          <span className="branch-indicator">📍 {status.branch}</span>
        </div>
      </div>

      {hasChanges ? (
        <>
          <div className="git-changes">
            {status.created.map(file => (
              <div key={file} className="git-file new">
                <input
                  type="checkbox"
                  checked={selectedFiles.includes(file)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedFiles([...selectedFiles, file]);
                    } else {
                      setSelectedFiles(selectedFiles.filter(f => f !== file));
                    }
                  }}
                />
                <span className="file-status">A</span>
                <span className="file-name">{file}</span>
                <button onClick={() => setShowDiff(file)}>Diff</button>
              </div>
            ))}

            {status.modified.map(file => (
              <div key={file} className="git-file modified">
                <input type="checkbox" />
                <span className="file-status">M</span>
                <span className="file-name">{file}</span>
                <button onClick={() => setShowDiff(file)}>Diff</button>
              </div>
            ))}

            {status.deleted.map(file => (
              <div key={file} className="git-file deleted">
                <input type="checkbox" />
                <span className="file-status">D</span>
                <span className="file-name">{file}</span>
              </div>
            ))}
          </div>

          <div className="git-commit">
            <textarea
              placeholder="Commit message..."
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              rows={3}
            />
            <div className="commit-actions">
              <button onClick={handleCommit} disabled={!commitMessage}>
                Commit
              </button>
              <button onClick={async () => {
                await handleCommit();
                await gitService.push();
              }}>
                Commit & Push
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="git-empty">
          ✅ No changes
          {status.ahead > 0 && (
            <div className="git-ahead">
              ↑ {status.ahead} commits ahead
              <button onClick={() => gitService.push()}>Push</button>
            </div>
          )}
        </div>
      )}

      {showDiff && (
        <DiffViewer
          file={showDiff}
          onClose={() => setShowDiff(null)}
        />
      )}
    </div>
  );
}
```

**하단 상태바 통합:**

```tsx
// components/Layout.tsx
<div className="status-bar">
  <div className="status-left">
    {gitStatus && (
      <button
        className="git-status-btn"
        onClick={() => setShowGitPanel(!showGitPanel)}
      >
        <span className="material-symbols-outlined">source</span>
        {gitStatus.modified.length + gitStatus.created.length > 0 ? (
          <span className="changes-count">
            {gitStatus.modified.length + gitStatus.created.length} changes
          </span>
        ) : (
          <span>No changes</span>
        )}
      </button>
    )}
  </div>

  <div className="status-right">
    <span>📍 {gitStatus?.branch}</span>
    {gitStatus?.ahead > 0 && <span>↑{gitStatus.ahead}</span>}
    {gitStatus?.behind > 0 && <span>↓{gitStatus.behind}</span>}
  </div>
</div>
```

---

### 3.2 자동 커밋 옵션

**설정:**

```tsx
// Settings.tsx
<div className="settings-section">
  <h3>⚙️ Git 자동화</h3>

  <label>
    <input
      type="checkbox"
      checked={autoCommit}
      onChange={(e) => setAutoCommit(e.target.checked)}
    />
    변경사항 자동 커밋
  </label>

  {autoCommit && (
    <>
      <label>
        커밋 간격:
        <select value={autoCommitInterval}>
          <option value="save">저장할 때마다</option>
          <option value="5">5분마다</option>
          <option value="15">15분마다</option>
          <option value="30">30분마다</option>
          <option value="60">1시간마다</option>
        </select>
      </label>

      <label>
        <input type="checkbox" checked={autoPush} />
        자동으로 Push (커밋 후)
      </label>

      <label>
        커밋 메시지 형식:
        <select value={commitMessageFormat}>
          <option value="auto">자동 생성</option>
          <option value="ai">AI 생성 (Ollama)</option>
          <option value="timestamp">타임스탬프</option>
        </select>
      </label>
    </>
  )}
</div>
```

**구현:**

```typescript
// services/autoCommitService.ts
class AutoCommitService {
  private interval: NodeJS.Timeout | null = null;

  start(config: AutoCommitConfig) {
    if (config.trigger === 'save') {
      // 저장할 때마다 커밋
      window.addEventListener('page-saved', this.handleSave);
    } else {
      // 주기적 커밋
      const minutes = parseInt(config.interval);
      this.interval = setInterval(() => {
        this.commitIfChanges();
      }, minutes * 60 * 1000);
    }
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    window.removeEventListener('page-saved', this.handleSave);
  }

  private async commitIfChanges() {
    const status = await gitService.getStatus();
    if (status.modified.length + status.created.length === 0) return;

    const message = await this.generateCommitMessage(status);
    await gitService.commit(message);

    if (config.autoPush) {
      await gitService.push();
    }
  }

  private async generateCommitMessage(status: GitStatus): Promise<string> {
    switch (config.messageFormat) {
      case 'ai':
        // AI가 diff 분석해서 메시지 생성
        const diff = await gitService.getDiff('.');
        return await localAI.generateCommitMessage(diff);

      case 'timestamp':
        return `Auto-commit: ${new Date().toISOString()}`;

      case 'auto':
      default:
        return gitService.generateAutoCommitMessage(status);
    }
  }
}
```

---

### 3.3 충돌 해결 도구

**충돌 감지:**

```typescript
// services/gitService.ts
async detectConflicts(): Promise<ConflictFile[]> {
  try {
    await this.git.pull();
    return [];
  } catch (error) {
    if (error.message.includes('CONFLICT')) {
      const status = await this.git.status();
      return status.conflicted.map(file => ({
        path: file,
        content: await fs.readFile(file, 'utf-8')
      }));
    }
    throw error;
  }
}
```

**충돌 해결 UI:**

```tsx
// components/ConflictResolver.tsx
export function ConflictResolver({ conflicts }: { conflicts: ConflictFile[] }) {
  const [selected, setSelected] = useState(conflicts[0]);
  const [resolution, setResolution] = useState<'ours' | 'theirs' | 'manual'>('manual');

  const parseConflict = (content: string) => {
    // Parse <<<<<<< ======= >>>>>>> markers
    const sections = [];
    let current = '';
    let inConflict = false;

    content.split('\n').forEach(line => {
      if (line.startsWith('<<<<<<<')) {
        inConflict = true;
        sections.push({ type: 'ours', lines: [] });
      } else if (line.startsWith('=======')) {
        sections.push({ type: 'theirs', lines: [] });
      } else if (line.startsWith('>>>>>>>')) {
        inConflict = false;
      } else if (inConflict) {
        sections[sections.length - 1].lines.push(line);
      } else {
        sections.push({ type: 'normal', lines: [line] });
      }
    });

    return sections;
  };

  const handleResolve = async () => {
    let resolved: string;

    if (resolution === 'ours') {
      resolved = await gitService.resolveConflict(selected.path, 'ours');
    } else if (resolution === 'theirs') {
      resolved = await gitService.resolveConflict(selected.path, 'theirs');
    } else {
      // Manual resolution
      resolved = manuallyResolvedContent;
    }

    await fs.writeFile(selected.path, resolved);
    await gitService.add(selected.path);

    // Next conflict
    const remaining = conflicts.filter(c => c.path !== selected.path);
    if (remaining.length > 0) {
      setSelected(remaining[0]);
    } else {
      // All resolved
      await gitService.commit('Merge conflict resolved');
    }
  };

  return (
    <div className="conflict-resolver">
      <div className="conflict-header">
        <h3>⚠️ Merge Conflicts ({conflicts.length})</h3>
        <select
          value={selected.path}
          onChange={(e) => setSelected(conflicts.find(c => c.path === e.target.value)!)}
        >
          {conflicts.map(c => (
            <option key={c.path} value={c.path}>{c.path}</option>
          ))}
        </select>
      </div>

      <div className="conflict-resolution">
        <div className="resolution-options">
          <button
            className={resolution === 'ours' ? 'active' : ''}
            onClick={() => setResolution('ours')}
          >
            Keep Local (내 변경사항)
          </button>
          <button
            className={resolution === 'theirs' ? 'active' : ''}
            onClick={() => setResolution('theirs')}
          >
            Keep Remote (서버 변경사항)
          </button>
          <button
            className={resolution === 'manual' ? 'active' : ''}
            onClick={() => setResolution('manual')}
          >
            Manual Merge
          </button>
        </div>

        <div className="conflict-diff">
          {parseConflict(selected.content).map((section, i) => (
            <div key={i} className={`conflict-section ${section.type}`}>
              {section.type === 'ours' && <div className="section-label">Local</div>}
              {section.type === 'theirs' && <div className="section-label">Remote</div>}
              <pre>{section.lines.join('\n')}</pre>
            </div>
          ))}
        </div>
      </div>

      <div className="conflict-actions">
        <button onClick={handleResolve}>Resolve & Continue</button>
      </div>
    </div>
  );
}
```

---

## 🔍 Phase 4: 검색 & 필터 강화 (2주)

### 4.1 전역 검색 속도 개선

**현재 문제:**
- 모든 파일 파싱 → 느림
- 대용량 워크스페이스에서 검색 지연

**해결 방안: 검색 인덱스**

```typescript
// services/searchIndexService.ts
import FlexSearch from 'flexsearch';

class SearchIndexService {
  private index: FlexSearch.Document;

  constructor() {
    this.index = new FlexSearch.Document({
      document: {
        id: 'id',
        index: ['title', 'content', 'tags'],
        store: ['title', 'excerpt']
      },
      tokenize: 'forward',
      optimize: true,
      cache: true
    });
  }

  async buildIndex(pages: Page[]) {
    for (const page of pages) {
      await this.index.addAsync({
        id: page.id,
        title: page.title,
        content: page.content,
        tags: page.tags?.join(' ') || '',
        excerpt: markdownService.getExcerpt(page.content)
      });
    }
  }

  async search(query: string): Promise<SearchResult[]> {
    const results = await this.index.searchAsync(query, {
      limit: 50,
      enrich: true
    });

    return results.flatMap(result =>
      result.result.map(doc => ({
        id: doc.id,
        title: doc.doc.title,
        excerpt: doc.doc.excerpt,
        score: doc.score
      }))
    );
  }

  async updateDocument(page: Page) {
    await this.index.updateAsync({
      id: page.id,
      title: page.title,
      content: page.content,
      tags: page.tags?.join(' ') || ''
    });
  }

  async removeDocument(pageId: string) {
    await this.index.removeAsync(pageId);
  }
}
```

**사용:**

```tsx
// Sidebar.tsx
const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

const handleSearch = useMemo(
  () => debounce(async (query: string) => {
    if (!query) {
      setSearchResults([]);
      return;
    }

    const results = await searchIndexService.search(query);
    setSearchResults(results);
  }, 300),
  []
);

<input
  type="search"
  placeholder="Search pages..."
  onChange={(e) => handleSearch(e.target.value)}
/>
```

---

### 4.2 고급 필터

**필터 UI:**

```tsx
// components/AdvancedFilter.tsx
interface FilterCriteria {
  tags?: { mode: 'AND' | 'OR', values: string[] };
  dateRange?: { start: string, end: string };
  column?: string[];
  hasCheckbox?: boolean;
  hasDueDate?: boolean;
  createdBy?: string; // future: multi-user
}

export function AdvancedFilter({ onFilter }: { onFilter: (criteria: FilterCriteria) => void }) {
  const [criteria, setCriteria] = useState<FilterCriteria>({});

  return (
    <div className="advanced-filter">
      <h4>고급 필터</h4>

      {/* Tags */}
      <div className="filter-group">
        <label>Tags:</label>
        <div className="tag-filter">
          <select
            value={criteria.tags?.mode}
            onChange={(e) => setCriteria({
              ...criteria,
              tags: { ...criteria.tags, mode: e.target.value as 'AND' | 'OR' }
            })}
          >
            <option value="AND">All of (AND)</option>
            <option value="OR">Any of (OR)</option>
          </select>
          <TagSelector
            selected={criteria.tags?.values || []}
            onChange={(tags) => setCriteria({
              ...criteria,
              tags: { ...criteria.tags, values: tags }
            })}
          />
        </div>
      </div>

      {/* Date Range */}
      <div className="filter-group">
        <label>Created Date:</label>
        <input
          type="date"
          value={criteria.dateRange?.start}
          onChange={(e) => setCriteria({
            ...criteria,
            dateRange: { ...criteria.dateRange, start: e.target.value }
          })}
        />
        <span>to</span>
        <input
          type="date"
          value={criteria.dateRange?.end}
          onChange={(e) => setCriteria({
            ...criteria,
            dateRange: { ...criteria.dateRange, end: e.target.value }
          })}
        />
      </div>

      {/* Columns */}
      <div className="filter-group">
        <label>Columns:</label>
        <MultiSelect
          options={allColumns}
          selected={criteria.column || []}
          onChange={(cols) => setCriteria({ ...criteria, column: cols })}
        />
      </div>

      {/* Has Checkbox */}
      <div className="filter-group">
        <label>
          <input
            type="checkbox"
            checked={criteria.hasCheckbox}
            onChange={(e) => setCriteria({ ...criteria, hasCheckbox: e.target.checked })}
          />
          Has TODO items
        </label>
      </div>

      {/* Has Due Date */}
      <div className="filter-group">
        <label>
          <input
            type="checkbox"
            checked={criteria.hasDueDate}
            onChange={(e) => setCriteria({ ...criteria, hasDueDate: e.target.checked })}
          />
          Has due date
        </label>
      </div>

      <div className="filter-actions">
        <button onClick={() => setCriteria({})}>Clear</button>
        <button onClick={() => onFilter(criteria)}>Apply</button>
      </div>
    </div>
  );
}
```

**필터 로직:**

```typescript
// utils/filterPages.ts
export function filterPages(pages: Page[], criteria: FilterCriteria): Page[] {
  return pages.filter(page => {
    // Tags
    if (criteria.tags && criteria.tags.values.length > 0) {
      const pageTags = page.tags || [];
      const match = criteria.tags.mode === 'AND'
        ? criteria.tags.values.every(tag => pageTags.includes(tag))
        : criteria.tags.values.some(tag => pageTags.includes(tag));
      if (!match) return false;
    }

    // Date Range
    if (criteria.dateRange) {
      const created = new Date(page.createdAt);
      if (criteria.dateRange.start && created < new Date(criteria.dateRange.start)) {
        return false;
      }
      if (criteria.dateRange.end && created > new Date(criteria.dateRange.end)) {
        return false;
      }
    }

    // Columns
    if (criteria.column && criteria.column.length > 0) {
      if (!page.kanbanColumn || !criteria.column.includes(page.kanbanColumn)) {
        return false;
      }
    }

    // Has Checkbox
    if (criteria.hasCheckbox) {
      if (!/- \[(x| )\]/i.test(page.content)) {
        return false;
      }
    }

    // Has Due Date
    if (criteria.hasDueDate) {
      if (!page.dueDate) {
        return false;
      }
    }

    return true;
  });
}
```

---

### 4.3 정규식 검색

**검색 옵션:**

```tsx
// Sidebar.tsx
const [searchMode, setSearchMode] = useState<'text' | 'regex'>('text');
const [searchQuery, setSearchQuery] = useState('');

const handleSearch = (query: string) => {
  if (searchMode === 'regex') {
    try {
      const regex = new RegExp(query, 'gi');
      const results = pages.filter(page =>
        regex.test(page.title) || regex.test(page.content)
      );
      setSearchResults(results);
    } catch (error) {
      // Invalid regex
      console.error('Invalid regex:', error);
    }
  } else {
    // Normal text search
    setSearchResults(searchIndexService.search(query));
  }
};

<div className="search-box">
  <input
    type="search"
    placeholder={searchMode === 'regex' ? 'Regex search...' : 'Search...'}
    value={searchQuery}
    onChange={(e) => {
      setSearchQuery(e.target.value);
      handleSearch(e.target.value);
    }}
  />
  <button
    className={`search-mode ${searchMode === 'regex' ? 'active' : ''}`}
    onClick={() => setSearchMode(searchMode === 'text' ? 'regex' : 'text')}
    title="Toggle regex mode"
  >
    .*
  </button>
</div>
```

---

## 📱 Phase 5: 멀티 디바이스 동기화 (선택사항, 1개월)

### 5.1 Google Drive 통합

**장점:**
- 회사에서 허용됨
- 자동 동기화
- 버전 관리 (Drive 자체 기능)
- 추가 비용 없음

**구현:**

```typescript
// services/googleDriveService.ts
import { google } from 'googleapis';

class GoogleDriveService {
  private drive: any;
  private folderId: string;

  async authenticate() {
    // OAuth 2.0 인증
    const auth = await google.auth.getClient({
      scopes: ['https://www.googleapis.com/auth/drive.file']
    });
    this.drive = google.drive({ version: 'v3', auth });
  }

  async selectWorkspaceFolder(): Promise<string> {
    // 사용자가 Drive 폴더 선택
    // → folderId 저장
  }

  async syncToCloud() {
    const localFiles = await fs.readdir(workspacePath);

    for (const file of localFiles) {
      const localPath = path.join(workspacePath, file);
      const localContent = await fs.readFile(localPath, 'utf-8');
      const localHash = md5(localContent);

      // Drive에서 같은 파일 찾기
      const driveFile = await this.findFile(file);

      if (!driveFile) {
        // 업로드
        await this.uploadFile(file, localContent);
      } else {
        // 비교 후 최신 파일로 동기화
        const driveHash = driveFile.md5Checksum;
        if (localHash !== driveHash) {
          // 충돌 또는 업데이트
          await this.resolveConflict(file, localContent, driveFile);
        }
      }
    }
  }

  async syncFromCloud() {
    const driveFiles = await this.listFiles();

    for (const driveFile of driveFiles) {
      const localPath = path.join(workspacePath, driveFile.name);

      if (!await fs.exists(localPath)) {
        // 다운로드
        await this.downloadFile(driveFile);
      }
    }
  }
}
```

**설정 UI:**

```tsx
// Settings.tsx
<div className="settings-section">
  <h3>☁️ Cloud Sync (Google Drive)</h3>

  {!driveConnected ? (
    <button onClick={connectDrive}>
      <img src="/google-drive-icon.svg" />
      Connect Google Drive
    </button>
  ) : (
    <>
      <div className="drive-status">
        ✅ Connected to: {driveFolderName}
        <button onClick={disconnectDrive}>Disconnect</button>
      </div>

      <label>
        <input
          type="checkbox"
          checked={autoSync}
          onChange={(e) => setAutoSync(e.target.checked)}
        />
        Auto-sync (every 5 minutes)
      </label>

      <div className="sync-actions">
        <button onClick={syncNow}>Sync Now</button>
        <button onClick={showSyncHistory}>Sync History</button>
      </div>
    </>
  )}
</div>
```

---

### 5.2 충돌 해결 (Drive)

**충돌 감지:**

```typescript
interface SyncConflict {
  file: string;
  localVersion: { content: string, modifiedAt: string };
  remoteVersion: { content: string, modifiedAt: string };
}

async function detectConflicts(): Promise<SyncConflict[]> {
  const conflicts: SyncConflict[] = [];

  for (const file of allFiles) {
    const local = await getLocalVersion(file);
    const remote = await getDriveVersion(file);

    if (local.hash !== remote.hash) {
      // 시간 비교
      if (local.modifiedAt > remote.modifiedAt) {
        // Local is newer
      } else if (local.modifiedAt < remote.modifiedAt) {
        // Remote is newer
      } else {
        // Same time, different content → conflict
        conflicts.push({ file, local, remote });
      }
    }
  }

  return conflicts;
}
```

**충돌 해결 UI:**

```tsx
// components/SyncConflictResolver.tsx
export function SyncConflictResolver({ conflicts }: { conflicts: SyncConflict[] }) {
  const [selected, setSelected] = useState(conflicts[0]);

  return (
    <div className="sync-conflict-resolver">
      <h3>⚠️ Sync Conflicts</h3>

      <div className="conflict-comparison">
        <div className="version local">
          <h4>Local Version</h4>
          <p>Modified: {selected.localVersion.modifiedAt}</p>
          <pre>{selected.localVersion.content}</pre>
          <button onClick={() => resolveWithLocal(selected)}>
            Use Local
          </button>
        </div>

        <div className="version remote">
          <h4>Remote Version (Drive)</h4>
          <p>Modified: {selected.remoteVersion.modifiedAt}</p>
          <pre>{selected.remoteVersion.content}</pre>
          <button onClick={() => resolveWithRemote(selected)}>
            Use Remote
          </button>
        </div>
      </div>

      <button onClick={() => keepBoth(selected)}>
        Keep Both (create copy)
      </button>
    </div>
  );
}
```

---

## 📊 우선순위 요약

### 🔥 High Priority (꼭 하면 좋은 것)

1. **로컬 AI 통합** (Ollama)
   - 주간 요약 자동 생성
   - 태그 자동 제안
   - 검색 개선
   - 예상 시간: 1-2주

2. **템플릿 시스템**
   - 반복 작업 효율화
   - 기본 템플릿 5-10개 제공
   - 커스텀 템플릿 지원
   - 예상 시간: 1주

3. **Git UI 통합**
   - 앱 내에서 commit/push
   - 상태바에 변경사항 표시
   - 자동 커밋 옵션
   - 예상 시간: 1-2주

### 🟡 Medium Priority (있으면 편한 것)

4. **빠른 캡처**
   - 글로벌 단축키
   - 빠른 메모 저장
   - 예상 시간: 3-5일

5. **검색 개선**
   - 인덱스 기반 빠른 검색
   - 고급 필터
   - 정규식 지원
   - 예상 시간: 1주

6. **Google Drive 동기화**
   - 집 ↔ 회사 자동 동기화
   - 충돌 해결
   - 예상 시간: 2주

### 🟢 Low Priority (나중에 해도 되는 것)

7. **데일리 노트 자동 생성**
8. **음성 메모 (Speech-to-Text)**
9. **이미지 OCR**
10. **PDF export**

---

## 🎯 3개월 로드맵 예시

### Month 1: AI & Productivity
- Week 1-2: Ollama 통합
- Week 3: 주간 요약 자동 생성
- Week 4: 템플릿 시스템

### Month 2: Git Workflow
- Week 1-2: Git UI 통합
- Week 3: 자동 커밋
- Week 4: 충돌 해결 도구

### Month 3: Search & Sync
- Week 1-2: 검색 개선 (인덱스, 필터)
- Week 3-4: Google Drive 동기화 (선택사항)

---

## 📝 체크리스트

개선 작업 시작 전 확인:

- [ ] 현재 코드베이스 안정적으로 작동 중
- [ ] Git으로 현재 상태 커밋
- [ ] 새 브랜치 생성 (feature/ai-integration 등)
- [ ] README 업데이트 계획
- [ ] 테스트 코드 작성 계획

---

## 🔗 참고 자료

### AI 통합
- [Ollama](https://ollama.ai) - 로컬 LLM
- [Ollama JS SDK](https://github.com/ollama/ollama-js)
- [Llama 3.2 모델](https://ollama.ai/library/llama3.2)

### Git 통합
- [simple-git](https://github.com/steveukx/git-js) - Node.js Git wrapper
- [isomorphic-git](https://isomorphic-git.org/) - Pure JS Git

### 검색
- [FlexSearch](https://github.com/nextapps-de/flexsearch) - 빠른 full-text 검색
- [Fuse.js](https://fusejs.io/) - Fuzzy search

### Google Drive
- [Google Drive API](https://developers.google.com/drive)
- [googleapis](https://www.npmjs.com/package/googleapis)

---

**마지막 업데이트:** 2026-02-28
**작성자:** Claude Sonnet 4.5

**이 문서는 살아있는 문서입니다.**
새로운 아이디어나 피드백이 있으면 계속 업데이트하세요.
