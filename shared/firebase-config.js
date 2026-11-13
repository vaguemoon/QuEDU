/**
 * shared/firebase-config.js — Firebase 專案設定（全站唯一一份）
 *
 * 每個會用到 Firebase 的頁面，都在 Firebase SDK 的 <script> 後面載入這個檔案，
 * 其餘程式（shared.js、report.js、各測驗頁）一律讀 QU_FIREBASE_CONFIG，不要再各自抄一份。
 */
var QU_FIREBASE_CONFIG = {
  apiKey:            "AIzaSyBLhonzZkR1ORDPKgxmaVLFUwvPiEMpdj0",
  authDomain:        "tainping-hanzi-app.firebaseapp.com",
  projectId:         "tainping-hanzi-app",
  storageBucket:     "tainping-hanzi-app.firebasestorage.app",
  messagingSenderId: "158917910126",
  appId:             "1:158917910126:web:e52a1d0456d1fd4fe6907f"
};
