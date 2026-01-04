# My PDF Reader - アーキテクチャドキュメント

## 📐 概要

My PDF Readerは、Tauri + React + TypeScriptで構築されたデスクトップアプリケーションです。2つのPDFを左右に並べて同期表示し、複数の論文セットを管理する機能を提供します。

## 🎯 アーキテクチャ目標

1. **軽量性**: メモリ使用量を最小限に抑える（Tauri選定の理由）
2. **型安全性**: TypeScript strictモードで完全な型安全性を保証
3. **シンプルさ**: 過度な抽象化を避け、読みやすいコードを維持
4. **テスタビリティ**: 70%以上のテストカバレッジを達成

## 🏗️ 高レベルアーキテクチャ

```
┌─────────────────────────────────────────────────┐
│                   UI Layer                      │
│  (React Components + Tailwind CSS)              │
├─────────────────────────────────────────────────┤
│              Application Layer                  │
│  (State Management + Business Logic)            │
├─────────────────────────────────────────────────┤
│                 Domain Layer                    │
│  (PDFSet, PDFDocument, ViewState)               │
├─────────────────────────────────────────────────┤
│              Infrastructure Layer               │
│  ┌─────────────┬──────────────┬───────────────┐│
│  │ PDF.js      │ Tauri API    │ File System   ││
│  │ (Rendering) │ (IPC)        │ (pdfs/)       ││
│  └─────────────┴──────────────┴───────────────┘│
└─────────────────────────────────────────────────┘
```

## 📂 ディレクトリ構造

```
my-pdf-reader/
├── src/                          # フロントエンド（React）
│   ├── main.tsx                  # エントリーポイント
│   ├── App.tsx                   # ルートコンポーネント
│   ├── components/               # UIコンポーネント
│   │   ├── SetList/              # セット一覧画面
│   │   │   ├── SetList.tsx
│   │   │   ├── SetCard.tsx
│   │   │   └── NewSetDialog.tsx
│   │   ├── PDFViewer/            # PDF表示画面
│   │   │   ├── PDFViewer.tsx
│   │   │   ├── PDFPanel.tsx
│   │   │   ├── SyncScroller.tsx
│   │   │   └── NavigationBar.tsx
│   │   └── common/               # 共通コンポーネント
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       └── Dialog.tsx
│   ├── features/                 # 機能別ディレクトリ
│   │   ├── pdfSet/               # PDFセット管理
│   │   │   ├── hooks/
│   │   │   │   ├── usePDFSets.ts
│   │   │   │   └── useCurrentSet.ts
│   │   │   ├── api/
│   │   │   │   └── pdfSetApi.ts
│   │   │   └── types.ts
│   │   └── pdfViewer/            # PDF表示
│   │       ├── hooks/
│   │       │   ├── usePDFDocument.ts
│   │       │   ├── useSyncScroll.ts
│   │       │   └── useZoom.ts
│   │       ├── utils/
│   │       │   └── pdfRenderer.ts
│   │       └── types.ts
│   ├── domain/                   # ドメインモデル
│   │   ├── PDFSet.ts
│   │   ├── PDFDocument.ts
│   │   └── ViewState.ts
│   ├── lib/                      # ユーティリティ
│   │   ├── fileSystem.ts
│   │   └── validation.ts
│   └── styles/
│       └── globals.css
├── src-tauri/                    # バックエンド（Rust）
│   ├── src/
│   │   ├── main.rs               # Tauriエントリーポイント
│   │   ├── commands/             # Tauriコマンド
│   │   │   ├── mod.rs
│   │   │   ├── pdf_set.rs        # PDFセット操作
│   │   │   └── file_system.rs    # ファイル操作
│   │   └── models/               # データモデル
│   │       ├── pdf_set.rs
│   │       └── config.rs
│   ├── Cargo.toml
│   └── tauri.conf.json           # Tauri設定
├── pdfs/                         # PDFファイル保存先（.gitignore）
│   ├── paper-gpt4-2024/
│   │   ├── original.pdf
│   │   └── translated.pdf
│   └── ...
├── tests/                        # テスト
│   ├── unit/
│   │   ├── domain/
│   │   └── features/
│   └── e2e/
│       ├── setManagement.spec.ts
│       └── pdfViewing.spec.ts
├── docs/
│   ├── SPEC.md
│   └── ARCHITECTURE.md           # このファイル
├── .gitignore
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## 🔑 主要コンポーネント

### 1. UI Layer

#### SetList（セット一覧画面）

**責務**:
- PDFセット一覧の表示
- 新しいセットの追加
- セットの選択と削除

**主要コンポーネント**:
```tsx
SetList.tsx          // 一覧画面のコンテナ
├── SetCard.tsx      // 各セットのカード表示
└── NewSetDialog.tsx // 新規セット追加ダイアログ
```

#### PDFViewer（PDF表示画面）

**責務**:
- 2つのPDFの同期表示
- ページナビゲーション
- 拡大/縮小制御

**主要コンポーネント**:
```tsx
PDFViewer.tsx        // ビューアのコンテナ
├── PDFPanel.tsx     // 個別PDF表示パネル（左右で2つ）
├── SyncScroller.tsx // スクロール同期制御
└── NavigationBar.tsx // ページ操作UI
```

### 2. Application Layer

#### State Management

**Context API使用**:
```tsx
// contexts/PDFSetContext.tsx
interface PDFSetContextValue {
  sets: PDFSet[]
  currentSet: PDFSet | null
  addSet: (name: string, originalPDF: File, translatedPDF: File) => Promise<void>
  openSet: (id: string) => void
  deleteSet: (id: string) => Promise<void>
}

