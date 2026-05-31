import { renderCardHTML } from './card.js';

export function toFamilyChartData(graph) {
  const out = [];
  for (const p of graph.values()) {
    let father = null, mother = null;
    for (const par of p.parents) {
      const pp = graph.get(par);
      if (pp && pp.sex === 'f') mother = par; else if (pp) father = par;
    }
    out.push({
      id: p.id,
      rels: { father, mother, spouses: [...p.spouses], children: [...p.children] },
      data: { ...p }
    });
  }
  return out;
}

// Браузерная обёртка: создаёт диаграмму family-chart.
// f3 — глобал из vendor/family-chart.js (подключается в index.html).
export function initTree(container, graph, { onCardClick } = {}) {
  /* global f3 */
  const data = toFamilyChartData(graph);
  const chart = f3.createChart(container, data)
    .setTransitionTime(600)
    .setCardYSpacing(260)
    .setCardXSpacing(240)
    .setOrientationVertical();
  const card = chart.setCard(f3.CardHtml)
    .setCardInnerHtmlCreator(d => renderCardHTML(d.data.data));
  if (onCardClick) card.setOnCardClick((e, d) => onCardClick(d.data.id));
  chart.updateTree({ initial: true });
  return chart;
}
