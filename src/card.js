import { guessSex } from './data.js';

const STATUS = {
  alive:    { label: 'Жив', icon: '🕊' },
  deceased: { label: 'Упокоен', icon: '⚰' },
  unknown:  { label: 'Неизвестно', icon: '?' }
};
function statusFor(p) {
  const s = STATUS[p.status] || STATUS.unknown;
  // согласование рода для ж.
  if (p.sex === 'f' && p.status === 'alive') return { ...s, label: 'Жива' };
  if (p.sex === 'f' && p.status === 'deceased') return { ...s, label: 'Упокоена' };
  return s;
}
function silhouette(sex) {
  return sex === 'f'
    ? '<span class="silhouette-f">&#128105;</span>'
    : '<span class="silhouette-m">&#128104;</span>';
}
function esc(s){ return String(s ?? '').replace(/[&<>"]/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

const EMPTY = '—';
// строка «ярлык: значение» (значение пустое → «—»)
function metaRow(label, val) {
  return `<div class="ft-meta"><span class="ft-lbl">${label}:</span> ${val ? esc(val) : EMPTY}</div>`;
}

export function renderCardHTML(p) {
  const sex = p.sex || guessSex(p.fio);
  const st = statusFor({ ...p, sex });
  const years = p.deathYear ? `${p.birthYear ?? '?'} — ${p.deathYear}`
                            : (p.birthYear ? `${p.birthYear}` : '');
  const photoSrc = p.photo
    ? (/^https?:\/\//.test(p.photo) ? p.photo : `photos/${p.photo}`)
    : null;
  const photo = photoSrc
    ? `<img class="ft-photo" src="${esc(photoSrc)}" alt="">`
    : `<div class="ft-photo ft-silh">${silhouette(sex)}</div>`;
  // место упокоения — только для упокоенных; ссылка если есть restMapUrl
  let rest = '';
  if (p.status === 'deceased') {
    rest = p.restMapUrl
      ? `<a class="ft-rest" href="${esc(p.restMapUrl)}" target="_blank" rel="noopener">📍 ${esc(p.restPlace || 'на карте')}</a>`
      : metaRow('Упокоен', p.restPlace);
  }
  // контакты — только для живых
  const contacts = (p.status === 'alive')
    ? metaRow('Контакты', p.contacts) : '';
  return `
<div class="ft-card ft-${esc(p.status || 'unknown')}" data-id="${esc(p.id)}">
  <div class="ft-crest">&#9818;</div>
  ${photo}
  <h3 class="ft-name">${esc(p.fio) || EMPTY}</h3>
  ${p.birthSurname ? `<div class="ft-maiden">урожд. ${esc(p.birthSurname)}</div>` : ''}
  <div class="ft-years">${years ? esc(years) : EMPTY}</div>
  <div class="ft-status">${st.icon} ${esc(st.label)}</div>
  <div class="ft-divider"></div>
  <div class="ft-bio">${p.bio ? esc(p.bio) : EMPTY}</div>
  ${metaRow('Национальность', p.nationality)}
  ${metaRow('Место рожд.', p.birthPlace)}
  ${rest}${contacts}
</div>`;
}
