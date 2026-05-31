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
