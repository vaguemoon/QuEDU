# 上學趣 — 子 App 設計準則

> 適用對象：負責開發新子 App（如「乘法趣」「單字趣」）的 AI 或開發者  
> 基準版本：以「練字趣」（chinese/）為參考實作  
> 最後更新：2026-04

---

## 一、整體定位

主系統「上學趣」(`index.html`) 是一個**學生 Hub**，每個子 App 以 `<iframe>` 嵌入其中執行。子 App 是**獨立的 SPA**，擁有自己的 HTML / CSS / JS，但共用 Firebase、主題系統與使用者身份。

```
index.html（Hub）
  └── <iframe src="{appFolder}/index.html">
        └── 子 App（獨立 SPA）
```

Hub 傳入登入資訊 → 子 App 透過 `sessionStorage` 取得 → 子 App 用 `postMessage` 回報登出 / 返回 Hub。

---

## 二、目錄結構規範

每個子 App 放在根目錄下一個**以功能命名的資料夾**：

```
{appName}/
├── index.html          ← App 入口（必要）
├── {appName}.css       ← App 專屬樣式（必要）
├── 檔案功能說明.md      ← 每個 JS 的職責說明（必要，給未來 AI 讀）
└── js/
    ├── init.js         ← 啟動、自動登入（必要）
    ├── nav.js          ← 頁面切換、PAGE_STACK（必要）
    ├── state.js        ← 全域狀態、Firestore 讀寫（必要）
    ├── voice.js        ← 語音朗讀（若有語音需求）
    ├── curriculum.js   ← 課程選擇（若依賴課程資料）
    └── *.js            ← 各功能模組（按職責拆分）
```

**命名原則：** 一個 JS 檔只做一件事，檔名即職責（`exam.js` 管考試、`menu.js` 管選單）。

---

## 三、嵌入與通訊規範

### 3-1 Hub 端（index.html）

Hub 在學生登入後，將身份寫入 `sessionStorage`，再顯示對應的 `<iframe>`：

```js
sessionStorage.setItem('hub_student', JSON.stringify({
  name: student.name,
  pin:  student.pin
}));
// 然後顯示 iframe（src 已設定好，不動態注入）
```

### 3-2 子 App 取得登入資訊（init.js 固定寫法）

```js
var saved = sessionStorage.getItem('hub_student');
if (saved) {
  var hubStudent = JSON.parse(saved);
  // 用 hubStudent.name + '_' + hubStudent.pin 查 Firestore
}
```

### 3-3 子 App 發訊給 Hub（postMessage）

| 情境 | 訊息格式 |
|------|---------|
| 返回 Hub 主頁 | `{ type: '{appId}-back-to-hub' }` |
| 登出 | `{ type: '{appId}-logout' }` |

`appId` 為子 App 的唯一識別字，例如 `hanzi`（練字趣）、`math`（乘法趣）。  
Hub 端監聽 `window.message` 並依 `type` 做對應處理。

---

## 四、頁面系統（SPA 切換）

所有畫面是 `<div id="page-{name}" class="page">` 的 DOM 節點，預設隱藏，active 者顯示。

### 4-1 必要的 CSS class

```css
.page       { display: none; }   /* 或用 hidden class，統一即可 */
.page.active { display: block; } /* 或 flex，依版面需求 */
```

### 4-2 nav.js 核心模式（不得自行發明）

```js
var PAGE_STACK  = [];
var PAGE_CONFIG = {
  'home': { title: '首頁', back: false },
  'game': { title: '遊戲', back: true  },
  // ...
};
var currentPage = 'home';

function showPage(name, pushHistory) {
  if (pushHistory === undefined) pushHistory = true;
  document.querySelectorAll('.page').forEach(function(el){ el.classList.remove('active'); });
  document.getElementById('page-' + name).classList.add('active');
  if (pushHistory) PAGE_STACK.push(name);
  currentPage = name;
  // 更新 Topbar（標題、返回鍵）
}

function goBack() {
  if (PAGE_STACK.length > 1) {
    PAGE_STACK.pop();
    showPage(PAGE_STACK[PAGE_STACK.length - 1], false);
  }
}

function backToHub() {
  window.parent.postMessage({ type: '{appId}-back-to-hub' }, '*');
}
```

