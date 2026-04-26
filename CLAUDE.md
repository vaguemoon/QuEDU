# QuEDU — 專案設定

## 目標設備

**主要設備：電腦（1024px+）與平板（768px+）**

- CSS 版面以 768px 以上為設計基準
- 禁止使用 `max-width: 480px` 或其他針對手機的窄欄限制
- 版面應善用寬螢幕的橫向空間，避免將所有內容擠在畫面正中央的單欄窄版
- 需要置中時，使用 `max-width: 900px`（一般內容）或 `max-width: 1200px`（管理介面）為上限，並保持 `margin: 0 auto`
- 響應式斷點順序：設計先從寬螢幕出發，再用 `@media (max-width: ...)` 處理例外

## 技術架構

- Firebase Firestore 作為唯一資料庫，無後端伺服器
- 純 HTML / CSS / JavaScript，不使用任何前端框架
- 子應用程式放置於 `/apps/` 目錄，管理介面在 `/admin/`
- Firebase compat SDK（`firebase-app-compat.js`、`firebase-firestore-compat.js`）

## 字體與視覺風格

- 中文字體：Noto Sans TC
- 等寬數字：Courier New（數學算式、數字輸入格）
- 色彩變數定義於各頁 CSS `:root`，統一使用 CSS 變數，不 hardcode 顏色值
