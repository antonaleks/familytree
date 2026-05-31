# Supabase Migration MVP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move family-tree storage from base64-JSON in the git repo to Supabase (Postgres jsonb blob + Storage for photos), with family editing gated by a single shared Supabase account; frontend stays static on GitHub Pages.

**Architecture:** React+Vite SPA loads the whole tree as one jsonb blob from a single-row `tree` table via `supabase-js` (publishable key, RLS: anon read / authenticated write). Editing requires signing into one shared Supabase account. Photos go to a public Storage bucket. An optimistic `version` lock prevents overwrites. Layout (`layout-core.js`) and kinship (`kinship.js`) are untouched — the in-memory data shape stays identical.

**Tech Stack:** React 18, Vite 5, `@supabase/supabase-js` v2, `@xyflow/react`, Supabase (Postgres + Auth + Storage).

**Reference spec:** `docs/superpowers/specs/2026-05-31-supabase-migration-mvp-design.md`

**Provided credentials (already known):**
- URL: `https://sdrgxqbczezsbxwtnifz.supabase.co`
- Publishable key (client, safe): `sb_publishable_G7mHfkdgtJxq0X92TUGDKQ_qYQdIOR_`
- DB string (migration only, password is a SECRET): `postgresql://postgres:[PASSWORD]@db.sdrgxqbczezsbxwtnifz.supabase.co:5432/postgres`
- Secret key `sb_secret_...` — fetch from Dashboard → Settings → API when running migration.

**Testing note (read first):** Pure modules (`data.js`, `layout-core.js`, `kinship.js`) keep their existing `node --test` coverage and must stay green after every commit (`npm test`). The new code (`db.js`, auth, storage, App wiring) is network/browser integration glue — it is verified via the **manual browser checklist** in Task 7, not via mocked unit tests (mocking the supabase client would test the mock, not the system). Where a genuinely pure helper exists (`card.js` photo-URL detection), it gets a real unit test.

---

## File Structure

- `.gitignore` — create: ignore secrets and build artifacts.
- `.env` — create (committed): public `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY`.
- `.env.local` — create (gitignored): `SUPABASE_SECRET_KEY` for migration only.
- `package.json` — modify: add `@supabase/supabase-js` dep, `migrate` script.
- `src/db.js` — create: supabase client + `loadTree`, `saveTree`, `uploadPhoto`, `photoUrl`, `signIn`, `signOut`, `getSession`.
- `src/card.js` — modify (line 34-35): support absolute photo URLs.
- `src/PersonNode.jsx` — modify: resolve photo filename → public URL before render.
- `src/App.jsx` — modify: load from `db.loadTree`, sign-in admin flow, save via `db.saveTree`, upload photos via `db.uploadPhoto`; remove GitHub-save + `decodeData` fetch.
- `src/auth.js` — modify: thin wrapper over supabase session (replace base64 password).
- `src/save.js` — delete: GitHub Contents API no longer used.
- `config.js` — delete: `repo`/`passwordB64`/GitHub settings no longer used.
- `scripts/migrate-to-supabase.mjs` — create: one-shot data + photo migration using secret key.
- Supabase backend (SQL run in Dashboard SQL editor): `tree` table + RLS + Storage bucket + policies + shared auth user.

---

## Task 0: Project setup — git, gitignore, env, dependency

**Files:**
- Create: `.gitignore`, `.env`, `.env.local`
- Modify: `package.json`

- [ ] **Step 1: Initialize git**

Run:
```bash
cd /Users/apalekseev/familytree
git init
```
Expected: `Initialized empty Git repository`.

- [ ] **Step 2: Create `.gitignore`**

Create `/Users/apalekseev/familytree/.gitignore`:
```gitignore
node_modules
dist
.env.local
ref.md
*.log
.DS_Store
```

- [ ] **Step 3: Create committed `.env` (public values only)**

Create `/Users/apalekseev/familytree/.env`:
```dotenv
VITE_SUPABASE_URL=https://sdrgxqbczezsbxwtnifz.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_G7mHfkdgtJxq0X92TUGDKQ_qYQdIOR_
```