**規則：**
- 所有頁面切換都透過 `showPage()`，禁止直接操作 `display`
- `pushHistory: false` 用於「返回」動作，避免堆疊重複

---

## 五、Topbar 規範

每個子 App 都必須有一個**固定頂端列**，結構如下：

```html
<div id="page-topbar">
  <button class="btn-back-hub" onclick="backToHub()">← 主頁</button>
  <button class="btn-back hidden" id="topbar-back" onclick="goBack()">← 返回</button>
  <div id="topbar-title">🎯 <span>{App名稱}</span></div>
  <!-- 可選：mode-info、breadcrumb（視 App 複雜度決定） -->
  <div id="topbar-student" onclick="toggleLogoutMenu()">
    <span id="topbar-avatar">🐣</span>
    <span id="topbar-name">—</span>
    <div id="topbar-logout-menu" class="logout-menu hidden">
      <button onclick="goToSettings(event)">⚙️ 設定</button>
      <button onclick="goToAchievement(event)">🏆 成就</button>
      <button onclick="sendLogout(event)">🚪 登出</button>
    </div>
  </div>
</div>
```

**行為規則：**
- `← 主頁` 永遠顯示，呼叫 `backToHub()`
- `← 返回` 依 `PAGE_CONFIG[name].back` 決定顯示 / 隱藏
- 學生頭像 / 名稱由 `init.js` 在自動登入後填入

---

## 六、CSS 規範

### 6-1 引用順序（固定）

```html
<link rel="stylesheet" href="../shared.css">   <!-- 先載入共用樣式 -->
<link rel="stylesheet" href="{appName}.css">   <!-- 再載入 App 專屬樣式 -->
```

### 6-2 主題 CSS 變數（只用，不定義）

`shared.css` 已定義全部主題變數，子 App 直接使用：

| 變數 | 用途 |
|------|------|
| `--blue` | 主色（按鈕、強調色）|
| `--blue-dk` | 深色版（文字、邊框）|
| `--blue-lt` | 淡色版（背景、hover）|
| `--bg` | 頁面背景色 |
| `--text` | 主要文字色 |
| `--muted` | 次要文字色 |
| `--border` | 邊框色 |
| `--red` | 警告 / 刪除 |
| `--green` | 成功 / 通過 |
| `--shadow` | 標準陰影 |
| `--radius` | 標準圓角（22px）|

**禁止在子 App CSS 中寫死顏色值**（例如 `#4a90d9`），一律用 CSS 變數。

### 6-3 防主題閃爍（必要）

在 `<head>` 最早執行以下 inline script，同步套用主題：

```html
<script>
(function(){var M={blue:'#eef5fc,#4a90d9,#2d6fa8,#e8f4fd',green:'#edfbf4,#27ae60,#1e8449,#d5f5e3',
  purple:'#f3f0fc,#8e44ad,#6c3483,#e8daef',orange:'#fff8f0,#e67e22,#ca6f1e,#fdebd0',
  teal:'#f0fafa,#16a085,#0e6655,#d1f2eb',pink:'#fff0f8,#d63384,#a0255e,#fce4ec'};
  try{var v=(M[localStorage.getItem('theme')]||M.blue).split(','),r=document.documentElement.style;
  ['--bg','--blue','--blue-dk','--blue-lt'].forEach(function(k,i){r.setProperty(k,v[i]);});}catch(e){}})();
</script>
```

這段固定複製，不做修改。

---

## 七、JavaScript 規範

### 7-1 全域原則

