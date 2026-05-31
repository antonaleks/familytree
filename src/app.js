import { CONFIG } from '../config.js';
import { decodeData, encodeData, buildGraph } from './data.js';
import { checkPassword } from './auth.js';
import { initTree } from './tree.js';
import { findRelation } from './kinship.js';
import { resizeImage, blobToBase64 } from './photo.js';
import { buildCommitFiles, commitToGitHub } from './save.js';

const state = {
  graph: null, raw: null, admin: false, chart: null,
  selected: [], newPhotos: []
};

async function loadData() {
  const res = await fetch(CONFIG.dataPath + '?_=' + Date.now());
  const b64 = res.ok ? (await res.text()).trim() : '';
  state.raw = decodeData(b64);
  state.graph = buildGraph(state.raw);
}

function renderTree() {
  const el = document.getElementById('tree');
  el.innerHTML = '';
  state.chart = initTree(el, state.graph, { onCardClick: onCardClick });
}

function onCardClick(id) {
  if (document.body.classList.contains('kinship-mode')) {
    toggleSelect(id);
  } else {
    openPersonModal(id, state.admin);
  }
}

function toggleSelect(id) {
  const i = state.selected.indexOf(id);
  if (i >= 0) state.selected.splice(i, 1); else state.selected.push(id);
  if (state.selected.length === 2) {
    const [a, b] = state.selected;
    const r = findRelation(state.graph, a, b);
    showKinshipResult(state.graph.get(a), state.graph.get(b), r);
    state.selected = [];
    document.body.classList.remove('kinship-mode');
  }
}

// ——— модалки (минимальный inline-UI) ———
function modal(html) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="ft-overlay"><div class="ft-modal">${html}
    <button class="ft-close">×</button></div></div>`;
  root.querySelector('.ft-close').onclick = () => root.innerHTML = '';
  root.querySelector('.ft-overlay').onclick = e => {
    if (e.target.classList.contains('ft-overlay')) root.innerHTML = '';
  };
  return root.querySelector('.ft-modal');
}

function showKinshipResult(A, B, r) {
  const extra = r.def ? `<p class="ft-def">${r.def} <a href="${r.src}" target="_blank">подробнее</a></p>` : '';
  modal(`<h3>Кто кому кем</h3>
    <p><b>${B.fio}</b> приходится <b>${A.fio}</b>:</p>
    <p class="ft-term">${r.term}</p>${extra}`);
}

function openPersonModal(id, editable) {
  const p = state.graph.get(id);
  if (!editable) {
    modal(`<h3>${p.fio}</h3><pre class="ft-info">${JSON.stringify(p, null, 2)}</pre>`);
    return;
  }
  // форма редактирования
  const m = modal(`<h3>Правка: ${p.fio}</h3>
    <form id="ft-form">
      ${field('fio','ФИО',p.fio)}
      ${select('sex','Пол',p.sex,{m:'муж',f:'жен'})}
      ${field('birthYear','Год рождения',p.birthYear)}
      ${field('deathYear','Год смерти',p.deathYear)}
      ${select('status','Статус',p.status,{alive:'жив',deceased:'упокоен',unknown:'неизв'})}
      ${field('birthPlace','Место рождения',p.birthPlace)}
      ${field('nationality','Национальность',p.nationality)}
      ${field('bio','БИО',p.bio)}
      ${field('contacts','Контакты (для живых)',p.contacts)}
      ${field('restPlace','Место упокоения',p.restPlace)}
      ${field('restMapUrl','Ссылка Яндекс.Карты',p.restMapUrl)}
      <label>Фото <input type="file" id="ft-photo" accept="image/*"></label>
      <button type="submit">Применить</button>
    </form>
    <div class="ft-addrel">
      Добавить родню:
      <select id="ft-relkind">
        <option value="spouse">супруг(а)</option>
        <option value="child">ребёнок</option>
        <option value="parent">родитель</option>
      </select>
      <button id="ft-addbtn">+ новая карточка</button>
    </div>`);
  m.querySelector('#ft-form').onsubmit = async ev => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    for (const [k, v] of fd.entries()) p[k] = v === '' ? null : v;
    p.birthYear = p.birthYear ? +p.birthYear : null;
    p.deathYear = p.deathYear ? +p.deathYear : null;
    const file = m.querySelector('#ft-photo').files[0];
    if (file) {
      const blob = await resizeImage(file);
      const name = `${p.id}.jpg`;
      p.photo = name;
      state.newPhotos.push({ name, base64: await blobToBase64(blob) });
    }
    syncRawFromGraph();
    document.getElementById('modal-root').innerHTML = '';
    renderTree();
  };
  m.querySelector('#ft-addbtn').onclick = () => addRelative(id, m.querySelector('#ft-relkind').value);
}

function field(name, label, val) {
  return `<label>${label}<input name="${name}" value="${val ?? ''}"></label>`;
}
function select(name, label, val, opts) {
  const o = Object.entries(opts).map(([k,t]) =>
    `<option value="${k}" ${k===val?'selected':''}>${t}</option>`).join('');
  return `<label>${label}<select name="${name}">${o}</select></label>`;
}

function addRelative(id, kind) {
  const p = state.graph.get(id);
  const nid = 'id' + Date.now();
  const np = { id: nid, fio: 'Новый', sex: 'm', status: 'unknown',
    parents: [], spouses: [], children: [] };
  if (kind === 'spouse') { np.spouses.push(id); p.spouses.push(nid); }
  if (kind === 'child')  { np.parents.push(id); p.children.push(nid); }
  if (kind === 'parent') { np.children.push(id); p.parents.push(nid); }
  state.graph.set(nid, np);
  syncRawFromGraph();
  document.getElementById('modal-root').innerHTML = '';
  renderTree();
  openPersonModal(nid, true);
}

function syncRawFromGraph() {
  state.raw = { persons: [...state.graph.values()] };
}

async function doSave() {
  const token = prompt('GitHub токен (repo scope). Не сохраняется:');
  if (!token) return;
  try {
    const dataB64 = encodeData(state.raw);
    const files = buildCommitFiles(dataB64, state.newPhotos, CONFIG);
    await commitToGitHub(token, CONFIG, files, 'Update family data');
    state.newPhotos = [];
    alert('Сохранено в GitHub. Pages обновится через минуту.');
  } catch (e) {
    alert('Ошибка сохранения: ' + e.message);
  }
}

// ——— события topbar ———
document.getElementById('adminBtn').onclick = () => {
  if (state.admin) return;
  const pw = prompt('Пароль администратора:');
  if (pw && checkPassword(pw, CONFIG.passwordB64)) {
    state.admin = true;
    document.body.classList.add('admin');
    document.getElementById('saveBtn').hidden = false;
    alert('Режим редактирования включён.');
  } else if (pw !== null) {
    alert('Неверный пароль.');
  }
};
document.getElementById('saveBtn').onclick = doSave;
document.getElementById('kinshipBtn').onclick = () => {
  state.selected = [];
  document.body.classList.toggle('kinship-mode');
  alert(document.body.classList.contains('kinship-mode')
    ? 'Выбери две карточки.' : 'Режим родства выключен.');
};

await loadData();
renderTree();