// contexts/ViewStateContext.tsx
interface ViewStateContextValue {
  currentPage: number
  totalPages: number
  zoom: number
  syncScroll: boolean
  setPage: (page: number) => void
  setZoom: (zoom: number) => void
  toggleSyncScroll: () => void
}
```

### 3. Domain Layer

#### PDFSet（PDFセット）

```typescript
interface PDFSet {
  id: string              // UUID
  name: string            // ユーザー指定の名前
  createdAt: Date
  lastOpenedAt: Date | null
  originalPDFPath: string // pdfs/{id}/original.pdf
  translatedPDFPath: string // pdfs/{id}/translated.pdf
  bookmark: {
    page: number
    zoom: number
  } | null
}
```

#### PDFDocument（PDFドキュメント）

```typescript
interface PDFDocument {
  path: string
  totalPages: number
  isLoaded: boolean
  currentPage: number
}
```

#### ViewState（表示状態）

```typescript
interface ViewState {
  currentPage: number
  zoom: number          // 50-200%
  syncScroll: boolean
  scrollPosition: number
}
```

### 4. Infrastructure Layer

#### PDF.js Integration

```typescript
// lib/pdfRenderer.ts
export class PDFRenderer {
  private pdfDocument: PDFDocumentProxy | null = null

  async loadPDF(url: string): Promise<void> {
    this.pdfDocument = await getDocument(url).promise
  }

  async renderPage(
    pageNumber: number,
    canvas: HTMLCanvasElement,
    scale: number
  ): Promise<void> {
    const page = await this.pdfDocument!.getPage(pageNumber)
    const viewport = page.getViewport({ scale })
    const context = canvas.getContext('2d')!

    await page.render({
      canvasContext: context,
      viewport,
    }).promise
  }

  getTotalPages(): number {
    return this.pdfDocument?.numPages ?? 0
  }
}
```

#### Tauri Commands（Rust）

```rust
// src-tauri/src/commands/pdf_set.rs
#[tauri::command]
pub async fn create_pdf_set(
    name: String,
    original_path: String,
    translated_path: String,
) -> Result<PDFSet, String> {
    let id = Uuid::new_v4().to_string();
    let set_dir = format!("pdfs/{}", id);

    // ディレクトリ作成
    fs::create_dir_all(&set_dir)
        .map_err(|e| format!("Failed to create directory: {}", e))?;

    // PDFファイルをコピー
    fs::copy(original_path, format!("{}/original.pdf", set_dir))?;
    fs::copy(translated_path, format!("{}/translated.pdf", set_dir))?;

    Ok(PDFSet {
        id,
        name,
        created_at: Utc::now(),
        // ...
    })
}

#[tauri::command]
pub async fn list_pdf_sets() -> Result<Vec<PDFSet>, String> {
    // pdfs/ディレクトリをスキャンしてセット一覧を返す
}