- [ ] **Step 4: Create gitignored `.env.local` (secret placeholder)**

Create `/Users/apalekseev/familytree/.env.local`:
```dotenv
# Secret key for one-off migration ONLY. Never commit. Never ship to client.
SUPABASE_SECRET_KEY=sb_secret_REPLACE_ME
```

- [ ] **Step 5: Install supabase-js (pinned, with lockfile)**

Run:
```bash
npm install @supabase/supabase-js@^2
```
Expected: dependency added; `package-lock.json` created/updated.

- [ ] **Step 6: Add `migrate` script to package.json**

Modify `package.json` `scripts` block to:
```json
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "node --test test/",
    "migrate": "node scripts/migrate-to-supabase.mjs"
  },
```

- [ ] **Step 7: Verify build still works**

Run: `npm test`
Expected: existing tests PASS (nothing changed in pure modules yet).

- [ ] **Step 8: Commit**

```bash
git add .gitignore .env package.json package-lock.json
git commit -m "chore: init git, add supabase-js dep and env scaffolding"
```
Note: `.env.local` and `ref.md` are gitignored and must NOT appear in the commit. Verify with `git status` that they are untracked/ignored.

---

## Task 1: Supabase backend — table, RLS, Storage, shared user

This task runs SQL in the Supabase Dashboard SQL editor (project `sdrgxqbczezsbxwtnifz`). No app code. Follow the supabase skill security checklist.

- [ ] **Step 1: Create `tree` table + RLS policies**

In Dashboard → SQL editor, run:
```sql
create table public.tree (
  id         int primary key default 1,
  data       jsonb not null default '{"persons":[]}',
  version    int   not null default 1,
  updated_at timestamptz default now()
);

alter table public.tree enable row level security;

create policy "tree_read_all" on public.tree
  for select to anon, authenticated using (true);

create policy "tree_update_auth" on public.tree
  for update to authenticated using (true) with check (true);
```

- [ ] **Step 2: Seed the single row**

```sql
insert into public.tree (id, data, version) values (1, '{"persons":[]}', 1)
on conflict (id) do nothing;
```

- [ ] **Step 3: Verify table is reachable via Data API**

In SQL editor:
```sql
select id, version from public.tree;
```
Expected: one row, id=1, version=1. If a later anon `select` from the app fails with a permissions error, grant access:
```sql
grant select on public.tree to anon, authenticated;
grant update on public.tree to authenticated;
```

- [ ] **Step 4: Create public Storage bucket `photos`**

Dashboard → Storage → New bucket: name `photos`, **Public bucket = ON**. (Public read via CDN URL; write still gated by policies below.)

- [ ] **Step 5: Add Storage write policies (upsert needs INSERT + UPDATE; SELECT covered by public bucket)**

In SQL editor:
```sql
create policy "photos_insert_auth" on storage.objects
  for insert to authenticated with check (bucket_id = 'photos');
create policy "photos_update_auth" on storage.objects
  for update to authenticated using (bucket_id = 'photos') with check (bucket_id = 'photos');
```

- [ ] **Step 6: Create the shared editor account**

Dashboard → Authentication → Users → Add user → enter an email + password (e.g. `editor@yourfamily.tld`). Check "Auto Confirm User" so no email confirmation is required. Record these credentials to share with family.

- [ ] **Step 7: Confirm anonymous sign-ins are disabled**

Dashboard → Authentication → Providers → ensure "Anonymous sign-ins" is OFF (default). Required so the `TO authenticated` policy means genuinely-signed-in users.

- [ ] **Step 8: No commit (backend change).** Note in the next commit message that backend schema was applied. Proceed to Task 2.

---

## Task 2: `src/db.js` — supabase client and data/auth/storage API

**Files:**
- Create: `src/db.js`

- [ ] **Step 1: Write `src/db.js`**

