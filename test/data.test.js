import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeData, decodeData } from '../src/data.js';

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
