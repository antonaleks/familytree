# Семейное древо — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Статический сайт-генеалогическое древо на GitHub Pages: просмотр по умолчанию, редактирование по паролю, сохранение в `data.json` через GitHub-токен.

**Architecture:** Чистый HTML/CSS/JS (ES modules), без сборщика. Дерево рисует family-chart (D3, вендорится в `/vendor`). Логика (декод данных, родство, авторизация) — чистые модули, тестируются через встроенный `node --test` без зависимостей. DOM/сеть/canvas — тонкие обёртки, проверяются в браузере вручную.

**Tech Stack:** HTML5, CSS3, vanilla JS (ESM), family-chart (MIT), GitHub REST API, Node 20 `node:test` для юнит-тестов логики.

---

## File Structure

```
index.html              — единственная страница, точка входа
css/styles.css          — стиль Imperial Burgundy, дерево, модалки
vendor/family-chart.js  — вендоренная либа (+ family-chart.css)
src/
  data.js       — base64 (UTF-8 safe) decode/encode, buildGraph
  terms.js      — таблица терминов родства + определения + ссылки
  kinship.js    — findRelation: LCA, дистанции, термин
  auth.js       — checkPassword (base64)
  card.js       — renderCardHTML (чистая строка), силуэты
  tree.js       — toFamilyChartData (чистая) + initTree (DOM)
  photo.js      — resizeImage (canvas, браузер)
  save.js       — buildCommitFiles (чистая) + commitToGitHub (fetch)
  app.js        — оркестратор: режимы, модалки, события
data.json       — данные (base64-строка)
photos/         — файлы фото
test/
  data.test.js
  kinship.test.js
  auth.test.js
  card.test.js
  tree.test.js
  save.test.js
package.json    — { "type": "module", scripts.test }
config.js       — { repo, branch, passwordB64 } публичный конфиг
```

Принцип: чистая логика отделена от DOM, чтобы тестировать через `node --test` без браузера/jsdom. `renderCardHTML`, `toFamilyChartData`, `buildCommitFiles` возвращают строки/объекты — тестируемы. `initTree`, `resizeImage`, `commitToGitHub` — тонкие обёртки, проверяются вручную в браузере.

---

## Task 1: Scaffold проекта и тест-раннер

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `css/styles.css`
- Create: `config.js`
- Test: `test/smoke.test.js`

- [ ] **Step 1: Write the failing test**

