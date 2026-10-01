/**
 * admin/lesson-fulltext.js — 課文全文轉檔（docx/txt/odt/pdf → 純文字）
 * 供 admin/quiz-bank.js 的「課文全文」欄位使用（課文趣 App 用），
 * 轉檔邏輯搬自 apps/quiz/word-to-reader/reader.js（同一套 mammoth/JSZip/pdf.js 組合）。
 */
'use strict';

if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

var LFT_SUPPORTED_EXTS = ['docx', 'txt', 'odt', 'pdf'];

function _lftExt(name) {
  var m = /\.([a-z0-9]+)$/i.exec(name || '');
  return m ? m[1].toLowerCase() : '';
}

function _lftExtractText(ext, data) {
  if (ext === 'docx') {
    return mammoth.extractRawText({ arrayBuffer: data }).then(function (r) { return r.value; });
  }
  if (ext === 'txt') return Promise.resolve(data);
  if (ext === 'odt') return _lftExtractOdtText(data);
  if (ext === 'pdf') return _lftExtractPdfText(data);
  return Promise.reject(new Error('不支援的檔案格式'));
}

/* ODT 本質是 zip + XML，用 JSZip 讀出 content.xml，取出段落與標題依序合併成純文字 */
function _lftExtractOdtText(arrayBuffer) {
  var TEXT_NS = 'urn:oasis:names:tc:opendocument:xmlns:text:1.0';
  return JSZip.loadAsync(arrayBuffer)
    .then(function (zip) {
      var entry = zip.file('content.xml');
      if (!entry) throw new Error('找不到 content.xml，不是有效的 ODT 檔案');
      return entry.async('string');
    })
    .then(function (xmlStr) {
      var xml   = new DOMParser().parseFromString(xmlStr, 'application/xml');
      var nodes = xml.getElementsByTagNameNS(TEXT_NS, '*');
      var lines = [];
      for (var i = 0; i < nodes.length; i++) {
        var ln = nodes[i].localName;
        if (ln === 'p' || ln === 'h') lines.push(nodes[i].textContent || '');
      }
      return lines.join('\n');
    });
}

/* PDF 用 pdf.js 逐頁擷取純文字，掃描檔（純圖片）擷取不到文字 */
function _lftExtractPdfText(arrayBuffer) {
  return pdfjsLib.getDocument({ data: arrayBuffer }).promise.then(function (pdf) {
    var pageTexts = [];
    var chain = Promise.resolve();
    for (var i = 1; i <= pdf.numPages; i++) {
      (function (pageNum) {
        chain = chain.then(function () {
          return pdf.getPage(pageNum)
            .then(function (page) { return page.getTextContent(); })
            .then(function (content) {
              pageTexts.push(content.items.map(function (it) { return it.str; }).join(' '));
            });
        });
      })(i);
    }
    return chain.then(function () { return pageTexts.join('\n\n'); });
  });
}
