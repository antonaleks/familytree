import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow, Background, Controls, MarkerType,
  applyNodeChanges, useReactFlow, ReactFlowProvider
} from '@xyflow/react';
import { buildGraph } from './data.js';
import { login, isEditor } from './auth.js';
import { findRelation } from './kinship.js';
import { resizeImage } from './photo.js';
import { loadTree, saveTree, uploadPhoto } from './db.js';
import { buildLayout } from './layout.js';
import { visibleIds, expandableIds, filterGraph } from './focus.js';
import PersonNode from './PersonNode.jsx';
import UnionNode from './UnionNode.jsx';
import PersonModal from './PersonModal.jsx';
import KinshipModal from './KinshipModal.jsx';
import FocusModal from './FocusModal.jsx';

const nodeTypes = { person: PersonNode, union: UnionNode };

// markerEnd из layout — строка 'arrowclosed'; маппим в enum @xyflow
function fixMarkers(edges) {
  return edges.map(e => e.markerEnd
    ? { ...e, markerEnd: { ...e.markerEnd, type: MarkerType.ArrowClosed } }
    : e);
}

function Tree() {
  const [graph, setGraph] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [admin, setAdmin] = useState(false);
  const [kinshipMode, setKinshipMode] = useState(false);
  const [selected, setSelected] = useState([]);
  const [modal, setModal] = useState(null); // {type:'person',id} | {type:'kinship',a,b,r}
  const [hoverEdge, setHoverEdge] = useState(null);
  const [version, setVersion] = useState(1);
  const [focusId, setFocusId] = useState(null);     // фокус-персона (род от неё)
  const [expanded, setExpanded] = useState(() => new Set()); // раскрытые предки
  const [positions, setPositions] = useState(null); // сохранённые координаты {id:{x,y}}
  const { fitView } = useReactFlow();

  // первичная загрузка данных из Supabase. По умолчанию — всё древо (фокуса нет).
  useEffect(() => {
    loadTree()
      .then(({ data, version }) => {
        setGraph(buildGraph(data));
        setVersion(version);
        setPositions(data.positions || {});
      })
      .catch(() => { setGraph(buildGraph({ persons: [] })); setPositions({}); });
  }, []);

  // видимое подмножество при текущем фокусе + раскрытие; чужие роды скрыты
  const visible = useMemo(
    () => (graph ? visibleIds(graph, focusId, expanded) : new Set()),
    [graph, focusId, expanded]);
  const view = useMemo(
    () => (graph ? filterGraph(graph, visible) : null), [graph, visible]);
  const expandable = useMemo(
    () => (graph ? expandableIds(graph, visible) : new Set()), [graph, visible]);

  // пересчёт раскладки: подграф view + сохранённые позиции
  const relayout = useCallback((g, pos) => {
    const { nodes: n, edges: e } = buildLayout(g, pos);
    setNodes(n);
    setEdges(fixMarkers(e));
    requestAnimationFrame(() => fitView({ duration: 400, padding: 0.15 }));
  }, [fitView]);

  useEffect(() => { if (view) relayout(view, positions); }, [view, positions, relayout]);

  const onExpand = useCallback(
    id => setExpanded(prev => new Set(prev).add(id)), []);

  const setFocus = useCallback(id => {
    setFocusId(id); setExpanded(new Set()); setModal(null);
  }, []);
  const showAll = useCallback(() => {
    setFocusId(null); setExpanded(new Set()); setModal(null);
  }, []);

  const onNodesChange = useCallback(
    changes => setNodes(nds => applyNodeChanges(changes, nds)), []);

  // выбрать карточку для расчёта родства; на второй — показать результат
  const pickForKinship = useCallback(node => {
    setSelected(prev => {
      const next = prev.includes(node.id) ? prev : [...prev, node.id];
      if (next.length === 2) {
        const [a, b] = next;
        setModal({ type: 'kinship', a, b, r: findRelation(graph, a, b) });
        setKinshipMode(false);
        return [];
      }
      return next;
    });
  }, [graph]);

  // обычный клик — карточка; Shift-клик (или режим) — расчёт родства по двум
  const onNodeClick = useCallback((e, node) => {
    if (kinshipMode || e.shiftKey) pickForKinship(node);
    else setModal({ type: 'person', id: node.id });
  }, [kinshipMode, pickForKinship]);

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

  const syncGraph = () => setGraph(new Map(graph)); // триггерит relayout

  // переназначить родителей персоны парой (coupleKey = 'idA|idB' или '' = нет)
  const reassignParents = (p, coupleKey) => {
    for (const pid of p.parents || []) {
      const par = graph.get(pid);
      if (par) par.children = (par.children || []).filter(c => c !== p.id);
    }
    if (coupleKey) {
      const [a, b] = coupleKey.split('|');
      p.parents = [a, b];
      for (const pid of [a, b]) {
        const par = graph.get(pid);
        if (par && !(par.children || []).includes(p.id)) {
          par.children = [...(par.children || []), p.id];
        }
      }
    } else {
      p.parents = [];
    }
  };

  // сохранить правки персоны (фото грузится в Storage сразу)
  const savePerson = async (id, values, file, coupleKey) => {
    const p = graph.get(id);
    Object.assign(p, values);
    p.birthYear = values.birthYear || null; // свободная строка: «1997» или «26.01.1997»
    p.deathYear = values.deathYear || null;
    if (coupleKey !== undefined) reassignParents(p, coupleKey);
    if (file) {
      try {
        const blob = await resizeImage(file);
        const name = `${id}.jpg`;
        await uploadPhoto(blob, name);
        p.photo = name;
      } catch (e) {
        alert('Не удалось загрузить фото: ' + e.message);
        return;
      }
    }
    setModal(null);
    syncGraph();
  };

  // удалить персону + отвязать её ото всех (локально, до «Сохранить»)
  const deletePerson = (id) => {
    for (const q of graph.values()) {
      if (q.id === id) continue;
      q.spouses = (q.spouses || []).filter(x => x !== id);
      q.children = (q.children || []).filter(x => x !== id);
      q.parents = (q.parents || []).filter(x => x !== id);
    }
    graph.delete(id);
    setModal(null);
    syncGraph();
  };

  // добавить родственника
  const addRelative = (id, kind) => {
    const nid = 'id' + Date.now();
    const np = { id: nid, fio: 'Новый', sex: 'm', status: 'unknown',
      parents: [], spouses: [], children: [] };
    const p = graph.get(id);
    if (kind === 'spouse') { np.spouses.push(id); p.spouses.push(nid); }
    if (kind === 'child') { np.parents.push(id); p.children.push(nid); }
    if (kind === 'parent') { np.children.push(id); p.parents.push(nid); }
    graph.set(nid, np);
    setModal({ type: 'person', id: nid });
    syncGraph();
  };

  // текущие координаты карточек (после ручных подвижек) → {id:{x,y}}
  const collectPositions = () => {
    const pos = {};
    for (const n of nodes) {
      if (n.type === 'person') pos[n.id] = { x: Math.round(n.position.x), y: Math.round(n.position.y) };
    }
    return pos;
  };

  const doSave = async () => {
    try {
      // мерж: видимые ноды обновляют координаты, скрытые (вне фокуса) сохраняются
      const pos = { ...(positions || {}), ...collectPositions() };
      const raw = { persons: [...graph.values()], positions: pos };
      const res = await saveTree(raw, version);
      if (res.conflict) {
        alert('Древо изменилось в другом месте. Обнови страницу, затем повтори правки.');
        return;
      }
      setVersion(res.version);
      setPositions(pos);
      alert('Сохранено.');
    } catch (e) {
      alert('Ошибка сохранения: ' + e.message);
    }
  };

  // сбросить ручные подвижки → авто-раскладка (сохранится при следующем «Сохранить»)
  const resetTree = () => {
    if (!confirm('Сбросить расположение карточек к авто-раскладке?')) return;
    setPositions({});
  };

  const onEdgeMouseEnter = useCallback((_e, edge) => setHoverEdge(edge.id), []);
  const onEdgeMouseLeave = useCallback(() => setHoverEdge(null), []);

  // id-endpoint → id карточек: союз `u-a|b` разворачивается в обоих супругов
  const cardIds = (id) => id?.startsWith('u-')
    ? id.slice(2).split('|') : [id];

  // карточки, на которые ссылается наведённая стрелка (включая концы союза)
  const hlNodes = useMemo(() => {
    if (!hoverEdge) return new Set();
    const e = edges.find(x => x.id === hoverEdge);
    if (!e) return new Set();
    return new Set([...cardIds(e.source), ...cardIds(e.target)]);
  }, [hoverEdge, edges]);

  // подсветка выбранных (режим родства) и карточек наведённой стрелки;
  // плюс инъекция признака «раскрыть предков» в person-ноды
  const displayNodes = useMemo(() =>
    nodes.map(n => {
      const cls = [];
      if (selected.includes(n.id)) cls.push('ft-selected');
      if (hlNodes.has(n.id)) cls.push('ft-hl');
      const exp = n.type === 'person' && expandable.has(n.id);
      const data = exp ? { ...n.data, expandable: true, onExpand } : n.data;
      return (cls.length || exp) ? { ...n, className: cls.join(' '), data } : n;
    }),
    [nodes, selected, hlNodes, expandable, onExpand]);

  // подсветка самой наведённой стрелки
  const displayEdges = useMemo(() =>
    edges.map(e => e.id === hoverEdge
      ? { ...e, animated: true,
          style: { ...e.style, stroke: 'var(--gold-2)',
            strokeWidth: (e.style?.strokeWidth || 2) + 1.5 },
          markerEnd: e.markerEnd
            ? { ...e.markerEnd, color: '#f0dca8' } : e.markerEnd }
      : e),
    [edges, hoverEdge]);

  return (
    <>
      <header id="topbar">
        <h1>Семейное древо</h1>
        <div className="actions">
          <button onClick={() => setModal({ type: 'focus' })}>От кого</button>
          {focusId && <button onClick={showAll}>Всё древо</button>}
          <button onClick={() => { setKinshipMode(m => !m); setSelected([]); }}>
            {kinshipMode ? 'Отмена' : 'Кто кому кем'}
          </button>
          {!admin && <button onClick={enterAdmin}>Редактировать</button>}
          {admin && <button onClick={resetTree}>Сбросить дерево</button>}
          {admin && <button onClick={doSave}>Сохранить</button>}
        </div>
      </header>
      <main id="tree" className={kinshipMode ? 'kinship-mode' : ''}>
        <ReactFlow
          nodes={displayNodes}
          edges={displayEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onNodeClick={onNodeClick}
          onEdgeMouseEnter={onEdgeMouseEnter}
          onEdgeMouseLeave={onEdgeMouseLeave}
          minZoom={0.05}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#3a1518" gap={28} />
          <Controls />
        </ReactFlow>
      </main>
      {modal?.type === 'person' && (
        <PersonModal
          person={graph.get(modal.id)}
          graph={graph}
          editable={admin}
          onClose={() => setModal(null)}
          onSave={savePerson}
          onAddRelative={addRelative}
          onDelete={deletePerson}
          onFocus={setFocus}
        />
      )}
      {modal?.type === 'focus' && (
        <FocusModal
          graph={graph}
          focusId={focusId}
          onPick={setFocus}
          onShowAll={showAll}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'kinship' && (
        <KinshipModal
          a={graph.get(modal.a)}
          b={graph.get(modal.b)}
          r={modal.r}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <Tree />
    </ReactFlowProvider>
  );
}