Create `/Users/apalekseev/familytree/src/db.js`:
```js
import { createClient } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(URL, KEY);

// Загрузить всё дерево (один блоб) + текущую версию.
export async function loadTree() {
  const { data, error } = await supabase
    .from('tree').select('data, version').eq('id', 1).single();
  if (error) throw error;
  return { data: data.data || { persons: [] }, version: data.version };
}

// Сохранить дерево с оптимистичным локом по version.
// Возвращает {conflict:true} если версия разошлась (ничего не записано).
export async function saveTree(treeData, version) {
  const { data, error } = await supabase
    .from('tree')
    .update({ data: treeData, version: version + 1, updated_at: new Date().toISOString() })
    .eq('id', 1).eq('version', version)
    .select('version');
  if (error) throw error;
  if (!data || data.length === 0) return { conflict: true };
  return { conflict: false, version: data[0].version };
}

// Загрузить фото (Blob) в bucket photos под именем name (перезапись).
export async function uploadPhoto(blob, name) {
  const { error } = await supabase.storage
    .from('photos').upload(name, blob, { upsert: true, contentType: 'image/jpeg' });
  if (error) throw error;
  return name;
}

// Публичный URL фото по имени файла.
export function photoUrl(name) {
  return supabase.storage.from('photos').getPublicUrl(name).data.publicUrl;
}

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}
```

- [ ] **Step 2: Verify it imports without crashing**

Run: `npm test`
Expected: existing tests still PASS. `db.js` is not imported by any test (`import.meta.env` is undefined under node), so it must not be imported from pure modules — confirm `db.js` is only imported by browser files (App.jsx, PersonNode.jsx) in later tasks.

- [ ] **Step 3: Commit**

```bash
git add src/db.js
git commit -m "feat: add supabase data/auth/storage client (db.js)

Backend schema (tree table, RLS, photos bucket + policies, shared user) applied in Supabase Dashboard."
```

---

## Task 3: Migration script — data.json + photos → Supabase

**Files:**
- Create: `scripts/migrate-to-supabase.mjs`

This uses the **secret key** (bypasses RLS) and runs once locally with node.

- [ ] **Step 1: Write `scripts/migrate-to-supabase.mjs`**

Create `/Users/apalekseev/familytree/scripts/migrate-to-supabase.mjs`:
```js
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
```

- [ ] **Step 2: Put the real secret key in `.env.local`**

Edit `.env.local`: replace `sb_secret_REPLACE_ME` with the real secret key from Dashboard → Settings → API.

- [ ] **Step 3: Run the migration**

Run:
```bash
set -a; . ./.env; . ./.env.local; set +a; npm run migrate
```
Expected output: `Uploaded tree blob: N persons.`, one `Uploaded photo:` line per file in `public/photos`, then `Migration done.`

- [ ] **Step 4: Verify in Supabase**

Dashboard → Table editor → `tree`: row id=1 `data` contains the persons. Dashboard → Storage → `photos`: files present.

- [ ] **Step 5: Commit (script only — never the secret)**

```bash
git add scripts/migrate-to-supabase.mjs
git commit -m "feat: add one-shot data.json + photos migration to supabase"
```
Verify `git status` shows `.env.local` as ignored (not staged).

---

## Task 4: `card.js` — support absolute photo URLs

**Files:**
- Modify: `src/card.js` (lines 34-36)
- Test: `test/card.test.js` (create if absent; otherwise add a case)

- [ ] **Step 1: Write the failing test**

Create or append to `/Users/apalekseev/familytree/test/card.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderCardHTML } from '../src/card.js';

test('card uses relative path for bare filename', () => {
  const html = renderCardHTML({ id: '1', fio: 'Иван', status: 'alive', photo: '1.jpg' });
  assert.match(html, /src="photos\/1\.jpg"/);
});

test('card uses absolute URL as-is when photo is a full URL', () => {
  const url = 'https://x.supabase.co/storage/v1/object/public/photos/1.jpg';
  const html = renderCardHTML({ id: '1', fio: 'Иван', status: 'alive', photo: url });
  assert.match(html, new RegExp(`src="${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/card.test.js`
Expected: the absolute-URL test FAILS (current code always prefixes `photos/`).

- [ ] **Step 3: Implement the change**

