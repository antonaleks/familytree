# MVP: переезд хранилища на Supabase

Дата: 2026-05-31
Статус: утверждён, готов к плану реализации

## Цель

Перенести хранилище данных семейного древа с base64-JSON в git-репозитории на
Supabase, чтобы члены семьи могли редактировать древо через общий пароль (а не
вводя GitHub-токен вручную). Фронт остаётся статикой на GitHub Pages. Просмотр —
анонимный для всех; редактирование — после входа.

Объём строго ограничен переездом хранилища. Текущие UI, раскладка (`layout-core.js`)
и расчёт родства (`kinship.js`) не меняются. Новые view-фичи из референса —
следующие итерации, вне этого MVP.

## Зафиксированные решения

- **Источник правды:** Supabase Postgres (не git, не гибрид).
- **Форма данных:** один jsonb-блоб `{persons:[...]}` в одной строке таблицы (Подход 2),
  зеркало текущего `data.json`. Конкурентного редактирования практически не будет
  (фактически правит один человек), поэтому per-person строки не нужны. Защита от
  затирания — поле `version` (оптимистичный лок).
- **Доступ:** один общий Supabase-аккаунт (email+пароль), раздаётся семье. RLS:
  anon = чтение, authenticated = запись. Ролей (владелец/редактор/зритель) в MVP нет.
- **Фото:** Supabase Storage, public bucket. Клиентский ресайз остаётся (`photo.js`).
- **Локальная разработка:** `vite dev` ходит напрямую в cloud-проект Supabase
  (без Docker / supabase local).

## Архитектура

```
GitHub Pages (React+Vite, статика, base './')
   │  supabase-js (Project URL + anon key)
   ▼
Supabase cloud
   ├─ Postgres: table `tree` (один блоб {persons:[...]} + version)
   ├─ Auth: один общий аккаунт (email+пароль)
   └─ Storage: bucket `photos` (public read, auth write)
```

**Поток чтения (анонимно, все):** `select data from tree where id=1` → объект
`{persons:[...]}` (jsonb уже разобран, `decodeData` не нужен) → существующий
`buildGraph` → layout / kinship без изменений.

**Поток правки (семья):** вход через общий Supabase-аккаунт →
`supabase.auth.signInWithPassword` → сессия → RLS пускает `update` строки `tree`.

## Схема БД

```sql
create table public.tree (
  id         int primary key default 1,
  data       jsonb not null default '{"persons":[]}',
  version    int   not null default 1,
  updated_at timestamptz default now()
);
-- единственная строка id=1 (создаётся миграцией под secret-ключом)

alter table public.tree enable row level security;

-- чтение всем (anon + authenticated)
create policy "tree_read_all" on public.tree
  for select to anon, authenticated using (true);

-- запись только вошедшим; UPDATE требует и USING, и WITH CHECK
create policy "tree_update_auth" on public.tree
  for update to authenticated using (true) with check (true);
```

**Заметки по безопасности (из supabase skill):**
- НЕ использовать `auth.role() = 'authenticated'` — устарел и ломается при anonymous
  sign-ins. Использовать клаузу `TO authenticated`.
- UPDATE в RLS сперва делает SELECT строки — без SELECT-политики `update` молча
  возвращает 0 строк. Политика `tree_read_all` это покрывает.
- INSERT-политики для клиента нет: строка id=1 пред-создаётся миграцией под
  secret-ключом (минует RLS). `saveTree` делает только UPDATE существующей строки.
- Anonymous sign-ins держать выключенными (default).
- Проверить Data API exposure: новые таблицы в `public` могут быть не выставлены
  автоматически — при недоступности явно `grant` ролям `anon`/`authenticated`.

`version` — оптимистичный лок: `saveTree` пишет
`update tree set data=?, version=version+1, updated_at=now() where id=1 and version=<прочитанный>`.
Если затронуто 0 строк → версия разошлась → UI показывает «древо изменилось,
обнови страницу», save не затирает чужие правки.

## Storage

- Bucket `photos`, **public** (public read через CDN-URL).
- Имя файла = `${id}.jpg` (как сейчас); `photo.js` ресайзит перед загрузкой.
- В `person.photo` хранится **имя файла** (как сейчас); публичный URL собирается во
  фронте через `supabase.storage.from('photos').getPublicUrl(name)`. Сохраняет
  совместимость с текущим форматом данных.
- **Upsert фото требует INSERT+SELECT+UPDATE-политик** (один человек правится →
  файл `${id}.jpg` перезаливается). Bucket public покрывает SELECT; добавить
  INSERT и UPDATE для `authenticated`:

