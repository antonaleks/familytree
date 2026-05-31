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
