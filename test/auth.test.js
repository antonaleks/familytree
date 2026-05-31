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
