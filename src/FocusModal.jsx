import { useMemo, useState } from 'react';
import { photoUrl } from './db.js';
import { guessSex } from './data.js';

// Модалка выбора фокус-персоны: поиск по ФИО + список. Клик → строить древо от неё.
function avatar(p) {
  if (p.photo) return <img className="ft-fa-img" src={photoUrl(p.photo)} alt="" />;
  const sex = p.sex || guessSex(p.fio);
  return <span className="ft-fa-silh">{sex === 'f' ? '👩' : '👨'}</span>;
}

function years(p) {
  if (p.deathYear) return `${p.birthYear ?? '?'} — ${p.deathYear}`;
  return p.birthYear ? `р. ${p.birthYear}` : '';
}

export default function FocusModal({ graph, focusId, onPick, onShowAll, onClose }) {
  const [q, setQ] = useState('');
  const all = useMemo(() => [...graph.values()], [graph]);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const arr = s
      ? all.filter(p => (p.fio || '').toLowerCase().includes(s))
      : all;
    return [...arr].sort((a, b) => (a.fio || '').localeCompare(b.fio || '', 'ru')).slice(0, 60);
  }, [all, q]);

  return (
    <div className="ft-overlay" onClick={e => {
      if (e.target.classList.contains('ft-overlay')) onClose();
    }}>
      <div className="ft-modal ft-modal-focus">
        <button className="ft-close" onClick={onClose}>×</button>
        <h3>От кого строить древо</h3>
        <input className="ft-search" autoFocus value={q}
          onChange={e => setQ(e.target.value)} placeholder="Поиск: например, Иванов Иван" />
        {focusId && (
          <button className="ft-btn ft-btn-ghost ft-showall" onClick={onShowAll}>
            Показать всё древо
          </button>
        )}
        <ul className="ft-focus-list">
          {list.map(p => (
            <li key={p.id} className={p.id === focusId ? 'ft-fi ft-fi-cur' : 'ft-fi'}
              onClick={() => onPick(p.id)}>
              <span className="ft-fa">{avatar(p)}</span>
              <span className="ft-fi-txt">
                <span className="ft-fi-name">{p.fio || '—'}</span>
                <span className="ft-fi-years">{years(p)}</span>
              </span>
            </li>
          ))}
          {list.length === 0 && <li className="ft-fi-empty">Ничего не найдено</li>}
        </ul>
      </div>
    </div>
  );
}