In `/Users/apalekseev/familytree/src/card.js`, replace lines 34-36:
```js
  const photo = p.photo
    ? `<img class="ft-photo" src="photos/${esc(p.photo)}" alt="">`
    : `<div class="ft-photo ft-silh">${silhouette(sex)}</div>`;
```
with:
```js
  const photoSrc = p.photo
    ? (/^https?:\/\//.test(p.photo) ? p.photo : `photos/${p.photo}`)
    : null;
  const photo = photoSrc
    ? `<img class="ft-photo" src="${esc(photoSrc)}" alt="">`
    : `<div class="ft-photo ft-silh">${silhouette(sex)}</div>`;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all PASS (both new card tests + existing suite).

- [ ] **Step 5: Commit**

```bash
git add src/card.js test/card.test.js
git commit -m "feat: card.js renders absolute photo URLs (supabase storage) as-is"
```

---

## Task 5: `PersonNode.jsx` — resolve photo filename to public URL

**Files:**
- Modify: `src/PersonNode.jsx`

- [ ] **Step 1: Edit PersonNode to build the public URL**

Replace the contents of `/Users/apalekseev/familytree/src/PersonNode.jsx` with:
```jsx
import { Handle, Position } from '@xyflow/react';
import { renderCardHTML } from './card.js';
import { photoUrl } from './db.js';

// Кастомная нода React Flow: переиспользует renderCardHTML (HTML карточки)
// + 4 хэндла для связей (top/bottom — родитель/ребёнок, left/right — супруги).
// data.familyColor задаёт акцент «крови рода» через CSS-переменную.
// Имя файла фото превращается в публичный URL Supabase Storage перед рендером.
export default function PersonNode({ data }) {
  const { person, familyColor } = data;
  const display = person.photo ? { ...person, photo: photoUrl(person.photo) } : person;
  return (
    <div className="ft-node" style={{ '--blood': familyColor }}>
      <Handle id="t" type="target" position={Position.Top} />
      <Handle id="l" type="target" position={Position.Left} />
      <div dangerouslySetInnerHTML={{ __html: renderCardHTML(display) }} />
      <Handle id="b" type="source" position={Position.Bottom} />
      <Handle id="r" type="source" position={Position.Right} />
    </div>
  );
}
```

- [ ] **Step 2: Verify tests unaffected**

Run: `npm test`
Expected: PASS (PersonNode.jsx is browser-only, not imported by node tests).

- [ ] **Step 3: Commit**

```bash
git add src/PersonNode.jsx
git commit -m "feat: resolve photo filename to supabase public URL in PersonNode"
```

---

## Task 6: `auth.js` + `App.jsx` — wire load/sign-in/save to Supabase; remove GitHub

**Files:**
- Modify: `src/auth.js`
- Modify: `src/App.jsx`
- Delete: `src/save.js`, `config.js`

- [ ] **Step 1: Replace `src/auth.js` with a session wrapper**

Replace the contents of `/Users/apalekseev/familytree/src/auth.js` with:
```js
import { signIn, signOut, getSession } from './db.js';

// Вход редактора по общему аккаунту (email+пароль). Бросает при ошибке.
export async function login(email, password) { await signIn(email, password); }
export async function logout() { await signOut(); }
// Есть ли активная сессия (т.е. можно редактировать).
export async function isEditor() { return !!(await getSession()); }
```

- [ ] **Step 2: Update imports at top of `App.jsx`**

In `/Users/apalekseev/familytree/src/App.jsx`, replace lines 6-12:
```jsx
import { CONFIG } from '../config.js';
import { decodeData, encodeData, buildGraph } from './data.js';
import { checkPassword } from './auth.js';
import { findRelation } from './kinship.js';
import { resizeImage, blobToBase64 } from './photo.js';
import { buildCommitFiles, commitToGitHub } from './save.js';
import { buildLayout } from './layout.js';
```
with:
```jsx
import { buildGraph } from './data.js';
import { login, isEditor } from './auth.js';
import { findRelation } from './kinship.js';
import { resizeImage } from './photo.js';
import { loadTree, saveTree, uploadPhoto } from './db.js';
import { buildLayout } from './layout.js';
```

- [ ] **Step 3: Add a version state field**

In `App.jsx`, just after `const [newPhotos, setNewPhotos] = useState([]);` (line 34), add:
```jsx
  const [version, setVersion] = useState(1);
