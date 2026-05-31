// «От кого строить древо»: фильтрация графа до патрилинейного рода фокус-персоны
// + инкрементальное раскрытие скрытых предков (вверх). Чистый модуль (node-тесты).
import { computeBloodFamily } from './layout-core.js';

// Видимые id при заданном фокусе.
//  - focusId == null → весь граф (фокуса нет).
//  - иначе: патрилинейный род фокуса (общий верхний предок-отец) + их супруги
//    («вошедшие по браку»), плюс предки тех узлов, что пользователь раскрыл.
// expanded — Set id, у которых раскрыты родители (Q3=B: по шагу вверх).
export function visibleIds(graph, focusId, expanded = new Set()) {
  if (!focusId || !graph.has(focusId)) return new Set(graph.keys());
  const fam = computeBloodFamily(graph);
  const root = fam.get(focusId);
  const visible = new Set();
  for (const [id, r] of fam) if (r === root) visible.add(id);
  // супруги членов рода — чтобы пары рисовались (их предки скрыты до раскрытия)
  for (const id of [...visible]) {
    for (const s of graph.get(id).spouses) if (graph.has(s)) visible.add(s);
  }
  // раскрытие: только вверх к предкам (Q4=B), без боковых ветвей.
  // каждый раскрытый узел показывает родителей + их супругов (для пары);
  // дальше идём вверх, пока такие родители тоже в expanded.
  let added = true;
  while (added) {
    added = false;
    for (const id of expanded) {
      if (!visible.has(id)) continue;
      for (const par of graph.get(id).parents) {
        if (!graph.has(par)) continue;
        if (!visible.has(par)) { visible.add(par); added = true; }
        for (const s of graph.get(par).spouses) {
          if (graph.has(s) && !visible.has(s)) { visible.add(s); added = true; }
        }
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

// Подграф из видимых id (значения — те же person-объекты; buildLayout режет связи
// к скрытым через graph.has, исходный граф не мутируется).
export function filterGraph(graph, visible) {
  const m = new Map();
  for (const id of visible) if (graph.has(id)) m.set(id, graph.get(id));
  return m;
}
