'use strict';

var currentStudent = null;
var currentCategory = '';  // 'angle' | 'measure'
var currentModule  = '';   // 'area' | 'volume' | 'surface' | 'angle' | 'triangle' | 'side'
var currentShape   = '';   // e.g. 'rectangle', 'triangle', 'cube', ...；side 用 'iso' | 'equi' | 'isoright'

/* 一輪題數：選擇頁選 5／10／15／20，存在 localStorage geometry-cfg */
var ROUND_COUNTS = [5, 10, 15, 20];
var ROUND_SIZE = 10;
try {
  var _geoCfg = JSON.parse(localStorage.getItem('geometry-cfg') || 'null');
  if (_geoCfg && ROUND_COUNTS.indexOf(_geoCfg.count) >= 0) ROUND_SIZE = _geoCfg.count;
} catch (e) {}

var gamePool    = [];
var gamePoolIdx = 0;
var gameQ       = null;
var gameCorrect = 0;
var gameTotal   = 0;

var fillInputStr = '';

function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function _ri(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function _riEven(min, max) {
  return _ri(Math.ceil(min / 2), Math.floor(max / 2)) * 2;
}