```

- [ ] **Step 4: Replace the data-loading effect (lines 37-44)**

Replace:
```jsx
  // первичная загрузка данных
  useEffect(() => {
    const url = import.meta.env.BASE_URL + CONFIG.dataPath + '?_=' + Date.now();
    fetch(url)
      .then(r => (r.ok ? r.text() : ''))
      .then(t => setGraph(buildGraph(decodeData(t.trim()))))
      .catch(() => setGraph(buildGraph({ persons: [] })));
  }, []);
```
with:
```jsx
  // первичная загрузка данных из Supabase
  useEffect(() => {
    loadTree()
      .then(({ data, version }) => { setGraph(buildGraph(data)); setVersion(version); })
      .catch(() => setGraph(buildGraph({ persons: [] })));
  }, []);
```

- [ ] **Step 5: Replace the admin sign-in (lines 76-83)**

Replace:
```jsx
  // ——— админ ———
  const enterAdmin = () => {
    if (admin) return;
    const pw = prompt('Пароль администратора:');
    if (pw == null) return;
    if (checkPassword(pw, CONFIG.passwordB64)) { setAdmin(true); alert('Режим редактирования включён.'); }
    else alert('Неверный пароль.');
  };
```
with:
```jsx
  // ——— вход редактора (общий аккаунт Supabase) ———
  const enterAdmin = async () => {
    if (admin) return;
    if (await isEditor()) { setAdmin(true); return; }
    const email = prompt('Email редактора:');
    if (!email) return;
    const pw = prompt('Пароль:');
    if (pw == null) return;
    try { await login(email, pw); setAdmin(true); alert('Режим редактирования включён.'); }
    catch (e) { alert('Не удалось войти: ' + e.message); }
  };
```

- [ ] **Step 6: Replace `savePerson` photo handling (lines 88-102)**

Replace:
```jsx
  // сохранить правки персоны
  const savePerson = async (id, values, file) => {
    const p = graph.get(id);
    Object.assign(p, values);
    p.birthYear = values.birthYear ? +values.birthYear : null;
    p.deathYear = values.deathYear ? +values.deathYear : null;
    if (file) {
      const blob = await resizeImage(file);
      const name = `${id}.jpg`;
      const base64 = await blobToBase64(blob);
      p.photo = name;
      setNewPhotos(prev => [...prev.filter(x => x.name !== name), { name, base64 }]);
    }
    setModal(null);
    syncGraph();
  };
```
with:
```jsx
  // сохранить правки персоны (фото грузится в Storage сразу)
  const savePerson = async (id, values, file) => {
    const p = graph.get(id);
    Object.assign(p, values);
    p.birthYear = values.birthYear ? +values.birthYear : null;
    p.deathYear = values.deathYear ? +values.deathYear : null;
    if (file) {
      const blob = await resizeImage(file);
      const name = `${id}.jpg`;
      await uploadPhoto(blob, name);
      p.photo = name;
    }
    setModal(null);
    syncGraph();
  };
```

- [ ] **Step 7: Remove the now-unused `newPhotos` state (line 34)**

Delete the line `const [newPhotos, setNewPhotos] = useState([]);` from `App.jsx` (no longer referenced after Step 6).

- [ ] **Step 8: Replace `doSave` (lines 118-130) with Supabase save + version lock**

Replace:
```jsx
  const doSave = async () => {
    const token = prompt('GitHub токен (repo scope). Не сохраняется:');
    if (!token) return;
    try {
      const raw = { persons: [...graph.values()] };
      const files = buildCommitFiles(encodeData(raw), newPhotos, CONFIG);
      await commitToGitHub(token, CONFIG, files, 'Update family data');
      setNewPhotos([]);
      alert('Сохранено в GitHub. Pages обновится через минуту.');
    } catch (e) {
      alert('Ошибка сохранения: ' + e.message);
    }
  };
