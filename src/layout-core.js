// Чистая логика конвертации графа в данные для relatives-tree / React Flow.
// БЕЗ импорта relatives-tree и @xyflow — чтобы модуль грузился в node-тестах
// (relatives-tree — ESM-only пакет, в голом node не подхватывается).

// Размер ноды-карточки (px). relatives-tree отдаёт top/left в полу-юнитах,
// поэтому пиксель = координата * (размер/2) — конвенция react-family-tree.
export const NODE_W = 240; // карточка 200 + зазор
export const NODE_H = 400; // карточка ~330 + зазор под мета/связи

export const GOLD = '#d4af6a';
// палитра «кровь рода»: каждому патрилинейному корню — свой цвет-акцент
const PALETTE = ['#d4af6a', '#7a9e6b', '#6b8ca3', '#a36b8c', '#a3886b',
  '#8c6ba3', '#6ba39a', '#a36b6b', '#9a8c6b', '#6b6ba3'];

function isMale(p) { return !p || p.sex !== 'f'; }

// родитель-отец = parent с полом m (для патрилинейной «крови рода»)
function fatherOf(graph, id) {
  const p = graph.get(id);
  if (!p) return null;
  for (const par of p.parents) {
    const parent = graph.get(par);
    if (parent && isMale(parent)) return par;
  }
  return null;
}

// siblings: люди с общим родителем (relatives-tree хочет явный список)
function computeSiblings(graph) {
  const out = new Map();
  for (const p of graph.values()) {
    const set = new Set();
    for (const par of p.parents) {
      const parent = graph.get(par);
      if (!parent) continue;
      for (const c of parent.children) if (c !== p.id && graph.has(c)) set.add(c);
    }
    out.set(p.id, [...set]);
  }
  return out;
}

export function toRelNodes(graph) {
  const sib = computeSiblings(graph);
  const rel = (id, type) => ({ id, type });
  const keep = id => graph.has(id);
  const out = [];
  for (const p of graph.values()) {
    out.push({
      id: p.id,
      gender: p.sex === 'f' ? 'female' : 'male',
      parents: p.parents.filter(keep).map(id => rel(id, 'blood')),
      children: p.children.filter(keep).map(id => rel(id, 'blood')),
      siblings: (sib.get(p.id) || []).map(id => rel(id, 'blood')),
      spouses: p.spouses.filter(keep).map(id => rel(id, 'married'))
    });
  }
  return out;
}

// для каждого id — id верхнего патрилинейного предка (= «род»)
export function computeBloodFamily(graph) {
  const fam = new Map();
  for (const id of graph.keys()) {
    let cur = id, guard = 0;
    while (guard++ < 1000) {
      const f = fatherOf(graph, cur);
      if (!f) break;
      cur = f;
    }
    fam.set(id, cur);
  }
  return fam;
}

export function familyColors(fam) {
  const roots = [...new Set(fam.values())];
  const map = new Map();
  roots.forEach((r, i) => map.set(r, PALETTE[i % PALETTE.length]));
  return map;
}

export function buildEdges(graph) {
  const edges = [];
  const seenSpouse = new Set();
  for (const p of graph.values()) {
    for (const c of p.children) {
      if (!graph.has(c)) continue;
      edges.push({
        id: `e-${p.id}-${c}`,
        source: p.id, target: c,
        sourceHandle: 'b', targetHandle: 't',
        type: 'smoothstep',
        // строка вместо MarkerType.ArrowClosed — чтобы не тянуть @xyflow в node-тесты
        markerEnd: { type: 'arrowclosed', color: GOLD, width: 22, height: 22 },
        style: { stroke: GOLD, strokeWidth: 2.5 }
      });
    }
    for (const s of p.spouses) {
      if (!graph.has(s)) continue;
      const key = [p.id, s].sort().join('|');
      if (seenSpouse.has(key)) continue;
      seenSpouse.add(key);
      edges.push({
        id: `s-${key}`,
        source: p.id, target: s,
        sourceHandle: 'r', targetHandle: 'l',
        type: 'straight',
        label: '♥',
        labelStyle: { fill: GOLD, fontSize: 18 },
        labelBgStyle: { fill: 'transparent' },
        style: { stroke: GOLD, strokeWidth: 1.5, strokeDasharray: '4 3' }
      });
    }
  }
  return edges;
}

