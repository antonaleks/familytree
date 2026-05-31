import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGraph } from '../src/data.js';
import { visibleIds, expandableIds, filterGraph } from '../src/focus.js';

// Род A: основатель a(м) → b(м) → c(м). b женат на w(ж), у w свой отец wp(м).
// z — изолированная персона другого рода.
function fixture() {
  return buildGraph({ persons: [
    { id: 'a', fio: 'Адам', sex: 'm', children: ['b'] },
    { id: 'b', fio: 'Борис', sex: 'm', spouses: ['w'], children: ['c'] },
    { id: 'w', fio: 'Вера', sex: 'f', children: ['c'] },
    { id: 'wp', fio: 'Пётр', sex: 'm', children: ['w'] },
    { id: 'c', fio: 'Сергей', sex: 'm' },
    { id: 'z', fio: 'Захар', sex: 'm' }
  ] });
}

test('фокус: патрилинейный род + супруги, чужой род и тесть скрыты', () => {
  const g = fixture();
  const v = visibleIds(g, 'b');
  assert.deepEqual([...v].sort(), ['a', 'b', 'c', 'w']);
  assert.ok(!v.has('wp')); // тесть скрыт до раскрытия
  assert.ok(!v.has('z'));  // чужой род скрыт
});

test('фокус null: виден весь граф', () => {
  const g = fixture();
  const v = visibleIds(g, null);
  assert.equal(v.size, 6);
});

test('expandable: вошедший по браку супруг со скрытым предком', () => {
  const g = fixture();
  const v = visibleIds(g, 'b');
  const e = expandableIds(g, v);
  assert.deepEqual([...e], ['w']); // только у w скрыт родитель (wp)
});

test('раскрытие вверх: expanded={w} показывает тестя wp', () => {
  const g = fixture();
  const v = visibleIds(g, 'b', new Set(['w']));
  assert.ok(v.has('wp'));
  assert.ok(!v.has('z')); // боковых ветвей не добавляет
});

test('filterGraph: подграф из видимых, исходный не мутирован', () => {
  const g = fixture();
  const v = visibleIds(g, 'b');
  const sub = filterGraph(g, v);
  assert.equal(sub.size, 4);
  assert.ok(sub.has('a') && !sub.has('z'));
  assert.equal(g.size, 6); // оригинал цел
});
