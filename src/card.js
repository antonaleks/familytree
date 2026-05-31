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

export function renderCardHTML(p) {
  const st = statusFor(p);
  const years = p.deathYear ? `${p.birthYear ?? '?'} — ${p.deathYear}`
                            : (p.birthYear ? `${p.birthYear}` : '');
  const photo = p.photo
    ? `<img class="ft-photo" src="photos/${esc(p.photo)}" alt="">`
    : `<div class="ft-photo ft-silh">${silhouette(p.sex)}</div>`;
  const rest = (p.status === 'deceased' && p.restMapUrl)
    ? `<a class="ft-rest" href="${esc(p.restMapUrl)}" target="_blank" rel="noopener">📍 ${esc(p.restPlace || 'на карте')}</a>`
    : '';
  const contacts = (p.status === 'alive' && p.contacts)
    ? `<div class="ft-contacts">${esc(p.contacts)}</div>` : '';
  return `
<div class="ft-card ft-${esc(p.status)}" data-id="${esc(p.id)}">
  <div class="ft-crest">&#9818;</div>
  ${photo}
  <h3 class="ft-name">${esc(p.fio)}</h3>
  <div class="ft-years">${esc(years)}</div>
  <div class="ft-status">${st.icon} ${esc(st.label)}</div>
  <div class="ft-divider"></div>
  ${p.bio ? `<div class="ft-bio">${esc(p.bio)}</div>` : ''}
  <div class="ft-meta">${esc([p.nationality, p.birthPlace && 'род. ' + p.birthPlace].filter(Boolean).join(' · '))}</div>
  ${rest}${contacts}
</div>`;
}
