import { TERMS, COMPLEX } from './terms.js';

// Карта предок->дистанция (включая саму персону на 0) через parents.
function ancestorDist(graph, id) {
  const dist = new Map();
  const q = [[id, 0]];
  while (q.length) {
    const [cur, d] = q.shift();
    if (dist.has(cur) && dist.get(cur) <= d) continue;
    dist.set(cur, d);
    const p = graph.get(cur);
    if (p) for (const par of p.parents) q.push([par, d + 1]);
  }
  return dist;
}

// Ближайший общий предок: минимизируем dA+dB.
function findLCA(graph, a, b) {
  const da = ancestorDist(graph, a);
  const db = ancestorDist(graph, b);
  let best = null;
  for (const [anc, d1] of da) {
    if (db.has(anc)) {
      const sum = d1 + db.get(anc);
      if (!best || sum < best.sum) best = { anc, dA: d1, dB: db.get(anc), sum };
    }
  }
  return best;
}

function bySex(p, m, f) { return p && p.sex === 'f' ? f : m; }

// Термин для кровного родства по (dA,dB) — отношение B к A.
function bloodTerm(graph, a, b, dA, dB) {
  const B = graph.get(b);
  if (dA === 0 && dB === 0) return null; // один человек
  if (dA === 1 && dB === 0) return bySex(B, 'отец', 'мать');
  if (dA === 0 && dB === 1) return bySex(B, 'сын', 'дочь');
  if (dA === 2 && dB === 0) return bySex(B, 'дед', 'бабушка');
  if (dA === 0 && dB === 2) return bySex(B, 'внук', 'внучка');
  if (dA === 1 && dB === 1) return bySex(B, 'брат', 'сестра');
  if (dA === 2 && dB === 1) return bySex(B, 'дядя', 'тётя');
  if (dA === 1 && dB === 2) return bySex(B, 'племянник', 'племянница');
  if (dA === 2 && dB === 2) return bySex(B, 'двоюродный брат', 'двоюродная сестра');
  // дальше — обобщённо «родственник» (детализацию N-юродных добавим в Task 6)
  return 'родственник';
}

function withMeta(term) {
  if (!term) return { term: 'не определено' };
  const t = TERMS[term];
  const out = { term };
  if (t && COMPLEX.has(term)) { out.def = t.def; out.src = t.src; }
  return out;
}

export function findRelation(graph, a, b) {
  if (a === b) return { term: 'это один человек' };
  const lca = findLCA(graph, a, b);
  if (lca) return withMeta(bloodTerm(graph, a, b, lca.dA, lca.dB));
  return { term: 'родство не найдено' };
}
