import { useRef } from 'react';

const FIELDS = [
  ['fio', 'ФИО'],
  ['birthYear', 'Год рождения'],
  ['deathYear', 'Год смерти'],
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

export default function PersonModal({ person, editable, onClose, onSave, onAddRelative }) {
  const fileRef = useRef(null);

  if (!editable) {
    return (
      <Overlay onClose={onClose}>
        <h3>{person.fio}</h3>
        <pre className="ft-info">{JSON.stringify(person, null, 2)}</pre>
      </Overlay>
    );
  }

  const submit = e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const values = {};
    for (const [k, v] of fd.entries()) values[k] = v === '' ? null : v;
    onSave(person.id, values, fileRef.current?.files[0]);
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
        <label>Фото <input type="file" ref={fileRef} accept="image/*" /></label>
        <button type="submit">Применить</button>
      </form>
      <div className="ft-addrel">
        Добавить родню:{' '}
        <button onClick={() => onAddRelative(person.id, 'spouse')}>+ супруг(а)</button>
        <button onClick={() => onAddRelative(person.id, 'child')}>+ ребёнок</button>
        <button onClick={() => onAddRelative(person.id, 'parent')}>+ родитель</button>
      </div>
    </Overlay>
  );
}
