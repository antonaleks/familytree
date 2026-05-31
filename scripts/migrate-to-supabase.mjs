import { readFile, readdir } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.VITE_SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET_KEY;
if (!URL || !SECRET) {
  console.error('Set VITE_SUPABASE_URL and SUPABASE_SECRET_KEY in env (.env + .env.local).');
  process.exit(1);
}
const supabase = createClient(URL, SECRET, { auth: { persistSession: false } });

function b64ToString(b64) {
  return Buffer.from(b64, 'base64').toString('utf8');
}

async function main() {
  // 1) данные: public/data.json содержит base64 JSON
  const raw = (await readFile('public/data.json', 'utf8')).trim();
  const obj = raw ? JSON.parse(b64ToString(raw)) : { persons: [] };
  if (!Array.isArray(obj.persons)) throw new Error('data.json: persons not an array');

  const { error: upErr } = await supabase
    .from('tree')
    .upsert({ id: 1, data: obj, version: 1 }, { onConflict: 'id' });
  if (upErr) throw upErr;
  console.log(`Uploaded tree blob: ${obj.persons.length} persons.`);

  // 2) фото: public/photos/* → bucket photos
  let files = [];
  try { files = await readdir('public/photos'); } catch { /* no photos dir */ }
  for (const name of files) {
    if (name.startsWith('.')) continue;
    const buf = await readFile(`public/photos/${name}`);
    const { error } = await supabase.storage
      .from('photos').upload(name, buf, { upsert: true, contentType: 'image/jpeg' });
    if (error) { console.error(`Photo ${name}: ${error.message}`); continue; }
    console.log(`Uploaded photo: ${name}`);
  }
  console.log('Migration done.');
}
main().catch(e => { console.error(e); process.exit(1); });
