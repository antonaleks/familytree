function bytesToB64(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function encodeData(obj) {
  const json = JSON.stringify(obj);
  return bytesToB64(new TextEncoder().encode(json));
}

export function decodeData(b64) {
  if (!b64) return { persons: [] };
  try {
    const json = new TextDecoder().decode(b64ToBytes(b64));
    const obj = JSON.parse(json);
    if (!obj || !Array.isArray(obj.persons)) return { persons: [] };
    return obj;
  } catch {
    return { persons: [] };
  }
}

// мужские имена/уменьшительные, оканчивающиеся на -а/-я (исключения из «ж.»)
const MALE_A = new Set([
  'вася','ваня','миша','витя','юра','рома','дима','даня','паша','гриша',
  'коля','толя','петя','гена','вова','серёжа','сережа','никита','илья',
  'фома','данила','кузьма','савва','лука','лёша','леша','саша','лёва','лева',
  'жора','боря','стёпа','степа','кеша','тёма','тема','сёма','сема','гоша'
]);
// явно женские имена, НЕ оканчивающиеся на -а/-я
const FEMALE_OTHER = new Set(['любовь','нинель','эстер','рахиль','адель','нинэль']);

// угадать пол по ФИО (первое слово = имя)
export function guessSex(fio) {
  const name = String(fio || '').trim().split(/\s+/)[0].toLowerCase();
  if (!name) return 'm';
  if (FEMALE_OTHER.has(name)) return 'f';
  if (MALE_A.has(name)) return 'm';
  if (/[ая]$/.test(name)) return 'f';
  return 'm';
}

export function buildGraph(data) {
  const g = new Map();
  for (const raw of data.persons) {
    g.set(raw.id, {
      ...raw,
      sex: raw.sex || guessSex(raw.fio),
      parents: [...(raw.parents || [])],
      spouses: [...(raw.spouses || [])],
      children: [...(raw.children || [])]
    });
  }
  const link = (arr, id) => { if (id && !arr.includes(id)) arr.push(id); };
  for (const p of g.values()) {
    for (const cid of p.children) { const c = g.get(cid); if (c) link(c.parents, p.id); }
    for (const pid of p.parents) { const par = g.get(pid); if (par) link(par.children, p.id); }
    for (const sid of p.spouses) { const s = g.get(sid); if (s) link(s.spouses, p.id); }
  }
  return g;
}