function countDescendants(graph, id, seen = new Set()) {
  let n = 0;
  for (const c of (graph.get(id)?.children || [])) {
    if (seen.has(c) || !graph.has(c)) continue;
    seen.add(c);
    n += 1 + countDescendants(graph, c, seen);
  }
  return n;
}

// корень для подмножества ids: предок без родителей с макс. числом потомков
export function pickRootIn(graph, ids) {
  const set = ids instanceof Set ? ids : new Set(ids);
  let best = null, bestCount = -1;
  for (const id of set) {
    const p = graph.get(id);
    if (!p) continue;
    if (p.parents.some(pid => set.has(pid))) continue; // есть родитель внутри компоненты
    const count = countDescendants(graph, id);
    if (count > bestCount) { bestCount = count; best = id; }
  }
  return best || set.values().next().value;
}

export function pickRoot(graph) {
  return pickRootIn(graph, new Set(graph.keys()));
}

// Зазоры раскладки (в слотах NODE_W / строках NODE_H).
const ROW = NODE_H;       // высота поколения (карточка ~330 + зазор)
const SLOT = NODE_W;      // ширина слота (карточка 200 + зазор 40)

// Поколение каждого человека = длиннейший путь от основателя (Sugiyama-слой).
// Супруги выравниваются в один слой (max), затем перечитываем — несколько
// проходов до сходимости (поколения только растут, сходится за ≤ N проходов).
export function computeGenerations(graph) {
  const ids = [...graph.keys()];
  const gen = new Map(ids.map(id => [id, 0]));
  for (let pass = 0; pass <= ids.length; pass++) {
    let changed = false;
    for (const id of ids) {
      let g = 0;
      for (const par of graph.get(id).parents) {
        if (graph.has(par)) g = Math.max(g, gen.get(par) + 1);
      }
      if (g > gen.get(id)) { gen.set(id, g); changed = true; }
    }
    for (const id of ids) {
      for (const s of graph.get(id).spouses) {
        if (!graph.has(s)) continue;
        const m = Math.max(gen.get(id), gen.get(s));
        if (gen.get(id) !== m) { gen.set(id, m); changed = true; }
        if (gen.get(s) !== m) { gen.set(s, m); changed = true; }
      }
    }
    if (!changed) break;
  }
  return gen;
}

// Порядок узлов внутри слоёв: DFS-preorder по семейному лесу, супруг ставится
// сразу за партнёром → семьи кучкуются, пары рядом. Корни (основатели без
// родителей) обходятся в порядке убывания числа потомков.
function dfsOrder(graph) {
  const seen = new Set();
  const seq = [];
  const visit = (id) => {
    if (seen.has(id)) return;
    seen.add(id); seq.push(id);
    const p = graph.get(id);
    if (!p) return;
    for (const s of p.spouses) {
      if (graph.has(s) && !seen.has(s)) { seen.add(s); seq.push(s); }
    }
    const kids = new Set(p.children);
    for (const s of p.spouses) {
      const sp = graph.get(s);
      if (sp) for (const c of sp.children) kids.add(c);
    }
    for (const c of kids) if (graph.has(c)) visit(c);
  };
  const founders = [...graph.keys()]
    .filter(id => !graph.get(id).parents.some(p => graph.has(p)))
    .sort((a, b) => countDescendants(graph, b) - countDescendants(graph, a));
  for (const r of founders) visit(r);
  for (const id of graph.keys()) visit(id); // подхватить изолированные/циклы
  return seq;
}

