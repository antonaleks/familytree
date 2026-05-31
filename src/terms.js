// Определения и ссылки для пояснений в UI.
export const SOURCE = {
  gramota: 'https://gramota.ru/journal/stati/zhizn-yazyka/terminy-rodstva-i-svoystva-v-russkom-yazyke',
  wiki: 'https://ru.wikipedia.org/wiki/Свойство_(родство)'
};

// term: { def: пояснение, src: ссылка }
export const TERMS = {
  'отец':        { def: 'Родитель мужского пола.', src: SOURCE.gramota },
  'мать':        { def: 'Родитель женского пола.', src: SOURCE.gramota },
  'сын':         { def: 'Ребёнок мужского пола.', src: SOURCE.gramota },
  'дочь':        { def: 'Ребёнок женского пола.', src: SOURCE.gramota },
  'брат':        { def: 'Сын тех же родителей.', src: SOURCE.gramota },
  'сестра':      { def: 'Дочь тех же родителей.', src: SOURCE.gramota },
  'дед':         { def: 'Отец родителя.', src: SOURCE.gramota },
  'бабушка':     { def: 'Мать родителя.', src: SOURCE.gramota },
  'внук':        { def: 'Сын ребёнка.', src: SOURCE.gramota },
  'внучка':      { def: 'Дочь ребёнка.', src: SOURCE.gramota },
  'дядя':        { def: 'Брат родителя.', src: SOURCE.gramota },
  'тётя':        { def: 'Сестра родителя.', src: SOURCE.gramota },
  'племянник':   { def: 'Сын брата или сестры.', src: SOURCE.gramota },
  'племянница':  { def: 'Дочь брата или сестры.', src: SOURCE.gramota },
  'двоюродный брат':   { def: 'Сын дяди или тёти.', src: SOURCE.gramota },
  'двоюродная сестра': { def: 'Дочь дяди или тёти.', src: SOURCE.gramota },
  'муж':   { def: 'Супруг.', src: SOURCE.gramota },
  'жена':  { def: 'Супруга.', src: SOURCE.gramota },
  // свойство (по браку):
  'тесть':       { def: 'Отец жены.', src: SOURCE.wiki },
  'тёща':        { def: 'Мать жены.', src: SOURCE.wiki },
  'свёкор':      { def: 'Отец мужа.', src: SOURCE.wiki },
  'свекровь':    { def: 'Мать мужа.', src: SOURCE.wiki },
  'зять':        { def: 'Муж дочери (или сестры).', src: SOURCE.wiki },
  'невестка':    { def: 'Жена сына (или жена брата).', src: SOURCE.wiki },
  'сноха':       { def: 'Жена сына по отношению к его отцу.', src: SOURCE.wiki },
  'шурин':       { def: 'Брат жены.', src: SOURCE.wiki },
  'свояченица':  { def: 'Сестра жены.', src: SOURCE.wiki },
  'свояк':       { def: 'Муж свояченицы (муж сестры жены).', src: SOURCE.wiki },
  'деверь':      { def: 'Брат мужа.', src: SOURCE.wiki },
  'золовка':     { def: 'Сестра мужа.', src: SOURCE.wiki },
  'сват':        { def: 'Отец зятя или невестки.', src: SOURCE.wiki },
  'сватья':      { def: 'Мать зятя или невестки.', src: SOURCE.wiki }
};

// Список терминов, считающихся "сложными" — для них в UI показываем пояснение.
export const COMPLEX = new Set([
  'тесть','тёща','свёкор','свекровь','зять','невестка','сноха','шурин',
  'свояченица','свояк','деверь','золовка','сват','сватья'
]);
