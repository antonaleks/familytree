import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGraph } from '../src/data.js';
import { toRelNodes, computeBloodFamily, buildEdges, pickRoot, connectedComponents, computeClusters, computeGenerations, buildLayout } from '../src/layout-core.js';

const sample = () => buildGraph({ persons: [
  { id: 'gf', fio: 'Дед', sex: 'm', children: ['dad'] },
  { id: 'gm', fio: 'Баба', sex: 'f', spouses: ['gf'], children: ['dad'] },
  { id: 'dad', fio: 'Отец', sex: 'm', children: ['kid'] },
  { id: 'mom', fio: 'Мать', sex: 'f', spouses: ['dad'], children: ['kid'] },
  { id: 'kid', fio: 'Сын', sex: 'm' }
]});

test('toRelNodes: маппит пол и связи в формат relatives-tree', () => {
  const g = sample();
  const nodes = toRelNodes(g);
  const dad = nodes.find(n => n.id === 'dad');
  assert.equal(dad.gender, 'male');
  assert.deepEqual(dad.parents.map(r => r.id).sort(), ['gf', 'gm']);
  assert.deepEqual(dad.children.map(r => r.id), ['kid']);
  assert.equal(dad.spouses[0].id, 'mom');
  assert.equal(dad.spouses[0].type, 'married');
});

test('toRelNodes: достраивает siblings из общих родителей', () => {
  const g = buildGraph({ persons: [
    { id: 'p', fio: 'Отец', sex: 'm', children: ['a', 'b'] },
    { id: 'a', fio: 'Аня' }, { id: 'b', fio: 'Боря' }
  ]});
  const nodes = toRelNodes(g);
  const a = nodes.find(n => n.id === 'a');
  assert.deepEqual(a.siblings.map(r => r.id), ['b']);
});

test('computeBloodFamily: патрилинейный корень', () => {
  const g = sample();
  const fam = computeBloodFamily(g);
  assert.equal(fam.get('kid'), 'gf');   // kid→dad→gf
  assert.equal(fam.get('dad'), 'gf');
  assert.equal(fam.get('gf'), 'gf');
  assert.equal(fam.get('mom'), 'mom');  // вошла по браку, свой род
});

test('buildEdges: стрелки родитель→ребёнок, супруги без стрелки', () => {
  const g = sample();
  const edges = buildEdges(g);
  const pc = edges.find(e => e.source === 'dad' && e.target === 'kid');
  assert.ok(pc.markerEnd, 'у связи родитель→ребёнок есть markerEnd');
  const sp = edges.find(e => e.id.startsWith('s-'));
  assert.equal(sp.markerEnd, undefined, 'у супружеской связи нет стрелки');
  // супружеская пара не дублируется
  const spCount = edges.filter(e => e.id.startsWith('s-')).length;
  assert.equal(spCount, 2); // gf-gm и dad-mom
});

test('pickRoot: выбирает предка без родителей с макс. числом потомков', () => {
  const g = sample();
  assert.equal(pickRoot(g), 'gf'); // gf без родителей, потомки dad+kid
});

test('computeGenerations: поколение = длиннейший путь, супруги в одном слое', () => {
  const g = sample();
  const gen = computeGenerations(g);
  assert.equal(gen.get('gf'), 0);
  assert.equal(gen.get('gm'), 0);   // супруга основателя — тот же слой
  assert.equal(gen.get('dad'), 1);
  assert.equal(gen.get('mom'), 1);  // жена выровнена к мужу
  assert.equal(gen.get('kid'), 2);
});

test('computeGenerations: кросс-брак тянет супруга в общий (макс) слой', () => {
  // род A глубже рода B на 1; брак на стыке выравнивает пару в один слой.
  const g = buildGraph({ persons: [
    { id: 'a0', fio: 'A0', sex: 'm', children: ['a1'] },
    { id: 'a1', fio: 'A1', sex: 'm', children: ['a2'] },
    { id: 'a2', fio: 'A2', sex: 'f', spouses: ['b1'] }, // gen 2
    { id: 'b0', fio: 'B0', sex: 'm', children: ['b1'] },
    { id: 'b1', fio: 'B1', sex: 'm', spouses: ['a2'] }  // base gen 1 → выровнен в 2
  ]});
  const gen = computeGenerations(g);
  assert.equal(gen.get('a2'), 2);
  assert.equal(gen.get('b1'), 2);
});

test('buildLayout: карточки не налезают (уникальные позиции) и пары рядом', () => {
  const g = sample();
  const { nodes } = buildLayout(g);
  assert.equal(nodes.length, 5);
  // нет двух нод в одной точке
  const keys = nodes.map(n => `${n.position.x},${n.position.y}`);
  assert.equal(new Set(keys).size, keys.length);
  // супруги в одной строке Y и на соседних слотах
  const pos = new Map(nodes.map(n => [n.id, n.position]));
  const dad = pos.get('dad'), mom = pos.get('mom');
  assert.equal(dad.y, mom.y);
  assert.equal(Math.abs(dad.x - mom.x), 240); // SLOT = NODE_W
});

test('computeClusters: два рода, сшитые браком, → отдельные патрилинейные кластеры', () => {
  // род A: дед-отец → сын; род B: дед-отец → дочь; сын♥дочь сшивают роды.
  const g = buildGraph({ persons: [
    { id: 'a', fio: 'ДедA', sex: 'm', children: ['as'] },
    { id: 'as', fio: 'СынA', sex: 'm', spouses: ['bd'], children: ['kid'] },
    { id: 'b', fio: 'ДедB', sex: 'm', children: ['bd'] },
    { id: 'bd', fio: 'ДочьB', sex: 'f', spouses: ['as'], children: ['kid'] },
    { id: 'kid', fio: 'Внук', sex: 'm' }
  ]});
  const cl = computeClusters(g);
  // два кластера: корни a и b
  assert.deepEqual([...cl.keys()].sort(), ['a', 'b']);
  // внук патрилинейно (отец as) → кластер деда A; жена-дочь B остаётся в роду B
  assert.deepEqual([...cl.get('a')].sort(), ['a', 'as', 'kid']);
  assert.deepEqual([...cl.get('b')].sort(), ['b', 'bd']);
});

test('computeClusters: вошедший по браку супруг приписан к кластеру партнёра', () => {
  // основатель♥жена-без-родителей → жена входит в кластер мужа.
  const g = buildGraph({ persons: [
    { id: 'h', fio: 'Муж', sex: 'm', spouses: ['w'], children: ['c'] },
    { id: 'w', fio: 'Жена', sex: 'f', spouses: ['h'], children: ['c'] },
    { id: 'c', fio: 'Ребёнок', sex: 'm' }
  ]});
  const cl = computeClusters(g);
  assert.equal(cl.size, 1);
  assert.deepEqual([...cl.get('h')].sort(), ['c', 'h', 'w']);
});

test('connectedComponents: острова семей в отдельных компонентах', () => {
  const g = buildGraph({ persons: [
    { id: 'a', fio: 'А', sex: 'm', children: ['b'] },
    { id: 'b', fio: 'Б' },
    { id: 'x', fio: 'Икс', sex: 'm', spouses: ['y'] }, // отдельный остров
    { id: 'y', fio: 'Игрек', sex: 'f' }
  ]});
  const comps = connectedComponents(g);
  assert.equal(comps.length, 2);
  assert.equal(comps[0].length, 2); // крупнейшая первой
  assert.deepEqual([...comps[0]].sort(), ['a', 'b']);
  assert.deepEqual([...comps[1]].sort(), ['x', 'y']);
});