// Sugiyama-lite раскладка: слои = поколения, порядок внутри слоя = DFS-preorder.
// Узлы пакуются по слотам слева-направо → карточки НЕ налезают (каждой свой
// слот, строки разнесены по Y). Пара муж/жена — один юнит = соседние слоты.
// Несвязанные браком роды просто идут дальше по X в том же ряду. Длинные линии
// между поколениями/родами допустимы.
export function buildLayout(graph) {
  const fam = computeBloodFamily(graph);
  const colorOf = familyColors(fam);
  const gen = computeGenerations(graph);
  const seq = dfsOrder(graph);

  // юниты (пара или одиночка) в порядке seq
  const unitOf = new Map();
  const units = [];
  for (const id of seq) {
    if (unitOf.has(id)) continue;
    const spouse = graph.get(id).spouses.find(s => graph.has(s) && !unitOf.has(s));
    const members = spouse ? [id, spouse] : [id];
    const u = { members, idx: units.length };
    for (const m of members) unitOf.set(m, u);
    units.push(u);
  }

  // раскидать юниты по слоям (поколениям)
  const byGen = new Map();
  for (const u of units) {
    const g = gen.get(u.members[0]);
    if (!byGen.has(g)) byGen.set(g, []);
    byGen.get(g).push(u);
  }

  const nodes = [];
  for (const [g, us] of [...byGen.entries()].sort((a, b) => a[0] - b[0])) {
    us.sort((a, b) => a.idx - b.idx);
    let slot = 0;
    for (const u of us) {
      for (const m of u.members) {
        nodes.push({
          id: m, type: 'person',
          position: { x: slot * SLOT, y: g * ROW },
          data: { person: graph.get(m), familyColor: colorOf.get(fam.get(m)) || GOLD }
        });
        slot++;
      }
      slot++; // зазор между юнитами
    }
  }
  return { nodes, edges: buildEdges(graph) };
}

// Кластеры по патрилинейному роду. Человек приписывается к корню рода своего
// отца; «вошедший по браку» супруг (без родителей в графе) — к кластеру супруга.
// Так лес из нескольких родов-основателей, сшитый браками, делится на отдельные
// поддеревья, каждое из которых relatives-tree может разложить от одного корня.
export function computeClusters(graph) {
  const memo = new Map();
  const resolve = (id, stack) => {
    if (memo.has(id)) return memo.get(id);
    if (stack.has(id)) return id; // защита от цикла (супруги ссылаются друг на друга)
    stack.add(id);
    const p = graph.get(id);
    let root = id;
    if (p) {
      const father = p.parents.find(pid => { const g = graph.get(pid); return g && isMale(g); });
      const anyParent = p.parents.find(pid => graph.has(pid));
      const spouse = p.spouses.find(sid => graph.has(sid));
      if (father) root = resolve(father, stack);
      else if (anyParent) root = resolve(anyParent, stack);
      else if (spouse) root = resolve(spouse, stack);
    }
    memo.set(id, root);
    return root;
  };
  const clusters = new Map();
  for (const id of graph.keys()) {
    const r = resolve(id, new Set());
    if (!clusters.has(r)) clusters.set(r, []);
    clusters.get(r).push(id);
  }
  return clusters;
}

// связные компоненты по любым связям (parents/children/spouses).
// Острова семей (без брачной связи с основным деревом) → отдельные компоненты.
export function connectedComponents(graph) {
  const seen = new Set();
  const comps = [];
  for (const start of graph.keys()) {
    if (seen.has(start)) continue;
    const comp = [];
    const stack = [start];
    seen.add(start);
    while (stack.length) {
      const id = stack.pop();
      comp.push(id);
      const p = graph.get(id);
      if (!p) continue;
      for (const nid of [...p.parents, ...p.children, ...p.spouses]) {
        if (graph.has(nid) && !seen.has(nid)) { seen.add(nid); stack.push(nid); }
      }
    }
    comps.push(comp);
  }
  // крупнейшая компонента первой (основное дерево слева)
  comps.sort((a, b) => b.length - a.length);
  return comps;
}
