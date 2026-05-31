// «От кого строить древо»: фильтрация графа до патрилинейного рода фокус-персоны
// + инкрементальное раскрытие скрытых предков (вверх). Чистый модуль (node-тесты).
import { computeBloodFamily } from './layout-core.js';

// общие дети пары a×b (присутствующие в графе)
export function coupleChildren(graph, a, b) {
  const A = graph.get(a);
  if (!A) return [];
  return A.children.filter(c => {
    const cp = graph.get(c);
    return cp && graph.has(c) && cp.parents.includes(b);
  });
}

// Видимые id при заданном фокусе.
//  - focusId == null → весь граф (фокуса нет).
//  - иначе: патрилинейный род фокуса (общий верхний предок-отец) + их супруги
//    («вошедшие по браку»), плюс раскрытые предки (вверх) и ветви (вниз).
// expanded — Set id, у которых раскрыты родители (по шагу вверх).
// expandedDown — Set ключей пар 'a|b', у которых раскрыты дети (по шагу вниз).
export function visibleIds(graph, focusId, expanded = new Set(), expandedDown = new Set()) {
  if (!focusId || !graph.has(focusId)) return new Set(graph.keys());
  const fam = computeBloodFamily(graph);
  const root = fam.get(focusId);
  const visible = new Set();
  for (const [id, r] of fam) if (r === root) visible.add(id);
  // супруги членов рода — чтобы пары рисовались (их предки скрыты до раскрытия)
  for (const id of [...visible]) {
    for (const s of graph.get(id).spouses) if (graph.has(s)) visible.add(s);
  }
  // раскрытие — фикспойнт по обоим направлениям (Q4=B: без боковых ветвей).
  // вверх: раскрытый узел показывает родителей + их супругов (для пары).
  // вниз: раскрытая пара показывает общих детей + их супругов (для пары).
  let added = true;
  while (added) {
    added = false;
    const mark = id => {
      if (graph.has(id) && !visible.has(id)) { visible.add(id); added = true; }
    };
    for (const id of expanded) {
      if (!visible.has(id)) continue;
      for (const par of graph.get(id).parents) {
        if (!graph.has(par)) continue;
        mark(par);
        for (const s of graph.get(par).spouses) mark(s);
      }
    }
    for (const key of expandedDown) {
      const [a, b] = key.split('|');
      if (!visible.has(a) || !visible.has(b)) continue;
      for (const c of coupleChildren(graph, a, b)) {
        mark(c);
        for (const s of graph.get(c).spouses) mark(s);
      }
    }
  }
  return visible;
}

// Видимые узлы, у которых есть скрытые родители → им показываем «раскрыть вверх».
export function expandableIds(graph, visible) {
  const out = new Set();
  for (const id of visible) {
    for (const par of graph.get(id).parents) {
      if (graph.has(par) && !visible.has(par)) { out.add(id); break; }
    }
  }
  return out;
}

// Ключи видимых пар 'a|b', у которых есть скрытые общие дети → «раскрыть вниз».
export function downExpandableKeys(graph, visible) {
  const out = new Set();
  const seen = new Set();
  for (const id of visible) {
    for (const s of graph.get(id).spouses) {
      if (!visible.has(s)) continue;
      const key = [id, s].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      const [a, b] = key.split('|');
      if (coupleChildren(graph, a, b).some(c => !visible.has(c))) out.add(key);
    }
  }
  return out;
}

// Подграф из видимых id (значения — те же person-объекты; buildLayout режет связи
// к скрытым через graph.has, исходный граф не мутируется).
export function filterGraph(graph, visible) {
  const m = new Map();
  for (const id of visible) if (graph.has(id)) m.set(id, graph.get(id));
  return m;
}
