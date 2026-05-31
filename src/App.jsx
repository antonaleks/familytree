import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow, Background, Controls, MarkerType,
  applyNodeChanges, useReactFlow, ReactFlowProvider
} from '@xyflow/react';
import { CONFIG } from '../config.js';
import { decodeData, encodeData, buildGraph } from './data.js';
import { checkPassword } from './auth.js';
import { findRelation } from './kinship.js';
import { resizeImage, blobToBase64 } from './photo.js';
import { buildCommitFiles, commitToGitHub } from './save.js';
import { buildLayout } from './layout.js';
import PersonNode from './PersonNode.jsx';
import PersonModal from './PersonModal.jsx';
import KinshipModal from './KinshipModal.jsx';

const nodeTypes = { person: PersonNode };

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
  const [newPhotos, setNewPhotos] = useState([]);
  const { fitView } = useReactFlow();

  // первичная загрузка данных
  useEffect(() => {
    const url = import.meta.env.BASE_URL + CONFIG.dataPath + '?_=' + Date.now();
    fetch(url)
      .then(r => (r.ok ? r.text() : ''))
      .then(t => setGraph(buildGraph(decodeData(t.trim()))))
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

  // ——— админ ———
  const enterAdmin = () => {
    if (admin) return;
    const pw = prompt('Пароль администратора:');
    if (pw == null) return;
    if (checkPassword(pw, CONFIG.passwordB64)) { setAdmin(true); alert('Режим редактирования включён.'); }
    else alert('Неверный пароль.');
  };

  const syncGraph = () => setGraph(new Map(graph)); // триггерит relayout

  // сохранить правки персоны
  const savePerson = async (id, values, file) => {
    const p = graph.get(id);
    Object.assign(p, values);
    p.birthYear = values.birthYear ? +values.birthYear : null;
    p.deathYear = values.deathYear ? +values.deathYear : null;
    if (file) {
      const blob = await resizeImage(file);
      const name = `${id}.jpg`;
      const base64 = await blobToBase64(blob);
      p.photo = name;
      setNewPhotos(prev => [...prev.filter(x => x.name !== name), { name, base64 }]);
    }
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
    const token = prompt('GitHub токен (repo scope). Не сохраняется:');
    if (!token) return;
    try {
      const raw = { persons: [...graph.values()] };
      const files = buildCommitFiles(encodeData(raw), newPhotos, CONFIG);
      await commitToGitHub(token, CONFIG, files, 'Update family data');
      setNewPhotos([]);
      alert('Сохранено в GitHub. Pages обновится через минуту.');
    } catch (e) {
      alert('Ошибка сохранения: ' + e.message);
    }
  };

  // подсветка выбранных в режиме родства
  const displayNodes = useMemo(() =>
    nodes.map(n => selected.includes(n.id)
      ? { ...n, className: 'ft-selected' } : n),
    [nodes, selected]);

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
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onNodeClick={onNodeClick}
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
          editable={admin}
          onClose={() => setModal(null)}
          onSave={savePerson}
          onAddRelative={addRelative}
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