- 所有 JS 檔案最頂端加 `'use strict';`
- 不使用任何 JS 框架（React / Vue 等），純原生 JS
- 變數用 `var`（全域共享），函式用具名 `function`
- 模組間溝通透過全域變數（`chars`、`currentStudent` 等），不傳參數

### 7-2 state.js 必要內容

```js
'use strict';

// 學生資訊
var currentStudent = null;

// App 核心狀態（依 App 定義）
var currentMode = 'home';

// Firebase 存取
function saveProgress() {
  if (!db || !currentStudent) return;
  db.collection('students').doc(currentStudent.id)
    .collection('progress').doc('{appId}')   // ← appId 固定，不同 App 用不同 doc
    .set({ /* 進度資料 */, lastStudied: new Date().toISOString() }, { merge: true })
    .catch(function(e){ console.warn('saveProgress error:', e); });
}
```

**Firestore 路徑規範：**

| 資料 | 路徑 |
|------|------|
| 學生主資料 | `students/{id}` |
| App 進度 | `students/{id}/progress/{appId}` |
| 班級課程指派 | `classes/{classId}.assignedChars` （現有欄位，練字趣使用）|
| 課程資料 | `curriculum/{versionId}/books/{bookId}/lessons/{lessonId}` |

新 App 不得使用其他 App 的 `progress` 文件（各自獨立）。

### 7-3 init.js 啟動流程（固定順序）

```js
window.addEventListener('load', function() {
  // 1. 初始化共用系統
  initFirebase();
  applyTheme(currentTheme);
  applySound();
  initSoundWrapper();

  // 2. 顯示起始頁
  showPage('home', false);
  PAGE_STACK = ['home'];

  // 3. 自動登入
  var saved = sessionStorage.getItem('hub_student');
  if (saved) {
    // ... 查 Firestore、設定 currentStudent、載入進度
    // 4. 載入成就統計
    loadAchStats(function() { handleDailyLogin(); });
  }
});
```

### 7-4 script 引用順序（固定）

```html
<script src="../shared.js"></script>
<script src="js/nav.js"></script>
<script src="js/state.js"></script>
<script src="js/voice.js"></script>    <!-- 若有語音 -->
<script src="js/curriculum.js"></script> <!-- 若有課程 -->
<!-- 各功能模組 -->
<script src="js/achievement.js"></script>
<script src="js/init.js"></script>     <!-- init.js 必須最後 -->
```

---

## 八、共用功能（直接呼叫 shared.js 提供的函式）

| 函式 | 功能 |
|------|------|
| `initFirebase()` | 初始化 Firebase，設定全域 `db` |
| `applyTheme(id)` | 套用主題色系 |
| `applySound()` | 套用音效開關狀態 |
| `initSoundWrapper()` | 初始化音效播放器 |
| `showToast(msg)` | 顯示底部提示訊息 |
| `playSound(type)` | 播放音效（`'correct'`、`'wrong'`、`'complete'` 等）|
| `renderThemeGrid()` | 渲染設定頁的主題選色格 |

這些函式在 `shared.js` 定義，子 App 直接呼叫，不需引數（除了標示者）。  
子 App 的 HTML 必須包含 `<div id="toast"></div>` 供 `showToast` 使用。

---

## 九、成就系統規範

每個子 App 應實作**獨立的成就定義**（`achievement.js`），但共用 Firestore 路徑：

```
students/{id}/progress/achievements
```

欄位結構參考練字趣的 `achStats`：

```js
{
  stars:                0,
  title:                '{App}LV1',
  totalLoginDays:       0,
  lastLoginDate:        '',
  unlockedAchievements: {},
  // App 特有的統計欄位...
}
```

成就解鎖時呼叫 `showToast()` 通知學生。  
每日首次登入呼叫 `handleDailyLogin()` 更新連續登入記錄。

---

## 十、設定頁規範

設定頁必須提供以下三個區塊（參考 `page-settings`）：

