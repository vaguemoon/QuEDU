# admin/ 說明手冊

教師後台（上學趣｜教師管理後台）的所有檔案說明。

---

## 進入點

| 檔案 | 作用 |
|------|------|
| `index.html` | 後台主頁面。包含側邊欄導覽（班級管理／資料庫／測驗區／教學工具）與所有面板的 HTML 結構，並依序載入下方所有 JS 模組。 |
| `admin.css` | 後台全域樣式。定義 CSS 變數、側邊欄、卡片、表格、暗色模式等通用元件。 |

---

## 核心模組

| 檔案 | 作用 |
|------|------|
| `init.js` | 初始化與全域控制。處理 Firebase Auth 登入驗證、分頁切換（`switchTab`）、暗色模式開關，以及子 APP 登錄表（`APP_REGISTRY`）。 |
| `classes.js` | 班級管理。建立班級、產生 6 碼邀請碼、啟用／停用班級。 |
| `overview.js` | 班級學生名單。顯示選定班級的學生列表，並呈現各 APP（識字趣／乘法趣）的學習進度。 |
| `students.js` | 學生詳細頁。點入個別學生後，顯示其課程完成狀況與最近測驗紀錄。 |

---

## 資料庫模組（📁 資料庫分頁）

| 檔案 | 作用 |
|------|------|
| `curriculum-ui.js` | 課程版本 UI 渲染。手風琴列表、課次摺疊面板、課次內容展示。 |
| `curriculum-data.js` | 課程版本 Firebase CRUD。新增／刪除版本、課次，以及 CSV 批次匯入。 |
| `curriculum.js` | **空檔，保留相容性。** 原始課程模組已拆分為上述兩個檔案，此檔不含任何邏輯。 |
| `quiz-bank.js` | 語文題庫管理。上傳 `.xlsx` 題庫、顯示各課次題數統計、刪除課次題目。依賴 SheetJS（XLSX）。 |
| `math-bank.js` | 數學題組管理。上傳 `.xlsx`（欄位：年級、類別、題幹、答案），寫入 Firestore `mathQuestions`。 |
| `word-image.js` | 詞語圖庫。為「詞語解釋」題型上傳對應圖片；圖片壓縮為 base64 直接存入 Firestore，不使用 Firebase Storage。 |
| `audio-clips.js` | 音檔管理。支援麥克風錄音（最長 60 秒）或上傳音檔（最大 500 KB），以 WebM/Opus base64 格式存入 Firestore `audioClips`。 |

---

## 測驗區模組（📋 測驗區分頁）

| 檔案 | 作用 |
|------|------|
| `quiz-sessions.js` | 語文測驗代碼管理。建立測驗場次（產生 6 碼代碼）、顯示列表與學生作答統計、關閉測驗。 |
| `math-quiz.js` | 四則運算測驗管理。建立／關閉四則運算測驗場次，功能結構與 `quiz-sessions.js` 相同。 |
| `exam-compose.js` | 試卷編製精靈。分步驟流程：填基本資料 → 選題 → 大題分組排版 → 輸出試卷。 |

---

## 依賴關係

```
Firebase SDK (CDN)
    └── shared.js        ← db、auth、showToast（位於 /shared/）
         └── init.js     ← currentTeacher、switchTab
              ├── classes.js
              ├── overview.js
              ├── students.js
              ├── curriculum-ui.js ← curriculum-data.js
              ├── quiz-bank.js
              ├── math-bank.js
              ├── word-image.js
              ├── audio-clips.js
              ├── quiz-sessions.js
              ├── math-quiz.js
              └── exam-compose.js
```
