import { useRef } from 'react';

const FIELDS = [
  ['fio', 'ФИО'],
  ['birthSurname', 'Фамилия при рождении'],
  ['birthYear', 'Дата/год рождения'],
  ['deathYear', 'Дата/год смерти'],
  ['birthPlace', 'Место рождения'],
  ['nationality', 'Национальность'],
  ['bio', 'БИО'],
  ['contacts', 'Контакты (для живых)'],
  ['restPlace', 'Место упокоения'],
  ['restMapUrl', 'Ссылка Яндекс.Карты']
];
const SEX = { m: 'муж', f: 'жен' };
const STATUS = { alive: 'жив', deceased: 'упокоен', unknown: 'неизв' };

function Overlay({ children, onClose }) {
  return (
    <div className="ft-overlay" onClick={e => {
      if (e.target.classList.contains('ft-overlay')) onClose();
    }}>
      <div className="ft-modal">
        {children}
        <button className="ft-close" onClick={onClose}>×</button>
      </div>
    </div>
  );
}

// Список супружеских пар графа (для выбора родителей). Сама персона исключена.
function listCouples(graph, selfId) {
  const couples = [];
  const seen = new Set();
  for (const q of graph.values()) {
    for (const sid of q.spouses || []) {
      if (q.id === selfId || sid === selfId) continue;
      const key = [q.id, sid].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      const a = graph.get(q.id), b = graph.get(sid);
      if (!a || !b) continue;
      const father = a.sex === 'm' ? a : (b.sex === 'm' ? b : a);
      const mother = father === a ? b : a;
      couples.push({ key, label: `${father.fio} × ${mother.fio}` });
    }
  }
  couples.sort((x, y) => x.label.localeCompare(y.label, 'ru'));
  return couples;
}

export default function PersonModal({ person, graph, editable, onClose, onSave, onAddRelative, onDelete }) {
  const fileRef = useRef(null);

  if (!editable) {
    return (
      <Overlay onClose={onClose}>
        <h3>{person.fio}</h3>
        <pre className="ft-info">{JSON.stringify(person, null, 2)}</pre>
      </Overlay>
    );
  }

  const couples = graph ? listCouples(graph, person.id) : [];
  const currentCouple = (person.parents || []).length === 2
    ? [...person.parents].sort().join('|') : '';

  const submit = e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const coupleKey = fd.get('__couple') || '';
    const values = {};
    for (const [k, v] of fd.entries()) {
      if (k === '__couple') continue;
      values[k] = v === '' ? null : v;
    }
    onSave(person.id, values, fileRef.current?.files[0], coupleKey);
  };

  return (
    <Overlay onClose={onClose}>
      <h3>Правка: {person.fio}</h3>
      <form onSubmit={submit}>
        <label>ФИО<input name="fio" defaultValue={person.fio ?? ''} /></label>
        <label>Пол
          <select name="sex" defaultValue={person.sex || 'm'}>
            {Object.entries(SEX).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
          </select>
        </label>
        <label>Статус
          <select name="status" defaultValue={person.status || 'unknown'}>
            {Object.entries(STATUS).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
          </select>
        </label>
        {FIELDS.filter(([n]) => n !== 'fio').map(([name, label]) => (
          <label key={name}>{label}
            <input name={name} defaultValue={person[name] ?? ''} />
          </label>
        ))}
        <label>Родители (пара)
          <select name="__couple" defaultValue={currentCouple}>
            <option value="">— нет —</option>
            {couples.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </label>
        <label>Фото <input type="file" ref={fileRef} accept="image/*" /></label>
        <button type="submit" className="ft-btn ft-btn-primary">Применить</button>
      </form>
      <div className="ft-addrel">
        <span className="ft-addrel-lbl">Добавить родню</span>
        <div className="ft-addrel-row">
          <button className="ft-btn ft-btn-ghost" onClick={() => onAddRelative(person.id, 'spouse')}>♥ супруг(а)</button>
          <button className="ft-btn ft-btn-ghost" onClick={() => onAddRelative(person.id, 'child')}>▾ ребёнок</button>
          <button className="ft-btn ft-btn-ghost" onClick={() => onAddRelative(person.id, 'parent')}>▴ родитель</button>
        </div>
      </div>
      <div className="ft-danger">
        <button type="button" className="ft-btn ft-del"
          onClick={() => { if (confirm(`Удалить карточку «${person.fio}»? Связи будут отвязаны.`)) onDelete(person.id); }}>
          Удалить карточку
        </button>
      </div>
    </Overlay>
  );
}
