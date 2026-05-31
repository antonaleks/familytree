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
