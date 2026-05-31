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
  const cousinDeg = Math.min(dA, dB) - 1;       // 1=двоюродный, 2=троюродный...
  const removed = Math.abs(dA - dB);
  const ord = ['', 'двоюродный', 'троюродный', 'четвероюродный', 'пятиюродный'];
  const ordF = ['', 'двоюродная', 'троюродная', 'четвероюродная', 'пятиюродная'];
  const deg = ord[cousinDeg] || (cousinDeg + 1) + '-юродный';
  const degF = ordF[cousinDeg] || (cousinDeg + 1) + '-юродная';
  if (removed === 0) return bySex(B, deg + ' брат', degF + ' сестра');
  // removed: ниже по поколению у A => дядя/тётя; у B => племянник
  if (dA > dB) return bySex(B, deg + ' дядя', degF + ' тётя');
  return bySex(B, deg + ' племянник', degF + ' племянница');
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
  const A = graph.get(a), B = graph.get(b);
  if (!A || !B) return { term: 'родство не найдено' };

  // 1) прямой супруг
  if (A.spouses.includes(b)) return withMeta(bySex(B, 'муж', 'жена'));

  // 2) кровное
  const lca = findLCA(graph, a, b);
  if (lca) return withMeta(bloodTerm(graph, a, b, lca.dA, lca.dB));

  // 3) свойство: B — кровный родственник супруги(а) A
  for (const sp of A.spouses) {
    const r = bloodTermBetween(graph, sp, b);
    const t = affinityFromSpouseRel(r, B, A);
    if (t) return withMeta(t);
  }
  // 4) свойство: B — супруг кровного родственника A
  for (const r of A.children.concat(siblings(graph, a))) {
    if (graph.get(r) && graph.get(r).spouses.includes(b)) {
      const base = bloodTermBetween(graph, a, r);
      const t = affinityFromRelSpouse(base, B);
      if (t) return withMeta(t);
    }
  }
  return { term: 'родство не найдено' };
}

function siblings(graph, id) {
  const p = graph.get(id); const res = [];
  for (const par of p.parents) for (const c of (graph.get(par)?.children||[]))
    if (c !== id && !res.includes(c)) res.push(c);
  return res;
}
function bloodTermBetween(graph, a, b) {
  const lca = findLCA(graph, a, b);
  return lca ? bloodTerm(graph, a, b, lca.dA, lca.dB) : null;
}
// B — кровный родственник супруга A. r = кем B приходится супругу.
function affinityFromSpouseRel(r, B, A) {
  const meFemale = A.sex === 'f';
  if (r === 'отец') return meFemale ? 'свёкор' : 'тесть';
  if (r === 'мать') return meFemale ? 'свекровь' : 'тёща';
  if (r === 'брат') return meFemale ? 'деверь' : 'шурин';
  if (r === 'сестра') return meFemale ? 'золовка' : 'свояченица';
  return null;
}
// base — кем родственник r приходится A; B = супруг r.
function affinityFromRelSpouse(base, B) {
  if (base === 'сын') return 'невестка';   // жена сына
  if (base === 'дочь') return 'зять';       // муж дочери
  if (base === 'сестра') return B.sex === 'm' ? 'зять' : null;
  if (base === 'брат') return B.sex === 'f' ? 'невестка' : null;
  return null;
}