```sql
create policy "photos_insert_auth" on storage.objects
  for insert to authenticated with check (bucket_id = 'photos');
create policy "photos_update_auth" on storage.objects
  for update to authenticated using (bucket_id = 'photos') with check (bucket_id = 'photos');
```

## Изменения во фронте

- **`src/db.js`** (новый): создаёт supabase-клиент из `import.meta.env`; экспортирует
  `loadTree()`, `saveTree(data, version)`, `uploadPhoto(file)`,
  `signIn(email, password)`, `signOut()`, `getSession()`.
- **`src/App.jsx`**: грузит дерево через `db.loadTree()` вместо
  `fetch(import.meta.env.BASE_URL + 'data.json')`.
- **`src/auth.js`**: вместо base64-пароля — обёртка над supabase-сессией
  (вошёл = может править).
- **`src/save.js`** (GitHub Contents API): удаляется, заменяется `db.saveTree`.
- **`src/photo.js`**: ресайз остаётся; добавляется загрузка в Storage (`uploadPhoto`).
- **`PersonModal`**: «Сохранить» вызывает `db.saveTree(data, version)`.

`config.js` с `repo`/`passwordB64`/GitHub-токеном больше не нужен для записи —
убирается или сводится к ненужному.

## Миграция данных

- Скрипт `scripts/migrate-to-supabase.mjs`: читает `public/data.json` →
  `decodeData` → `upsert` строки `tree` (id=1, data=объект, version=1). Запуск
  разовый, локально, с **secret-ключом** (`sb_secret_...`, минует RLS; из env, НЕ в git).
- Фото: залить существующие `public/photos/*` в bucket `photos` (тем же скриптом
  или вручную через Dashboard).

## Секреты и конфиг

- **В клиент (безопасно, можно коммитить):** Project URL + **publishable** key
  (`sb_publishable_...`, новый формат вместо legacy anon). Кладутся в `.env`:
  - `VITE_SUPABASE_URL=https://sdrgxqbczezsbxwtnifz.supabase.co`
  - `VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...`
  Читаются через `import.meta.env`. Publishable-ключ защищается через RLS — это его
  штатное место, безопасно в публичном бандле.
- **Только локально, в `.gitignore`:** **secret-ключ** (`sb_secret_...`), DB-пароль,
  `ref.md`. Хранить в `.env.local` (Vite не включает его в коммит по конвенции, но
  всё равно гитигнорим явно).
- Завести `.gitignore`: `ref.md`, `.env.local`, `node_modules`, `dist`.
- **Важно по безопасности:** secret-ключ и DB-пароль НИКОГДА не попадают в
  клиентский бандл и не коммитятся. Репозиторий публичный. Пинить версии npm-пакетов
  и коммитить lockfile.

## Тестирование и проверка

- Чистые модули (`layout-core.js`, `kinship.js`, `data.js`) — `node --test test/`
  как есть, формат данных не меняется, тесты не трогаем.
- `db.js` тонкий и сетевой → проверяется вручную против cloud Supabase.
- **Чек-лист ручной проверки (`vite dev` → cloud):**
  1. Дерево грузится из Supabase (не из data.json).
  2. Вход по общему email+паролю работает.
  3. Правка персоны сохраняется; reload показывает изменение.
  4. Загрузка фото попадает в Storage и отображается.
  5. Аноним (без входа) видит дерево, но не может сохранить (RLS отклоняет).
  6. `version`-лок: при расхождении версий save не затирает, показывает предупреждение.

## Вне объёма (следующие итерации)

- View-фичи рефа: настройки вида древа, поиск+счётчики, выбор корня, лента дат,
  раздельные ФИО/склонение, несколько фото, события-таймлайн.
- Роли доступа (владелец/редактор/зритель), инвайты по magic-link.
- GitHub Actions деплой на Pages.

## Заметки

- Проект сейчас НЕ git-репозиторий (`git` не инициализирован). План включает
  `git init` первой задачей (frequent commits по ходу плана).
- **Ключи получены:** URL `https://sdrgxqbczezsbxwtnifz.supabase.co`, publishable
  `sb_publishable_G7mHfkdgtJxq0X92TUGDKQ_qYQdIOR_`. DB-строка
  `postgresql://postgres:[PASSWORD]@db.sdrgxqbczezsbxwtnifz.supabase.co:5432/postgres`
  (пароль — секрет, для миграции). Secret-ключ `sb_secret_...` взять в Dashboard →
  Settings → API при миграции.
- supabase agent-skills установлен (`.agents/skills/supabase`) — следовать его
  security-checklist при работе с RLS/Storage/Auth.
- Стек — Vite SPA, `@supabase/ssr` НЕ нужен (только `@supabase/supabase-js`).
