import { useRef } from 'react';
import { photoUrl } from './db.js';
import { guessSex } from './data.js';

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

// согласованный по роду ярлык статуса для просмотра
function statusLabel(p) {
  const f = p.sex === 'f';
  if (p.status === 'alive') return f ? 'Жива' : 'Жив';
  if (p.status === 'deceased') return f ? 'Упокоена' : 'Упокоен';
  return 'Неизвестно';
}

function yearsText(p) {
  if (p.deathYear) return `${p.birthYear ?? '?'} — ${p.deathYear}`;
  return p.birthYear ? `${p.birthYear}` : '';
}

// строка «ярлык: значение», только если значение заполнено
function Row({ label, value }) {
  if (!value) return null;
  return (
    <div className="ft-vrow"><span className="ft-vlbl">{label}</span><span className="ft-vval">{value}</span></div>
  );
}

// красивый просмотр карточки: только заполненные поля
function PersonView({ person }) {
  const p = person;
  const sex = p.sex || guessSex(p.fio);
  const years = yearsText(p);
  return (
    <div className="ft-view">
      <div className="ft-vphoto">
        {p.photo
          ? <img src={photoUrl(p.photo)} alt="" />
          : <span className="ft-vsilh">{sex === 'f' ? '👩' : '👨'}</span>}
      </div>
      <h3 className="ft-vname">{p.fio || '—'}</h3>
      {p.birthSurname && <div className="ft-vmaiden">урожд. {p.birthSurname}</div>}
      {years && <div className="ft-vyears">{years}</div>}
      <div className="ft-vstatus">{statusLabel(p)}</div>
      {p.bio && <div className="ft-vbio">{p.bio}</div>}
      <div className="ft-vrows">
        <Row label="Место рождения" value={p.birthPlace} />
        <Row label="Национальность" value={p.nationality} />
        {p.status === 'alive' && <Row label="Контакты" value={p.contacts} />}
        {p.status === 'deceased' && (p.restMapUrl
          ? <div className="ft-vrow"><span className="ft-vlbl">Упокоен</span>
              <a className="ft-vval ft-vlink" href={p.restMapUrl} target="_blank" rel="noopener">
                📍 {p.restPlace || 'на карте'}</a></div>
          : <Row label="Место упокоения" value={p.restPlace} />)}
      </div>
    </div>
  );
}

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

export default function PersonModal({ person, graph, editable, onClose, onSave, onAddRelative, onDelete, onFocus }) {
  const fileRef = useRef(null);

  const focusBtn = (
    <button type="button" className="ft-btn ft-btn-ghost ft-focus-btn"
      onClick={() => onFocus(person.id)}>⌖ Строить отсюда</button>
  );

  if (!editable) {
    return (
      <Overlay onClose={onClose}>
        <PersonView person={person} />
        {focusBtn}
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
      {focusBtn}
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