```
with:
```jsx
  const doSave = async () => {
    try {
      const raw = { persons: [...graph.values()] };
      const res = await saveTree(raw, version);
      if (res.conflict) {
        alert('Древо изменилось в другом месте. Обнови страницу, затем повтори правки.');
        return;
      }
      setVersion(res.version);
      alert('Сохранено.');
    } catch (e) {
      alert('Ошибка сохранения: ' + e.message);
    }
  };
```

- [ ] **Step 9: Delete the obsolete files**

Run:
```bash
git rm src/save.js config.js
```
(If git complains they are untracked, just delete: `rm src/save.js config.js`.)

- [ ] **Step 10: Check for stray references**

Run: `npm run build`
Expected: build SUCCEEDS with no "not exported" / "cannot resolve './config.js'" / "./save.js" errors. Fix any remaining import of `config.js`, `save.js`, `encodeData`, `decodeData`, `blobToBase64`, `checkPassword`, or `newPhotos` if the build reports them.

- [ ] **Step 11: Run unit tests**

Run: `npm test`
Expected: PASS (pure modules unchanged; `save.js`/`config.js` were not under test).

- [ ] **Step 12: Commit**

```bash
git add src/auth.js src/App.jsx
git commit -m "feat: load/save tree via supabase, sign-in editor, drop github save"
```

---

## Task 7: Manual verification against cloud Supabase

**Files:** none (acceptance testing). This is the real test of the integration code.

- [ ] **Step 1: Start dev server**

Run: `npm run dev`
Open `http://localhost:5173`.

- [ ] **Step 2: Verify anonymous read**

Without signing in: the tree renders with persons loaded from Supabase (not from `public/data.json`). Photos display (served from Storage public URLs). Kinship calculator ("Кто кому кем") still works.

- [ ] **Step 3: Verify anonymous cannot write**

Open the browser devtools network tab. As an anonymous user there is no "Сохранить" button (admin not entered). Confirm no write path is reachable without sign-in.

- [ ] **Step 4: Verify editor sign-in**

Click "Редактировать", enter the shared editor email + password. Editing mode turns on (no error).

- [ ] **Step 5: Verify person edit + save**

Open a person, change a field (e.g. bio), save in the modal, then click "Сохранить". Expect "Сохранено." Reload the page → the change persists (came back from Supabase).

- [ ] **Step 6: Verify photo upload**

Edit a person, attach a photo, save. The image appears on the card. In Dashboard → Storage → `photos`, the file `<id>.jpg` exists. Reload → photo still shows.

- [ ] **Step 7: Verify version lock**

Open the app in two tabs, both signed in. In tab A save an edit (version advances). In tab B (still on the old version) make an edit and save → expect the "Древо изменилось..." alert and NO overwrite. Reload tab B, redo, save → succeeds.

- [ ] **Step 8: Final commit (if any verification fixes were needed)**

If Steps 2-7 required code fixes, commit them:
```bash
git add -A
git commit -m "fix: address issues found during supabase migration verification"
```
If no fixes were needed, no commit.

---

## Self-Review (completed by plan author)

- **Spec coverage:** source-of-truth blob (Task 1,3,6), shared-account auth + RLS (Task 1,6), photos in Storage (Task 1,3,5,6), version lock (Task 2,6), migration of data.json + photos (Task 3), secrets handling (Task 0,3), local cloud testing (Task 7), pure modules untouched/green (every task runs `npm test`). All spec sections map to a task.
- **Photo URL wrinkle** (card builds `photos/<file>`): resolved in Task 4 (card absolute-URL support) + Task 5 (PersonNode builds public URL). card.js stays pure → node tests intact.
- **No placeholders:** all steps contain exact paths, code, commands, expected output.
- **Type/name consistency:** `loadTree`→`{data,version}`, `saveTree(data,version)`→`{conflict}|{conflict,version}`, `uploadPhoto(blob,name)`, `photoUrl(name)`, `login/logout/isEditor` — used identically across Tasks 2/5/6.
- **Security:** `auth.role()` avoided (uses `TO authenticated` + `WITH CHECK`); secret key only in gitignored `.env.local` and migration script; publishable key in client; `ref.md` gitignored.