#[tauri::command]
pub async fn delete_pdf_set(id: String) -> Result<(), String> {
    let set_dir = format!("pdfs/{}", id);
    fs::remove_dir_all(&set_dir)
        .map_err(|e| format!("Failed to delete set: {}", e))?;
    Ok(())
}
```

## 🔄 データフロー

### 新しいセットを追加する場合

```
1. User Input (SetList)
   ↓
2. NewSetDialog: セット名とPDFファイルを取得
   ↓
3. PDFSetContext.addSet()
   ↓
4. Tauri Command: create_pdf_set()
   ↓
5. Rust: pdfs/{id}/ にファイルをコピー
   ↓
6. React: セット一覧を更新
   ↓
7. UI: 新しいセットを表示
```

### PDFを表示する場合

```
1. User Click (SetCard)
   ↓
2. PDFSetContext.openSet(id)
   ↓
3. PDFViewer: PDFSetを受け取る
   ↓
4. PDFRenderer.loadPDF() × 2
   ↓
5. PDF.js: PDFを読み込み
   ↓
6. Canvas: ページをレンダリング
   ↓
7. SyncScroller: スクロールイベントを監視
```

## 🎨 設計原則

### 1. Single Responsibility Principle（単一責任の原則）

各コンポーネント/モジュールは1つの責務のみを持つ：

- `PDFPanel`: 1つのPDFを表示する
- `SyncScroller`: スクロール同期のみを担当
- `NavigationBar`: ページ操作UIのみ

### 2. Dependency Inversion（依存性逆転の原則）

UI層はドメイン層に依存するが、ドメイン層はUI層に依存しない：

```
UI Layer → Domain Layer
        ↘
          Infrastructure Layer
```

### 3. YAGNI（You Aren't Gonna Need It）

**実装しないもの**:
- ❌ 複雑な状態管理ライブラリ（Redux）→ Context APIで十分
- ❌ 独自のPDFレンダラー → PDF.jsを使用
- ❌ カスタムルーティング → シンプルな画面遷移のみ

### 4. Composition over Inheritance（継承より合成）

Reactの関数コンポーネントとフックで合成を実現：

```tsx
function PDFViewer() {
  const { currentSet } = usePDFSet()
  const { page, setPage } = useViewState()
  const { syncScroll } = useSyncScroll()

  return (
    <div>
      <PDFPanel pdf={currentSet.original} page={page} />
      <PDFPanel pdf={currentSet.translated} page={page} />
    </div>
  )
}
```

## 🔐 型安全性の保証

### TypeScript Strict Mode

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": true
  }
}
```

### 禁止事項

- ❌ `any`型の使用
- ❌ `as`キャストの濫用（最小限のみ許可）
- ❌ `// @ts-ignore`の使用

### 推奨事項

- ✅ すべての関数に戻り値の型を明示
- ✅ すべてのPropsにinterfaceを定義
- ✅ Enumまたはunion typeで状態を表現

## 🧪 テスト戦略

### 単体テスト（Vitest）

**対象**:
- ドメインロジック（PDFSet, ViewState）
- ユーティリティ関数
- カスタムフック

```typescript
// tests/unit/domain/PDFSet.test.ts
describe('PDFSet', () => {
  it('should create a new PDF set with UUID', () => {
    const set = PDFSet.create('Test Paper')
    expect(set.id).toMatch(/^[a-f0-9-]{36}$/)
    expect(set.name).toBe('Test Paper')
  })
})
```

### E2Eテスト（Playwright）

**対象**:
- セット管理フロー
- PDF表示フロー
- 同期スクロール

```typescript
// tests/e2e/setManagement.spec.ts
test('should add a new PDF set', async ({ page }) => {
  await page.goto('http://localhost:1420')
  await page.click('text=+ New Set')
  await page.fill('input[name="setName"]', 'GPT-4 Paper')
  // PDFファイルをドラッグ&ドロップ
  await page.setInputFiles('input[type="file"]', [
    'fixtures/original.pdf',
    'fixtures/translated.pdf'
  ])
  await page.click('text=Save')
  await expect(page.locator('text=GPT-4 Paper')).toBeVisible()
})
```

## 🚀 パフォーマンス最適化

### 1. PDF Lazy Loading

