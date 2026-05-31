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
import PersonNode from './PersonNode.jsx';
import UnionNode from './UnionNode.jsx';
import PersonModal from './PersonModal.jsx';
import KinshipModal from './KinshipModal.jsx';

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
  const { fitView } = useReactFlow();

  // первичная загрузка данных из Supabase
  useEffect(() => {
    loadTree()
      .then(({ data, version }) => { setGraph(buildGraph(data)); setVersion(version); })
      .catch(() => setGraph(buildGraph({ persons: [] })));
  }, []);

  // пересчёт раскладки при смене графа
  const relayout = useCallback(g => {
    const { nodes: n, edges: e } = buildLayout(g);
    setNodes(n);
    setEdges(fixMarkers(e));
    requestAnimationFrame(() => fitView({ duration: 400, padding: 0.15 }));
  }, [fitView]);

  useEffect(() => { if (graph) relayout(graph); }, [graph, relayout]);

  const onNodesChange = useCallback(
    changes => setNodes(nds => applyNodeChanges(changes, nds)), []);

  const onNodeClick = useCallback((_e, node) => {
    if (kinshipMode) {
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
    } else {
      setModal({ type: 'person', id: node.id });
    }
  }, [kinshipMode, graph]);

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
    p.birthYear = values.birthYear ? +values.birthYear : null;
    p.deathYear = values.deathYear ? +values.deathYear : null;
    if (coupleKey !== undefined) reassignParents(p, coupleKey);
    if (file) {
      const blob = await resizeImage(file);
      const name = `${id}.jpg`;
      await uploadPhoto(blob, name);
      p.photo = name;
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

  const doSave = async () => {
    try {
      const raw = { persons: [...graph.values()] };
      const res = await saveTree(raw, version);
      if (res.conflict) {
        alert('Древо изменилось в другом месте. Обнови страницу, затем повтори правки.');
        return;
      }
      setVersion(res.version);
      alert('Сохранено.');
    } catch (e) {
      alert('Ошибка сохранения: ' + e.message);
    }
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

  // подсветка выбранных (режим родства) и карточек наведённой стрелки
  const displayNodes = useMemo(() =>
    nodes.map(n => {
      const cls = [];
      if (selected.includes(n.id)) cls.push('ft-selected');
      if (hlNodes.has(n.id)) cls.push('ft-hl');
      return cls.length ? { ...n, className: cls.join(' ') } : n;
    }),
    [nodes, selected, hlNodes]);

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
          <button onClick={() => { setKinshipMode(m => !m); setSelected([]); }}>
            {kinshipMode ? 'Отмена' : 'Кто кому кем'}
          </button>
          {!admin && <button onClick={enterAdmin}>Редактировать</button>}
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
