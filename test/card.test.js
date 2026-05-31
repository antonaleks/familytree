import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderCardHTML } from '../src/card.js';

const dead = { id:'1', fio:'Анна Захаровна', sex:'f', birthYear:1901, deathYear:1978,
  status:'deceased', nationality:'Русская', birthPlace:'с. Покровское',
  bio:'Мать восьмерых.', restPlace:'Покровское кладбище',
  restMapUrl:'https://yandex.ru/maps/?text=x' };
const alive = { id:'2', fio:'Катя', sex:'f', birthYear:1992, status:'alive',
  contacts:'tg: @katya' };

test('упокоенная: показывает годы, статус, ссылку на карту', () => {
  const h = renderCardHTML(dead);
  assert.match(h, /Анна Захаровна/);
  assert.match(h, /1901/); assert.match(h, /1978/);
  assert.match(h, /Упокоена/i);
  assert.match(h, /yandex\.ru\/maps/);
});
test('живая: показывает контакты, без ссылки на карту', () => {
  const h = renderCardHTML(alive);
  assert.match(h, /@katya/);
  assert.doesNotMatch(h, /yandex\.ru\/maps/);
});
test('нет фото: силуэт по полу (f => женский)', () => {
  const h = renderCardHTML(alive);
  assert.match(h, /silhouette-f|👩|&#128105;/);
});
test('пустые поля: всё равно показываем строки с «—»', () => {
  const empty = { id:'3', fio:'Иван', status:'unknown' };
  const h = renderCardHTML(empty);
  assert.match(h, /Национальность/);
  assert.match(h, /Место рожд\./);
  assert.match(h, /—/);
});
test('фото-имя файла => относительный путь photos/', () => {
  const h = renderCardHTML({ id:'1', fio:'Иван', status:'alive', photo:'1.jpg' });
  assert.match(h, /src="photos\/1\.jpg"/);
});
test('фото-абсолютный URL => используется как есть', () => {
  const url = 'https://x.supabase.co/storage/v1/object/public/photos/1.jpg';
  const h = renderCardHTML({ id:'1', fio:'Иван', status:'alive', photo:url });
  assert.match(h, new RegExp(`src="${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
});