```typescript
// ページが表示される直前にレンダリング
function PDFPanel({ pdfPath, currentPage }: Props) {
  const [renderedPages, setRenderedPages] = useState<Set<number>>(new Set())

  useEffect(() => {
    // currentPage ± 2ページのみレンダリング
    const pagesToRender = [
      currentPage - 2,
      currentPage - 1,
      currentPage,
      currentPage + 1,
      currentPage + 2,
    ].filter(p => p > 0)

    pagesToRender.forEach(renderPage)
  }, [currentPage])
}
```

### 2. Canvas Reuse

一度レンダリングしたページのcanvasをキャッシュ：

```typescript
const pageCache = new Map<number, HTMLCanvasElement>()

function renderPage(pageNumber: number) {
  if (pageCache.has(pageNumber)) {
    return pageCache.get(pageNumber)!
  }
  // レンダリング処理
  pageCache.set(pageNumber, canvas)
}
```

### 3. Debounce Scroll Events

```typescript
const debouncedScroll = useMemo(
  () => debounce((scrollTop: number) => {
    syncOtherPanel(scrollTop)
  }, 16), // 60fps
  []
)
```

## 📊 制約と不変条件

### 1. ファイルシステム制約

```
pdfs/
└── {uuid}/
    ├── original.pdf    # 必須
    └── translated.pdf  # 必須
```

**不変条件**:
- セットディレクトリ名は常にUUID
- 各セットには必ず2つのPDFが存在
- PDFファイル名は`original.pdf`と`translated.pdf`で固定

### 2. ページ数制約

```typescript
// 原文と翻訳のページ数が異なる場合の動作
invariant(
  originalPages === translatedPages,
  '原文と翻訳のページ数は一致している必要があります'
)
```

### 3. Zoom制約

```typescript
const MIN_ZOOM = 0.5  // 50%
const MAX_ZOOM = 2.0  // 200%

function setZoom(newZoom: number) {
  const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom))
  // ...
}
```

## 🛠️ 技術選定の根拠

### Tauri vs Electron

| 項目 | Tauri | Electron |
|-----|-------|----------|
| バンドルサイズ | ~3MB | ~120MB |
| メモリ使用量 | 低（ネイティブWebView） | 高（Chromium埋め込み） |
| 起動速度 | 速い | 遅い |
| セキュリティ | Rust製、安全 | Node.js、注意が必要 |

**選定理由**: PDFビューアは軽量性が重要。100ページのPDFを2つ開くと重くなるため、フレームワーク自体は軽量なTauriを選択。

### React vs Vue vs Svelte

**React選定理由**:
- ✅ PDF.jsとの統合が豊富
- ✅ TypeScript対応が成熟
- ✅ テストツールが充実

### Context API vs Redux

**Context API選定理由**:
- ✅ シンプルな状態管理で十分
- ✅ Reduxは過剰（YAGNI）
- ✅ 学習コストが低い

### PDF.js vs react-pdf

**PDF.js（直接使用）選定理由**:
- ✅ より細かい制御が可能
- ✅ パフォーマンスチューニングが可能
- ✅ ラッパーライブラリの制約を受けない

## 🔮 将来の拡張性

### Phase 2: しおり機能

```typescript
// domain/Bookmark.ts
interface Bookmark {
  setId: string
  page: number
  zoom: number
  scrollPosition: number
  createdAt: Date
}
```

保存先: `~/.my-pdf-reader/bookmarks.json`

### Phase 3: セット同期

Google DriveやDropboxとの同期を想定：

```
~/Google Drive/my-pdf-reader/pdfs/
                              └── {uuid}/
                                  ├── original.pdf
                                  └── translated.pdf
```

アプリ側で同期ディレクトリのパスを設定可能にする。

## 📚 参考資料

### アーキテクチャパターン
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Atomic Design](https://bradfrost.com/blog/post/atomic-web-design/)

### 技術ドキュメント
- [Tauri Architecture](https://tauri.app/v1/references/architecture/)
- [PDF.js Documentation](https://mozilla.github.io/pdf.js/)
- [React Hooks Best Practices](https://react.dev/reference/react)

### 参考実装
- [esbuild ARCHITECTURE.md](https://github.com/evanw/esbuild/blob/master/docs/architecture.md)
- [Tauri Examples](https://github.com/tauri-apps/tauri/tree/dev/examples)

## 🔄 更新履歴

| バージョン | 日付 | 変更内容 |
|----------|------|---------|
| 1.0.0    | 2026-01-04 | 初版作成 |
