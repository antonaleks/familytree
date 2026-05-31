// buildLayout теперь чистый (Sugiyama-lite, без relatives-tree) и живёт в
// layout-core.js — тестируется прямо в node. Этот модуль остаётся точкой
// импорта для браузерной части (App.jsx).
export * from './layout-core.js';