`test/smoke.test.js`:
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('node test runner works', () => {
  assert.equal(1 + 1, 2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/`
Expected: FAIL — нет `package.json` с `"type": "module"`, либо тест не находится. (Если случайно проходит — ок, переходи дальше; цель шага — убедиться, что раннер запускается.)

- [ ] **Step 3: Создать каркасные файлы**

`package.json`:
```json
{
  "name": "familytree",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "test": "node --test test/"
  }
}
```

`config.js`:
```javascript
// Публичный конфиг. ВНИМАНИЕ: репа публичная — пароль здесь слабая защита.
export const CONFIG = {
  repo: 'USER/REPO',          // заполнить при деплое: owner/repo
  branch: 'main',
  dataPath: 'data.json',
  photosDir: 'photos',
  // base64 от пароля (UTF-8). Сгенерировать: btoa(unescape(encodeURIComponent('пароль')))
  passwordB64: 'cGFzc3dvcmQ='  // 'password' — заменить
};
```

`index.html`:
```html
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Семейное древо</title>
  <link rel="stylesheet" href="css/styles.css">
  <link rel="stylesheet" href="vendor/family-chart.css">
</head>
<body>
  <header id="topbar">
    <h1>Семейное древо</h1>
    <div class="actions">
      <button id="kinshipBtn">Кто кому кем</button>
      <button id="adminBtn">Редактировать</button>
      <button id="saveBtn" hidden>Сохранить</button>
    </div>
  </header>
  <main id="tree"></main>
  <div id="modal-root"></div>
  <script type="module" src="src/app.js"></script>
</body>
</html>
```

`css/styles.css` — каркас + переменные палитры Burgundy:
```css
:root{
  --burg-1:#5c2025; --burg-2:#380f12; --gold:#d4af6a; --gold-2:#f0dca8;
  --name:#f5e8d8; --meta:#c8a98e; --photobg:#3a1518;
  --bg:#241016;
}
*{box-sizing:border-box}
body{margin:0;font-family:Georgia,serif;background:var(--bg);color:var(--name)}
#topbar{display:flex;justify-content:space-between;align-items:center;
  padding:10px 18px;background:linear-gradient(#2a1014,#1c0a0d);
  border-bottom:1px solid var(--gold)}
#topbar h1{font-size:18px;letter-spacing:2px;color:var(--gold);margin:0}
.actions button{background:transparent;border:1px solid var(--gold);color:var(--gold);
  padding:6px 12px;border-radius:4px;cursor:pointer;font-family:inherit;margin-left:8px}
.actions button:hover{background:var(--gold);color:var(--burg-2)}
#tree{width:100%;height:calc(100vh - 56px);overflow:hidden}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — `tests 1`, `pass 1`.

- [ ] **Step 5: Commit**

```bash
git add package.json index.html css/styles.css config.js test/smoke.test.js
git commit -m "feat: scaffold static site + node test runner"
```

---

## Task 2: data.js — UTF-8-safe base64 + декод/энкод

**Files:**
- Create: `src/data.js`
- Test: `test/data.test.js`

Контекст: ФИО на кириллице, поэтому голый `btoa`/`atob` ломается. Кодируем через `TextEncoder`/`TextDecoder`.

- [ ] **Step 1: Write the failing test**

`test/data.test.js`:
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeData, decodeData } from '../src/data.js';

test('encode/decode round-trip с кириллицей', () => {
  const obj = { persons: [{ id: '1', fio: 'Анна Захаровна' }] };
  const b64 = encodeData(obj);
  assert.equal(typeof b64, 'string');
  assert.notMatch(b64, /Анна/); // действительно закодировано
  const back = decodeData(b64);
  assert.deepEqual(back, obj);
});

test('decode пустого/битого даёт пустой набор', () => {
  assert.deepEqual(decodeData(''), { persons: [] });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/data.test.js`
Expected: FAIL — `Cannot find module '../src/data.js'`.

- [ ] **Step 3: Write minimal implementation**

`src/data.js`:
```javascript
function bytesToB64(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function encodeData(obj) {
  const json = JSON.stringify(obj);
  return bytesToB64(new TextEncoder().encode(json));
}

export function decodeData(b64) {
  if (!b64) return { persons: [] };
  try {
    const json = new TextDecoder().decode(b64ToBytes(b64));
    const obj = JSON.parse(json);
    if (!obj || !Array.isArray(obj.persons)) return { persons: [] };
    return obj;
  } catch {
    return { persons: [] };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/data.test.js`
Expected: PASS — оба теста.

- [ ] **Step 5: Commit**

```bash
git add src/data.js test/data.test.js
git commit -m "feat: UTF-8-safe base64 encode/decode for data"
```

---

## Task 3: data.js — buildGraph (нормализация связей)

**Files:**
- Modify: `src/data.js`
- Test: `test/data.test.js`

Связи в JSON могут быть заданы частично (только `children` у родителя, без `parents` у ребёнка). `buildGraph` достраивает двусторонние ссылки и возвращает `Map<id, person>`.

- [ ] **Step 1: Write the failing test**

Добавить в `test/data.test.js`:
```javascript
import { buildGraph } from '../src/data.js';

test('buildGraph достраивает обратные связи', () => {
  const data = { persons: [
    { id: 'p', fio: 'Отец', children: ['c'] },
    { id: 'c', fio: 'Сын' }
  ]};
  const g = buildGraph(data);
  assert.deepEqual(g.get('c').parents, ['p']);
  assert.deepEqual(g.get('p').children, ['c']);
});

test('buildGraph делает супругов взаимными', () => {
  const data = { persons: [
    { id: 'a', fio: 'Муж', spouses: ['b'] },
    { id: 'b', fio: 'Жена' }
  ]};
  const g = buildGraph(data);
  assert.deepEqual(g.get('b').spouses, ['a']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/data.test.js`
Expected: FAIL — `buildGraph is not a function`.

- [ ] **Step 3: Write minimal implementation**

Добавить в `src/data.js`:
```javascript
export function buildGraph(data) {
  const g = new Map();
  for (const raw of data.persons) {
    g.set(raw.id, {
      ...raw,
      parents: [...(raw.parents || [])],
      spouses: [...(raw.spouses || [])],
      children: [...(raw.children || [])]
    });
  }
  const link = (arr, id) => { if (id && !arr.includes(id)) arr.push(id); };
  for (const p of g.values()) {
    for (const cid of p.children) { const c = g.get(cid); if (c) link(c.parents, p.id); }
    for (const pid of p.parents) { const par = g.get(pid); if (par) link(par.children, p.id); }
    for (const sid of p.spouses) { const s = g.get(sid); if (s) link(s.spouses, p.id); }
  }
  return g;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/data.test.js`
Expected: PASS — все 4 теста.

- [ ] **Step 5: Commit**

```bash
git add src/data.js test/data.test.js
git commit -m "feat: buildGraph normalizes bidirectional relations"
```

---

## Task 4: terms.js — таблица терминов родства

**Files:**
- Create: `src/terms.js`
- Test: используется в Task 5 (отдельный тест не нужен — таблица данных)

Источники определений: gramota.ru «Термины родства и свойства», Wikipedia «Свойство (родство)».

- [ ] **Step 1: Создать таблицу**

`src/terms.js`:
```javascript
// Определения и ссылки для пояснений в UI.
export const SOURCE = {
  gramota: 'https://gramota.ru/journal/stati/zhizn-yazyka/terminy-rodstva-i-svoystva-v-russkom-yazyke',
  wiki: 'https://ru.wikipedia.org/wiki/Свойство_(родство)'
};

// term: { def: пояснение, src: ссылка }
export const TERMS = {
  'отец':        { def: 'Родитель мужского пола.', src: SOURCE.gramota },
  'мать':        { def: 'Родитель женского пола.', src: SOURCE.gramota },
  'сын':         { def: 'Ребёнок мужского пола.', src: SOURCE.gramota },
  'дочь':        { def: 'Ребёнок женского пола.', src: SOURCE.gramota },
  'брат':        { def: 'Сын тех же родителей.', src: SOURCE.gramota },
  'сестра':      { def: 'Дочь тех же родителей.', src: SOURCE.gramota },
  'дед':         { def: 'Отец родителя.', src: SOURCE.gramota },
  'бабушка':     { def: 'Мать родителя.', src: SOURCE.gramota },
  'внук':        { def: 'Сын ребёнка.', src: SOURCE.gramota },
  'внучка':      { def: 'Дочь ребёнка.', src: SOURCE.gramota },
  'дядя':        { def: 'Брат родителя.', src: SOURCE.gramota },
  'тётя':        { def: 'Сестра родителя.', src: SOURCE.gramota },
  'племянник':   { def: 'Сын брата или сестры.', src: SOURCE.gramota },
  'племянница':  { def: 'Дочь брата или сестры.', src: SOURCE.gramota },
  'двоюродный брат':   { def: 'Сын дяди или тёти.', src: SOURCE.gramota },
  'двоюродная сестра': { def: 'Дочь дяди или тёти.', src: SOURCE.gramota },
  'муж':   { def: 'Супруг.', src: SOURCE.gramota },
  'жена':  { def: 'Супруга.', src: SOURCE.gramota },
  // свойство (по браку):
  'тесть':       { def: 'Отец жены.', src: SOURCE.wiki },
  'тёща':        { def: 'Мать жены.', src: SOURCE.wiki },
  'свёкор':      { def: 'Отец мужа.', src: SOURCE.wiki },
  'свекровь':    { def: 'Мать мужа.', src: SOURCE.wiki },
  'зять':        { def: 'Муж дочери (или сестры).', src: SOURCE.wiki },
  'невестка':    { def: 'Жена сына (или жена брата).', src: SOURCE.wiki },
  'сноха':       { def: 'Жена сына по отношению к его отцу.', src: SOURCE.wiki },
  'шурин':       { def: 'Брат жены.', src: SOURCE.wiki },
  'свояченица':  { def: 'Сестра жены.', src: SOURCE.wiki },
  'свояк':       { def: 'Муж свояченицы (муж сестры жены).', src: SOURCE.wiki },
  'деверь':      { def: 'Брат мужа.', src: SOURCE.wiki },
  'золовка':     { def: 'Сестра мужа.', src: SOURCE.wiki },
  'сват':        { def: 'Отец зятя или невестки.', src: SOURCE.wiki },
  'сватья':      { def: 'Мать зятя или невестки.', src: SOURCE.wiki }
};

// Список терминов, считающихся "сложными" — для них в UI показываем пояснение.
export const COMPLEX = new Set([
  'тесть','тёща','свёкор','свекровь','зять','невестка','сноха','шурин',
  'свояченица','свояк','деверь','золовка','сват','сватья'
]);
```

- [ ] **Step 2: Commit**

```bash
git add src/terms.js
git commit -m "feat: russian kinship terms table with definitions"
```

---

## Task 5: kinship.js — кровное родство (LCA + дистанции)

**Files:**
- Create: `src/kinship.js`
- Test: `test/kinship.test.js`

Алгоритм: подняться по `parents` от каждого, найти ближайшего общего предка, посчитать дистанции `dA`,`dB`. По паре дистанций + пол выбрать термин.

- [ ] **Step 1: Write the failing test**

`test/kinship.test.js`:
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGraph } from '../src/data.js';
import { findRelation } from '../src/kinship.js';

function g() {
  return buildGraph({ persons: [
    { id: 'gf', fio: 'Дед', sex: 'm', children: ['f', 'u'] },
    { id: 'f',  fio: 'Отец', sex: 'm', children: ['me', 'sis'] },
    { id: 'u',  fio: 'Дядя', sex: 'm', children: ['cous'] },
    { id: 'me', fio: 'Я', sex: 'm' },
    { id: 'sis',fio: 'Сестра', sex: 'f' },
    { id: 'cous',fio: 'Кузен', sex: 'm' }
  ]});
}

test('отец', () => assert.equal(findRelation(g(),'me','f').term, 'отец'));
test('сын', () => assert.equal(findRelation(g(),'f','me').term, 'сын'));
test('сестра', () => assert.equal(findRelation(g(),'me','sis').term, 'сестра'));
test('дед', () => assert.equal(findRelation(g(),'me','gf').term, 'дед'));
test('дядя', () => assert.equal(findRelation(g(),'me','u').term, 'дядя'));
test('племянник', () => assert.equal(findRelation(g(),'u','me').term, 'племянник'));
test('двоюродный брат', () => assert.equal(findRelation(g(),'me','cous').term, 'двоюродный брат'));
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/kinship.test.js`
Expected: FAIL — `Cannot find module '../src/kinship.js'`.

- [ ] **Step 3: Write minimal implementation**

`src/kinship.js`:
```javascript
import { TERMS, COMPLEX } from './terms.js';

// Карта предок->дистанция (включая саму персону на 0) через parents.
function ancestorDist(graph, id) {
  const dist = new Map();
  const q = [[id, 0]];
  while (q.length) {
    const [cur, d] = q.shift();
    if (dist.has(cur) && dist.get(cur) <= d) continue;
    dist.set(cur, d);
    const p = graph.get(cur);
    if (p) for (const par of p.parents) q.push([par, d + 1]);
  }
  return dist;
}

// Ближайший общий предок: минимизируем dA+dB.
function findLCA(graph, a, b) {
  const da = ancestorDist(graph, a);
  const db = ancestorDist(graph, b);
  let best = null;
  for (const [anc, d1] of da) {
    if (db.has(anc)) {
      const sum = d1 + db.get(anc);
      if (!best || sum < best.sum) best = { anc, dA: d1, dB: db.get(anc), sum };
    }
  }
  return best;
}

function bySex(p, m, f) { return p && p.sex === 'f' ? f : m; }

// Термин для кровного родства по (dA,dB) — отношение B к A.
function bloodTerm(graph, a, b, dA, dB) {
  const B = graph.get(b);
  if (dA === 0 && dB === 0) return null; // один человек
  if (dA === 1 && dB === 0) return bySex(B, 'отец', 'мать');
  if (dA === 0 && dB === 1) return bySex(B, 'сын', 'дочь');
  if (dA === 2 && dB === 0) return bySex(B, 'дед', 'бабушка');
  if (dA === 0 && dB === 2) return bySex(B, 'внук', 'внучка');
  if (dA === 1 && dB === 1) return bySex(B, 'брат', 'сестра');
  if (dA === 2 && dB === 1) return bySex(B, 'дядя', 'тётя');
  if (dA === 1 && dB === 2) return bySex(B, 'племянник', 'племянница');
  if (dA === 2 && dB === 2) return bySex(B, 'двоюродный брат', 'двоюродная сестра');
  // дальше — обобщённо «родственник» (детализацию N-юродных добавим в Task 6)
  return 'родственник';
}

function withMeta(term) {
  if (!term) return { term: 'не определено' };
  const t = TERMS[term];
  const out = { term };
  if (t && COMPLEX.has(term)) { out.def = t.def; out.src = t.src; }
  return out;
}

export function findRelation(graph, a, b) {
  if (a === b) return { term: 'это один человек' };
  const lca = findLCA(graph, a, b);
  if (lca) return withMeta(bloodTerm(graph, a, b, lca.dA, lca.dB));
  return { term: 'родство не найдено' };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/kinship.test.js`
Expected: PASS — все 7 тестов.

- [ ] **Step 5: Commit**

```bash
git add src/kinship.js test/kinship.test.js
git commit -m "feat: blood kinship via LCA and generation distances"
```

---

## Task 6: kinship.js — N-юродные и «removed»

**Files:**
- Modify: `src/kinship.js`
- Test: `test/kinship.test.js`

Степень кузенства = `min(dA,dB) − 1`; «N раз» (removed) = `abs(dA−dB)`. Формируем строку вида «троюродный брат», «двоюродный дядя».

- [ ] **Step 1: Write the failing test**

Добавить в `test/kinship.test.js`:
```javascript
function gDeep() {
  return buildGraph({ persons: [
    { id: 'gg', fio: 'Прадед', sex:'m', children:['a1','b1'] },
    { id: 'a1', sex:'m', children:['a2'] }, { id: 'b1', sex:'m', children:['b2'] },
    { id: 'a2', sex:'m', children:['a3'] }, { id: 'b2', sex:'m', children:['b3'] },
    { id: 'a3', sex:'m' }, { id: 'b3', sex:'m' }
  ]});
}
test('троюродные братья (dA=dB=3)', () => {
  assert.equal(findRelation(gDeep(),'a3','b3').term, 'троюродный брат');
});
test('removed: двоюродный дядя (dA=3,dB=2)', () => {
  assert.equal(findRelation(gDeep(),'a3','b2').term, 'двоюродный дядя');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/kinship.test.js`
Expected: FAIL — текущий код возвращает `'родственник'`.

- [ ] **Step 3: Заменить ветку «дальше» в bloodTerm**

В `src/kinship.js` заменить строку `return 'родственник';` на:
```javascript
  const cousinDeg = Math.min(dA, dB) - 1;       // 1=двоюродный, 2=троюродный...
  const removed = Math.abs(dA - dB);
  const ord = ['', 'двоюродный', 'троюродный', 'четвероюродный', 'пятиюродный'];
  const ordF = ['', 'двоюродная', 'троюродная', 'четвероюродная', 'пятиюродная'];
  const deg = ord[cousinDeg] || (cousinDeg + 1) + '-юродный';
  const degF = ordF[cousinDeg] || (cousinDeg + 1) + '-юродная';
  if (removed === 0) return bySex(B, deg + ' брат', degF + ' сестра');
  // removed: ниже по поколению у A => дядя/тётя; у B => племянник
  if (dA > dB) return bySex(B, deg + ' дядя', degF + ' тётя');
  return bySex(B, deg + ' племянник', degF + ' племянница');
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/kinship.test.js`
Expected: PASS — включая новые 2 теста и старые 7.

- [ ] **Step 5: Commit**

```bash
git add src/kinship.js test/kinship.test.js
git commit -m "feat: N-th cousins and removed relations"
```

---

## Task 7: kinship.js — свойство (родство по браку)

**Files:**
- Modify: `src/kinship.js`
- Test: `test/kinship.test.js`

Если кровного предка нет, пробуем через супруга: B приходится A родственником по браку. Правила: супруг(а) кровного родственника / кровный родственник супруга(и).

- [ ] **Step 1: Write the failing test**

Добавить в `test/kinship.test.js`:
```javascript
function gInlaw() {
  return buildGraph({ persons: [
    { id:'wf', fio:'Отец жены', sex:'m', children:['wife'] },
    { id:'wm', fio:'Мать жены', sex:'f', children:['wife'] },
    { id:'wb', fio:'Брат жены', sex:'m' },
    { id:'wife', fio:'Жена', sex:'f', spouses:['me'] },
    { id:'me', fio:'Я', sex:'m' }
  ]});
}
// wb брат wife — нужно вручную связать как siblings через общих родителей:
function gInlaw2() {
  return buildGraph({ persons: [
    { id:'wf', sex:'m', children:['wife','wb'] },
    { id:'wife', fio:'Жена', sex:'f', spouses:['me'] },
    { id:'wb', fio:'Брат жены', sex:'m' },
    { id:'me', fio:'Я', sex:'m' }
  ]});
}
test('тесть (отец жены)', () => {
  assert.equal(findRelation(gInlaw(),'me','wf').term, 'тесть');
});
test('тёща (мать жены)', () => {
  assert.equal(findRelation(gInlaw(),'me','wm').term, 'тёща');
});
test('шурин (брат жены)', () => {
  assert.equal(findRelation(gInlaw2(),'me','wb').term, 'шурин');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/kinship.test.js`
Expected: FAIL — сейчас возвращается «родство не найдено».

- [ ] **Step 3: Добавить разрешение через брак**

В `src/kinship.js` заменить тело `findRelation` на:
```javascript
export function findRelation(graph, a, b) {
  if (a === b) return { term: 'это один человек' };
  const A = graph.get(a), B = graph.get(b);
  if (!A || !B) return { term: 'родство не найдено' };

  // 1) прямой супруг
  if (A.spouses.includes(b)) return withMeta(bySex(B, 'муж', 'жена'));

  // 2) кровное
  const lca = findLCA(graph, a, b);
  if (lca) return withMeta(bloodTerm(graph, a, b, lca.dA, lca.dB));

  // 3) свойство: B — кровный родственник супруги(а) A
  for (const sp of A.spouses) {
    const r = bloodTermBetween(graph, sp, b);
    const t = affinityFromSpouseRel(r, B, A);
    if (t) return withMeta(t);
  }
  // 4) свойство: B — супруг кровного родственника A
  for (const r of A.children.concat(siblings(graph, a))) {
    if (graph.get(r) && graph.get(r).spouses.includes(b)) {
      const base = bloodTermBetween(graph, a, r);
      const t = affinityFromRelSpouse(base, B);
      if (t) return withMeta(t);
    }
  }
  return { term: 'родство не найдено' };
}

function siblings(graph, id) {
  const p = graph.get(id); const res = [];
  for (const par of p.parents) for (const c of (graph.get(par)?.children||[]))
    if (c !== id && !res.includes(c)) res.push(c);
  return res;
}
function bloodTermBetween(graph, a, b) {
  const lca = findLCA(graph, a, b);
  return lca ? bloodTerm(graph, a, b, lca.dA, lca.dB) : null;
}
// B — кровный родственник супруга A. r = кем B приходится супругу.
function affinityFromSpouseRel(r, B, A) {
  const meFemale = A.sex === 'f';
  if (r === 'отец') return meFemale ? 'свёкор' : 'тесть';
  if (r === 'мать') return meFemale ? 'свекровь' : 'тёща';
  if (r === 'брат') return meFemale ? 'деверь' : 'шурин';
  if (r === 'сестра') return meFemale ? 'золовка' : 'свояченица';
  return null;
}
// base — кем родственник r приходится A; B = супруг r.
function affinityFromRelSpouse(base, B) {
  if (base === 'сын') return 'невестка';   // жена сына
  if (base === 'дочь') return 'зять';       // муж дочери
  if (base === 'сестра') return B.sex === 'm' ? 'зять' : null;
  if (base === 'брат') return B.sex === 'f' ? 'невестка' : null;
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/kinship.test.js`
Expected: PASS — все тесты (кровные + 3 свойства).

- [ ] **Step 5: Commit**

```bash
git add src/kinship.js test/kinship.test.js
git commit -m "feat: affinity (in-law) relations via spouse resolution"
```

---

## Task 8: auth.js — проверка пароля

**Files:**
- Create: `src/auth.js`
- Test: `test/auth.test.js`

- [ ] **Step 1: Write the failing test**

`test/auth.test.js`:
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodePassword, checkPassword } from '../src/auth.js';

test('верный пароль (кириллица) проходит', () => {
  const stored = encodePassword('секрет');
  assert.equal(checkPassword('секрет', stored), true);
});
test('неверный пароль отклоняется', () => {
  const stored = encodePassword('секрет');
  assert.equal(checkPassword('другой', stored), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/auth.test.js`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Write minimal implementation**

`src/auth.js`:
```javascript
import { encodeData } from './data.js'; // переиспользуем UTF-8 base64? нет — нужен текст.

function b64(str) {
  let bin = '';
  for (const byte of new TextEncoder().encode(str)) bin += String.fromCharCode(byte);
  return btoa(bin);
}
export function encodePassword(plain) { return b64(plain); }
export function checkPassword(input, storedB64) { return b64(input) === storedB64; }
```
(Удали неиспользуемый импорт `encodeData` — оставлен по ошибке; финальный файл начинается с `function b64`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/auth.test.js`
Expected: PASS — оба теста.

- [ ] **Step 5: Commit**

```bash
git add src/auth.js test/auth.test.js
git commit -m "feat: base64 password check (UTF-8 safe)"
```

---

## Task 9: card.js — рендер карточки (чистая строка)

**Files:**
- Create: `src/card.js`
- Test: `test/card.test.js`

Чистая функция `renderCardHTML(person) -> string`. Тестируем наличие ключевых полей в HTML без DOM.

- [ ] **Step 1: Write the failing test**

`test/card.test.js`:
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderCardHTML } from '../src/card.js';

const dead = { id:'1', fio:'Анна Захаровна', sex:'f', birthYear:1901, deathYear:1978,
  status:'deceased', nationality:'Русская', birthPlace:'с. Покровское',
  bio:'Мать восьмерых.', restPlace:'Покровское кладбище',
  restMapUrl:'https://yandex.ru/maps/?text=x' };
const alive = { id:'2', fio:'Катя', sex:'f', birthYear:1992, status:'alive',
  contacts:'tg: @katya' };

test('упокоенная: показывает годы, статус, ссылку на карту', () => {
  const h = renderCardHTML(dead);
  assert.match(h, /Анна Захаровна/);
  assert.match(h, /1901/); assert.match(h, /1978/);
  assert.match(h, /Упокоена/i);
  assert.match(h, /yandex\.ru\/maps/);
});
test('живая: показывает контакты, без ссылки на карту', () => {
  const h = renderCardHTML(alive);
  assert.match(h, /@katya/);
  assert.doesNotMatch(h, /yandex\.ru\/maps/);
});
test('нет фото: силуэт по полу (f => женский)', () => {
  const h = renderCardHTML(alive);
  assert.match(h, /silhouette-f|👩|&#128105;/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/card.test.js`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Write minimal implementation**

`src/card.js`:
```javascript
const STATUS = {
  alive:    { label: 'Жив', icon: '🕊' },
  deceased: { label: 'Упокоен', icon: '⚰' },
  unknown:  { label: 'Неизвестно', icon: '?' }
};
function statusFor(p) {
  const s = STATUS[p.status] || STATUS.unknown;
  // согласование рода для ж.
  if (p.sex === 'f' && p.status === 'alive') return { ...s, label: 'Жива' };
  if (p.sex === 'f' && p.status === 'deceased') return { ...s, label: 'Упокоена' };
  return s;
}
function silhouette(sex) {
  return sex === 'f'
    ? '<span class="silhouette-f">&#128105;</span>'
    : '<span class="silhouette-m">&#128104;</span>';
}
function esc(s){ return String(s ?? '').replace(/[&<>"]/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

export function renderCardHTML(p) {
  const st = statusFor(p);
  const years = p.deathYear ? `${p.birthYear ?? '?'} — ${p.deathYear}`
                            : (p.birthYear ? `${p.birthYear}` : '');
  const photo = p.photo
    ? `<img class="ft-photo" src="photos/${esc(p.photo)}" alt="">`
    : `<div class="ft-photo ft-silh">${silhouette(p.sex)}</div>`;
  const rest = (p.status === 'deceased' && p.restMapUrl)
    ? `<a class="ft-rest" href="${esc(p.restMapUrl)}" target="_blank" rel="noopener">📍 ${esc(p.restPlace || 'на карте')}</a>`
    : '';
  const contacts = (p.status === 'alive' && p.contacts)
    ? `<div class="ft-contacts">${esc(p.contacts)}</div>` : '';
  return `
<div class="ft-card ft-${esc(p.status)}" data-id="${esc(p.id)}">
  <div class="ft-crest">&#9818;</div>
  ${photo}
  <h3 class="ft-name">${esc(p.fio)}</h3>
  <div class="ft-years">${esc(years)}</div>
  <div class="ft-status">${st.icon} ${esc(st.label)}</div>
  <div class="ft-divider"></div>
  ${p.bio ? `<div class="ft-bio">${esc(p.bio)}</div>` : ''}
  <div class="ft-meta">${esc([p.nationality, p.birthPlace && 'род. ' + p.birthPlace].filter(Boolean).join(' · '))}</div>
  ${rest}${contacts}
</div>`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/card.test.js`
Expected: PASS — 3 теста.

- [ ] **Step 5: Добавить CSS карточки в `css/styles.css`**

Добавить полный бордо-стиль (рамка, орнаменты по углам, золотое фото, дамаск-узор) — портировать из мокапа `burgundy-final.html`:
```css
.ft-card{position:relative;width:200px;border-radius:4px;overflow:hidden;
  background:radial-gradient(circle at 30% 20%,var(--burg-1),var(--burg-2) 75%);
  border:1.5px solid var(--gold);padding:24px 18px 18px;text-align:center;
  box-shadow:0 8px 28px rgba(0,0,0,.4);font-family:'Cinzel',Georgia,serif}
.ft-card:before{content:"";position:absolute;inset:6px;border:.5px solid var(--gold-2);
  pointer-events:none}
.ft-crest{color:var(--gold);font-size:18px;margin-bottom:4px}
.ft-photo{width:80px;height:80px;border-radius:50%;margin:0 auto 10px;
  border:3px solid var(--gold);background:var(--photobg);display:flex;
  align-items:center;justify-content:center;font-size:40px;color:var(--gold);
  object-fit:cover;box-shadow:0 0 0 2px var(--gold-2)}
.ft-name{font-size:15px;letter-spacing:1px;color:var(--name);margin:.2em 0}
.ft-years{font-size:11px;font-style:italic;color:var(--gold)}
.ft-status{font-size:10px;letter-spacing:1px;color:var(--gold);
  border:1px solid var(--gold);border-radius:99px;display:inline-block;
  padding:2px 10px;margin:6px 0;text-transform:uppercase}
.ft-divider{width:60%;height:1px;margin:8px auto;
  background:linear-gradient(90deg,transparent,var(--gold),transparent)}
.ft-bio{font-size:11px;font-style:italic;color:var(--name);opacity:.82;margin:6px 4px}
.ft-meta{font-size:10px;letter-spacing:.5px;color:var(--meta);text-transform:uppercase}
.ft-rest,.ft-contacts{display:block;font-size:11px;color:var(--gold);margin-top:6px}
.ft-rest{text-decoration:underline}
```

- [ ] **Step 6: Commit**

```bash
git add src/card.js test/card.test.js css/styles.css
git commit -m "feat: burgundy card renderer + styles"
```

---

## Task 10: Вендоринг family-chart + tree.js (трансформ + инициализация)

**Files:**
- Create: `vendor/family-chart.js`, `vendor/family-chart.css` (скачать релиз)
- Create: `src/tree.js`
- Test: `test/tree.test.js`

family-chart ждёт массив `{ id, rels:{father,mother,spouses,children}, data:{...} }`. Пишем чистый трансформер (тестируем) + тонкую `initTree` (браузер).

- [ ] **Step 1: Скачать family-chart в vendor**

Run:
```bash
mkdir -p vendor
curl -L -o vendor/family-chart.js https://unpkg.com/family-chart@0.9.0/dist/family-chart.js
curl -L -o vendor/family-chart.css https://unpkg.com/family-chart@0.9.0/dist/family-chart.css
```
Expected: оба файла скачаны (не пустые). Проверь `ls -la vendor`.
(Если версия 0.9.0 недоступна — открой https://unpkg.com/family-chart/ и возьми актуальную, обнови `index.html` пути не меняя.)

- [ ] **Step 2: Write the failing test**

`test/tree.test.js`:
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGraph } from '../src/data.js';
import { toFamilyChartData } from '../src/tree.js';

test('трансформер мапит родителей по полу и сохраняет data', () => {
  const g = buildGraph({ persons: [
    { id:'f', fio:'Отец', sex:'m', spouses:['m'], children:['c'] },
    { id:'m', fio:'Мать', sex:'f', spouses:['f'], children:['c'] },
    { id:'c', fio:'Дитя', sex:'m' }
  ]});
  const arr = toFamilyChartData(g);
  const child = arr.find(x => x.id === 'c');
  assert.equal(child.rels.father, 'f');
  assert.equal(child.rels.mother, 'm');
  assert.equal(child.data.fio, 'Дитя');
  const dad = arr.find(x => x.id === 'f');
  assert.deepEqual(dad.rels.spouses, ['m']);
  assert.deepEqual(dad.rels.children, ['c']);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test test/tree.test.js`
Expected: FAIL — модуль не найден.

- [ ] **Step 4: Write minimal implementation**

`src/tree.js`:
```javascript
import { renderCardHTML } from './card.js';

export function toFamilyChartData(graph) {
  const out = [];
  for (const p of graph.values()) {
    let father = null, mother = null;
    for (const par of p.parents) {
      const pp = graph.get(par);
      if (pp && pp.sex === 'f') mother = par; else if (pp) father = par;
    }
    out.push({
      id: p.id,
      rels: { father, mother, spouses: [...p.spouses], children: [...p.children] },
      data: { ...p }
    });
  }
  return out;
}

// Браузерная обёртка: создаёт диаграмму family-chart.
// f3 — глобал из vendor/family-chart.js (подключается в index.html).
export function initTree(container, graph, { onCardClick } = {}) {
  /* global f3 */
  const data = toFamilyChartData(graph);
  const chart = f3.createChart(container, data)
    .setTransitionTime(600)
    .setCardYSpacing(260)
    .setCardXSpacing(240)
    .setOrientationVertical();
  const card = chart.setCard(f3.CardHtml)
    .setCardInnerHtmlCreator(d => renderCardHTML(d.data.data));
  if (onCardClick) card.setOnCardClick((e, d) => onCardClick(d.data.id));
  chart.updateTree({ initial: true });
  return chart;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test test/tree.test.js`
Expected: PASS.

- [ ] **Step 6: Browser manual check**

Создай временный `data.json` через консоль (см. Task 13) или хардкод 3 персон в `app.js` (заглушка). Запусти `python3 -m http.server 8000`, открой `http://localhost:8000`. Ожидаемо: рисуются бордо-карточки, есть zoom/pan, клик логирует id. Зафиксируй скриншот глазами.

- [ ] **Step 7: Commit**

```bash
git add vendor/family-chart.js vendor/family-chart.css src/tree.js test/tree.test.js
git commit -m "feat: vendor family-chart + tree transform and init"
```

---

## Task 11: photo.js — ресайз фото в браузере

**Files:**
- Create: `src/photo.js`

Browser-only (canvas). Юнит-тест в node неуместен — проверяем в браузере.

- [ ] **Step 1: Write implementation**

`src/photo.js`:
```javascript
// Ресайз изображения до maxSize (по большей стороне), возврат Blob (jpeg).
export function resizeImage(file, maxSize = 400, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')),
        'image/jpeg', quality);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]); // без data: префикса
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
```

- [ ] **Step 2: Browser manual check**

В консоли браузера: выбрать файл через `<input type=file>`, вызвать `resizeImage(file)`, проверить что Blob.size заметно меньше и размеры ≤400px (через `createImageBitmap`).

- [ ] **Step 3: Commit**

```bash
git add src/photo.js
git commit -m "feat: in-browser image resize to ~400px"
```

---

## Task 12: save.js — коммит в GitHub через токен

**Files:**
- Create: `src/save.js`
- Test: `test/save.test.js`

Чистая `buildCommitFiles` (что коммитить) тестируется; `commitToGitHub` (fetch к GitHub API) — тонкая обёртка, тестируем построение запросов с подменённым `fetch`.

- [ ] **Step 1: Write the failing test**

`test/save.test.js`:
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCommitFiles } from '../src/save.js';

test('buildCommitFiles: data.json + новые фото', () => {
  const files = buildCommitFiles(
    'BASE64DATA',
    [{ name: 'p1.jpg', base64: 'AAAA' }],
    { dataPath: 'data.json', photosDir: 'photos' }
  );
  assert.deepEqual(files[0], { path: 'data.json', contentB64: 'BASE64DATA' });
  assert.deepEqual(files[1], { path: 'photos/p1.jpg', contentB64: 'AAAA' });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/save.test.js`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Write minimal implementation**

`src/save.js`:
```javascript
export function buildCommitFiles(dataB64, newPhotos, cfg) {
  const files = [{ path: cfg.dataPath, contentB64: dataB64 }];
  for (const ph of newPhotos || [])
    files.push({ path: `${cfg.photosDir}/${ph.name}`, contentB64: ph.base64 });
  return files;
}

// Коммитит файлы через GitHub Contents API (по одному PUT).
// token — персональный токен с правом repo (вводится пользователем, не хранится).
export async function commitToGitHub(token, cfg, files, message, fetchImpl = fetch) {
  const [owner, repo] = cfg.repo.split('/');
  for (const f of files) {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${f.path}`;
    // получить sha существующего файла (если есть)
    let sha;
    const head = await fetchImpl(`${url}?ref=${cfg.branch}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (head.ok) sha = (await head.json()).sha;
    const res = await fetchImpl(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message, content: f.contentB64, branch: cfg.branch, ...(sha ? { sha } : {})
      })
    });
    if (!res.ok) throw new Error(`GitHub API ${res.status} на ${f.path}`);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/save.test.js`
Expected: PASS.

- [ ] **Step 5: Browser manual check (позже, с реальной репой)**

После деплоя: войти админом, изменить поле, «Сохранить», ввести токен → проверить новый коммит в репе. Отложить до Task 14.

- [ ] **Step 6: Commit**

```bash
git add src/save.js test/save.test.js
git commit -m "feat: GitHub Contents API commit (data + photos)"
```

---

## Task 13: app.js — оркестратор (режимы, модалки, события)

**Files:**
- Create: `src/app.js`
- Modify: `css/styles.css` (стили модалок)

Браузерная склейка. Покрытие — ручное в браузере (логика уже покрыта модульными тестами).

- [ ] **Step 1: Написать app.js**

`src/app.js`:
```javascript
import { CONFIG } from '../config.js';
import { decodeData, encodeData, buildGraph } from './data.js';
import { checkPassword } from './auth.js';
import { initTree } from './tree.js';
import { findRelation } from './kinship.js';
import { resizeImage, blobToBase64 } from './photo.js';
import { buildCommitFiles, commitToGitHub } from './save.js';

const state = {
  graph: null, raw: null, admin: false, chart: null,
  selected: [], newPhotos: []
};

async function loadData() {
  const res = await fetch(CONFIG.dataPath + '?_=' + Date.now());
  const b64 = res.ok ? (await res.text()).trim() : '';
  state.raw = decodeData(b64);
  state.graph = buildGraph(state.raw);
}

function renderTree() {
  const el = document.getElementById('tree');
  el.innerHTML = '';
  state.chart = initTree(el, state.graph, { onCardClick: onCardClick });
}

function onCardClick(id) {
  if (document.body.classList.contains('kinship-mode')) {
    toggleSelect(id);
  } else {
    openPersonModal(id, state.admin);
  }
}

function toggleSelect(id) {
  const i = state.selected.indexOf(id);
  if (i >= 0) state.selected.splice(i, 1); else state.selected.push(id);
  if (state.selected.length === 2) {
    const [a, b] = state.selected;
    const r = findRelation(state.graph, a, b);
    showKinshipResult(state.graph.get(a), state.graph.get(b), r);
    state.selected = [];
    document.body.classList.remove('kinship-mode');
  }
}

// ——— модалки (минимальный inline-UI) ———
function modal(html) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="ft-overlay"><div class="ft-modal">${html}
    <button class="ft-close">×</button></div></div>`;
  root.querySelector('.ft-close').onclick = () => root.innerHTML = '';
  root.querySelector('.ft-overlay').onclick = e => {
    if (e.target.classList.contains('ft-overlay')) root.innerHTML = '';
  };
  return root.querySelector('.ft-modal');
}

function showKinshipResult(A, B, r) {
  const extra = r.def ? `<p class="ft-def">${r.def} <a href="${r.src}" target="_blank">подробнее</a></p>` : '';
  modal(`<h3>Кто кому кем</h3>
    <p><b>${B.fio}</b> приходится <b>${A.fio}</b>:</p>
    <p class="ft-term">${r.term}</p>${extra}`);
}

function openPersonModal(id, editable) {
  const p = state.graph.get(id);
  if (!editable) {
    modal(`<h3>${p.fio}</h3><pre class="ft-info">${JSON.stringify(p, null, 2)}</pre>`);
    return;
  }
  // форма редактирования
  const m = modal(`<h3>Правка: ${p.fio}</h3>
    <form id="ft-form">
      ${field('fio','ФИО',p.fio)}
      ${select('sex','Пол',p.sex,{m:'муж',f:'жен'})}
      ${field('birthYear','Год рождения',p.birthYear)}
      ${field('deathYear','Год смерти',p.deathYear)}
      ${select('status','Статус',p.status,{alive:'жив',deceased:'упокоен',unknown:'неизв'})}
      ${field('birthPlace','Место рождения',p.birthPlace)}
      ${field('nationality','Национальность',p.nationality)}
      ${field('bio','БИО',p.bio)}
      ${field('contacts','Контакты (для живых)',p.contacts)}
      ${field('restPlace','Место упокоения',p.restPlace)}
      ${field('restMapUrl','Ссылка Яндекс.Карты',p.restMapUrl)}
      <label>Фото <input type="file" id="ft-photo" accept="image/*"></label>
      <button type="submit">Применить</button>
    </form>
    <div class="ft-addrel">
      Добавить родню: 
      <select id="ft-relkind">
        <option value="spouse">супруг(а)</option>
        <option value="child">ребёнок</option>
        <option value="parent">родитель</option>
      </select>
      <button id="ft-addbtn">+ новая карточка</button>
    </div>`);
  m.querySelector('#ft-form').onsubmit = async ev => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    for (const [k, v] of fd.entries()) p[k] = v === '' ? null : v;
    p.birthYear = p.birthYear ? +p.birthYear : null;
    p.deathYear = p.deathYear ? +p.deathYear : null;
    const file = m.querySelector('#ft-photo').files[0];
    if (file) {
      const blob = await resizeImage(file);
      const name = `${p.id}.jpg`;
      p.photo = name;
      state.newPhotos.push({ name, base64: await blobToBase64(blob) });
    }
    syncRawFromGraph();
    document.getElementById('modal-root').innerHTML = '';
    renderTree();
  };
  m.querySelector('#ft-addbtn').onclick = () => addRelative(id, m.querySelector('#ft-relkind').value);
}

function field(name, label, val) {
  return `<label>${label}<input name="${name}" value="${val ?? ''}"></label>`;
}
function select(name, label, val, opts) {
  const o = Object.entries(opts).map(([k,t]) =>
    `<option value="${k}" ${k===val?'selected':''}>${t}</option>`).join('');
  return `<label>${label}<select name="${name}">${o}</select></label>`;
}

function addRelative(id, kind) {
  const p = state.graph.get(id);
  const nid = 'id' + Date.now();
  const np = { id: nid, fio: 'Новый', sex: 'm', status: 'unknown',
    parents: [], spouses: [], children: [] };
  if (kind === 'spouse') { np.spouses.push(id); p.spouses.push(nid); }
  if (kind === 'child')  { np.parents.push(id); p.children.push(nid); }
  if (kind === 'parent') { np.children.push(id); p.parents.push(nid); }
  state.graph.set(nid, np);
  syncRawFromGraph();
  document.getElementById('modal-root').innerHTML = '';
  renderTree();
  openPersonModal(nid, true);
}

function syncRawFromGraph() {
  state.raw = { persons: [...state.graph.values()] };
}

async function doSave() {
  const token = prompt('GitHub токен (repo scope). Не сохраняется:');
  if (!token) return;
  try {
    const dataB64 = encodeData(state.raw);
    const files = buildCommitFiles(dataB64, state.newPhotos, CONFIG);
    await commitToGitHub(token, CONFIG, files, 'Update family data');
    state.newPhotos = [];
    alert('Сохранено в GitHub. Pages обновится через минуту.');
  } catch (e) {
    alert('Ошибка сохранения: ' + e.message);
  }
}

// ——— события topbar ———
document.getElementById('adminBtn').onclick = () => {
  if (state.admin) return;
  const pw = prompt('Пароль администратора:');
  if (pw && checkPassword(pw, CONFIG.passwordB64)) {
    state.admin = true;
    document.body.classList.add('admin');
    document.getElementById('saveBtn').hidden = false;
    alert('Режим редактирования включён.');
  } else if (pw !== null) {
    alert('Неверный пароль.');
  }
};
document.getElementById('saveBtn').onclick = doSave;
document.getElementById('kinshipBtn').onclick = () => {
  state.selected = [];
  document.body.classList.toggle('kinship-mode');
  alert(document.body.classList.contains('kinship-mode')
    ? 'Выбери две карточки.' : 'Режим родства выключен.');
};

await loadData();
renderTree();
```

- [ ] **Step 2: Добавить стили модалок в `css/styles.css`**

```css
.ft-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;
  align-items:center;justify-content:center;z-index:100}
.ft-modal{position:relative;background:linear-gradient(#3a1518,#2a1014);
  border:1.5px solid var(--gold);border-radius:6px;padding:22px;max-width:420px;
  width:90%;max-height:85vh;overflow:auto;color:var(--name)}
.ft-modal h3{color:var(--gold);margin-top:0}
.ft-modal label{display:block;margin:8px 0;font-size:13px}
.ft-modal input,.ft-modal select{width:100%;padding:6px;margin-top:2px;
  background:#1c0a0d;border:1px solid var(--gold);color:var(--name);border-radius:3px}
.ft-modal button[type=submit],#ft-addbtn{background:var(--gold);color:var(--burg-2);
  border:none;padding:8px 14px;border-radius:4px;cursor:pointer;margin-top:10px}
.ft-close{position:absolute;top:8px;right:12px;background:none;border:none;
  color:var(--gold);font-size:22px;cursor:pointer}
.ft-term{font-size:24px;color:var(--gold);text-align:center;font-family:'Cinzel',serif}
.ft-def{font-size:13px;color:var(--meta)}
.ft-info{white-space:pre-wrap;font-size:12px;color:var(--meta)}
body:not(.admin) .ft-addrel{display:none}
body.kinship-mode #tree{outline:2px dashed var(--gold)}
```

- [ ] **Step 3: Browser manual check**

`python3 -m http.server 8000` → `http://localhost:8000`:
- Дерево рисуется (read-only), клик по карточке → инфо-модалка.
- «Редактировать» → пароль из CONFIG → форма правки, «+ новая карточка» добавляет родню.
- «Кто кому кем» → выбор двух карточек → термин + пояснение.
- (Сохранение в GitHub — проверим в Task 14.)

- [ ] **Step 4: Commit**

```bash
git add src/app.js css/styles.css
git commit -m "feat: app orchestrator — modes, modals, edit, kinship UI"
```

---

## Task 14: Каркас данных с PDF + деплой на GitHub Pages

**Files:**
- Create: `data.json` (base64)
- Create: `scripts/seed.mjs` (одноразовый генератор каркаса)

- [ ] **Step 1: Собрать персон из PDF в seed-скрипт**

`scripts/seed.mjs` — перечислить имена и связи со стикеров (только ФИО + связи, остальное пусто; проверить по PDF):
```javascript
import { encodeData } from '../src/data.js';
import { writeFileSync } from 'node:fs';

const persons = [
  // верхние пары и их ветки — заполнить по схеме PDF
  { id:'zahar', fio:'Захар', sex:'m', status:'unknown', spouses:['anna'],
    children:['varvara','petr1','ivan1','pavel'] },
  { id:'anna', fio:'Анна', sex:'f', status:'unknown', spouses:['zahar'] },
  { id:'vasilisa', fio:'Василиса', sex:'f', status:'unknown', spouses:['petrV'] },
  { id:'petrV', fio:'Пётр', sex:'m', status:'unknown', spouses:['vasilisa'],
    children:['pelagia','andrey','ivan2','petr2','evgenia'] },
  // ... остальные узлы: Варвара, Пётр, Иван, Павел♥Пелагия, Андрей, Евгения,
  //     Вера♥Алексей, Виктор♥Ира, Олег♥Лариса, Павел♥Инна, Михаил♥Лиля,
  //     Александр♥Зинаида, Дима♥Катя, Даша♥Денис, Диана, Ваня, Полина,
  //     Антон, Даня, Олег/Юра/Ира/Рома, Сергей♥Елена, Ира/Наташа — ПРОВЕРИТЬ ПО PDF.
];

writeFileSync(new URL('../data.json', import.meta.url), encodeData({ persons }));
console.log('data.json создан:', persons.length, 'персон');
```

- [ ] **Step 2: Сгенерировать data.json**

Run: `node scripts/seed.mjs`
Expected: `data.json создан: N персон`. Проверь, что `data.json` — одна base64-строка.

- [ ] **Step 3: Проставить CONFIG и пароль**

В `config.js`: заменить `repo` на реальный `owner/repo`, сгенерировать `passwordB64`:
Run (в node): `node -e "process.stdout.write(Buffer.from('ТВОЙ_ПАРОЛЬ','utf8').toString('base64'))"`
Вставить результат в `CONFIG.passwordB64`.

- [ ] **Step 4: Локальная проверка целиком**

Run: `python3 -m http.server 8000` → открыть, убедиться что дерево из PDF-каркаса рисуется, режимы работают.

- [ ] **Step 5: Commit + push + включить Pages**

```bash
git add data.json scripts/seed.mjs config.js
git commit -m "feat: seed family tree skeleton from PDF + deploy config"
# создать репу на GitHub (gh repo create) и запушить:
# gh repo create <name> --public --source=. --push
```
Затем в Settings → Pages → Source: `main` / root. Дождаться публикации.

- [ ] **Step 6: Проверка прод-сохранения**

На опубликованном сайте: «Редактировать» → пароль → правка → «Сохранить» → ввести GitHub-токен (scope `repo`/`public_repo`) → убедиться, что появился коммит и Pages обновился.

---

## Self-Review (выполнено при написании)

**Spec coverage:**
- Стек/статика → Task 1, 10. Данные base64 + граф → Task 2,3. Просмотр/карточки → Task 9. Дерево вертикальное/сердечки/zoom → Task 10. Админ-пароль → Task 8,13. «+» добавить родню → Task 13. Сохранение через токен → Task 12,13. Фото в /photos + ресайз → Task 11,12. Силуэты → Task 9. Калькулятор родства (кровь+свойство+пояснения) → Task 4,5,6,7,13. Перенос PDF → Task 14. Хостинг Pages → Task 14. ✔ все пункты покрыты.

**Placeholders:** Код приведён в каждом шаге. Единственное намеренное «заполнить по PDF» — в seed-скрипте (Task 14), т.к. данные вводятся вручную пользователем (по согласованию: PDF содержит только имена).

**Type consistency:** `renderCardHTML(person)` (Task 9) используется в `tree.js` и `app.js`. `findRelation(graph,a,b)->{term,def?,src?}` (Task 5-7) совпадает с использованием в `app.js`. `buildGraph`→`Map` единообразно. `encodeData/decodeData` (Task 2) переиспользуются в seed и app. `buildCommitFiles/commitToGitHub` сигнатуры совпадают (Task 12 ↔ app.js). ✔
