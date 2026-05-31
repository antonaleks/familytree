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