1. **頭像選擇** — 從 `AVATARS` 陣列渲染，選取後寫回 Firestore
2. **主題色系** — 呼叫 `renderThemeGrid()`，共用選色格
3. **音效開關** — 呼叫 `toggleSound()` + `applySound()`

三個區塊的資料均儲存在 `localStorage`（主題、音效）或 Firestore（頭像），不屬於任何特定 App，所有子 App 共享同一份設定。

---

## 十一、行動裝置相容規範

- `<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">`
- 所有互動元素最小點擊區域 44×44px
- 避免 `hover` 效果作為唯一狀態提示，改用 `:active`
- canvas 類互動（手寫、繪圖）需監聽 `resize` 事件重建
- 響應式尺寸以 CSS 變數管理（參考 `--grid` 的三段 media query 寫法）

---

## 十二、新 App 開發 Checklist

開始開發前確認：

- [ ] 資料夾命名（全小寫英文，例如 `math/`、`english/`）
- [ ] 確定 `appId`（用於 postMessage type、Firestore progress doc 名稱）

開發完成前確認：

- [ ] `index.html` 有防主題閃爍 inline script
- [ ] `<link rel="stylesheet">` 順序正確（shared.css → appName.css）
- [ ] `<div id="toast"></div>` 存在
- [ ] Topbar 包含「← 主頁」按鈕，呼叫 `backToHub()`
- [ ] `nav.js` 使用 `PAGE_STACK` + `showPage()` 管理頁面
- [ ] `state.js` 的 `saveProgress()` 使用正確的 Firestore 路徑
- [ ] `init.js` 是最後載入的 JS
- [ ] 登入資訊從 `sessionStorage('hub_student')` 取得，不自行實作登入
- [ ] 登出 / 返回用 `postMessage` 通知 Hub
- [ ] 所有顏色使用 CSS 變數，無寫死色碼
- [ ] 新增 `檔案功能說明.md` 說明每個 JS 的職責

---

## 附錄甲：App 分類設計準則

子 App 依學習形式分為兩類，各有不同的設計重點：

### 遊戲類（練字趣、乘法趣）

- **成就系統**：實作星星、稱號、成就解鎖機制，激勵長期練習
- **視覺風格**：使用 CSS 主題變數系統，支援六色主題切換（blue / green / purple / orange / teal / pink）
- **進度追蹤**：儲存學習進度至 `students/{id}/progress/{appId}`，支援每日登入獎勵 (`handleDailyLogin()`)
- **成就路徑**：`students/{id}/progress/achievements`（與 App 進度文件分開）

### 測驗類（測驗趣）

- **不提供成就系統**：聚焦當次練習的即時批改與分數回饋，不設勳章或累積機制
- **視覺風格**：以「紙本練習卷數位化」為概念，米白底色（`#faf8f3`）搭配深墨色（`#1a1a2e`），模擬印刷質感，輔以細邊框與柔和陰影
- **字型**：標題與題號使用 **Noto Serif TC**，內文與介面使用 **Noto Sans TC**
- **成績寫入**：批改後寫入 `students/{sid}/activities`，格式：`{ app, score, correct, total, grade, lesson, timestamp }`

### 工具類（有聲教材）

- **無帳號依賴**：工具類 App 可在不登入的情況下使用核心功能
- **成就系統**：依 App 性質決定是否實作，通常不設

---

## 附錄乙：常見錯誤

| 錯誤 | 正確做法 |
|------|---------|
| 在子 App 自己初始化 Firebase（重複 initializeApp）| 呼叫 `initFirebase()`，它已有保護邏輯 |
| 直接操作 `element.style.display` 切換頁面 | 一律用 `showPage()` |
| 在 CSS 寫死 `#4a90d9` | 改用 `var(--blue)` |
| init.js 排在其他模組之前 | init.js 必須最後載入 |
| 各 App 進度存在同一個 Firestore doc | 每個 App 用自己的 `progress/{appId}` |
| postMessage type 未加 appId 前綴 | 避免不同 App 訊息衝突 |
