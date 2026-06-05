'use strict';

var currentStudent = null;
var currentModule  = '';   // 'area' | 'volume' | 'surface'
var currentShape   = '';   // e.g. 'rectangle', 'triangle', 'cube', ...
var ROUND_SIZE = 10;

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
