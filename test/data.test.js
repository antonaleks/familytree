import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeData, decodeData, buildGraph } from '../src/data.js';

test('encode/decode round-trip с кириллицей', () => {
  const obj = { persons: [{ id: '1', fio: 'Анна Захаровна' }] };
  const b64 = encodeData(obj);
  assert.equal(typeof b64, 'string');
  assert.doesNotMatch(b64, /Анна/); // действительно закодировано
  const back = decodeData(b64);
  assert.deepEqual(back, obj);
});

test('decode пустого/битого даёт пустой набор', () => {
  assert.deepEqual(decodeData(''), { persons: [] });
});

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
