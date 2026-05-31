import { encodeData } from '../src/data.js';
import { writeFileSync } from 'node:fs';

// Каркас по схеме со стикеров (PDF). Только ФИО + связи; остальное — на сайте.
// Имена повторяются, поэтому id уникальные. status:'unknown' у всех.
// Связи best-effort — проверить и поправить при вводе данных.
const U = (id, fio, sex, rel = {}) => ({
  id, fio, sex, status: 'unknown',
  spouses: rel.spouses || [], children: rel.children || []
});

const persons = [
  // — Поколение 1: две верхние пары —
  U('zahar', 'Захар', 'm', { spouses: ['anna'],
    children: ['varvara', 'petr1', 'ivan1', 'pavel'] }),
  U('anna', 'Анна', 'f', { spouses: ['zahar'],
    children: ['varvara', 'petr1', 'ivan1', 'pavel'] }),
  U('vasilisa', 'Василиса', 'f', { spouses: ['petr_v'],
    children: ['pelagia', 'andrey', 'ivan2', 'petr2', 'evgenia'] }),
  U('petr_v', 'Пётр', 'm', { spouses: ['vasilisa'],
    children: ['pelagia', 'andrey', 'ivan2', 'petr2', 'evgenia'] }),

  // — Поколение 2 —
  U('varvara', 'Варвара', 'f'),
  U('petr1', 'Пётр', 'm'),
  U('ivan1', 'Иван', 'm'),
  // Павел ♥ Пелагия — брак, соединяющий обе семьи
  U('pavel', 'Павел', 'm', { spouses: ['pelagia'],
    children: ['viktor', 'vasya', 'nina', 'lyuba', 'olga', 'vera', 'aleksandr_z', 'mihail', 'vanya1'] }),
  U('pelagia', 'Пелагия', 'f', { spouses: ['pavel'],
    children: ['viktor', 'vasya', 'nina', 'lyuba', 'olga', 'vera', 'aleksandr_z', 'mihail', 'vanya1'] }),
  U('andrey', 'Андрей', 'm'),
  U('ivan2', 'Иван', 'm'),
  U('petr2', 'Пётр', 'm'),
  U('evgenia', 'Евгения', 'f'),

  // — Поколение 3: дети Павла ♥ Пелагии —
  U('viktor', 'Виктор', 'm', { spouses: ['ira_v'],
    children: ['katya1', 'vitya', 'oleg1', 'pavel2'] }),
  U('ira_v', 'Ира', 'f', { spouses: ['viktor'],
    children: ['katya1', 'vitya', 'oleg1', 'pavel2'] }),
  U('vasya', 'Вася', 'm'),
  U('nina', 'Нина', 'f'),
  U('lyuba', 'Люба', 'f'),
  U('olga', 'Ольга', 'f'),
  U('vera', 'Вера', 'f', { spouses: ['aleksey'],
    children: ['oleg2', 'yura', 'ira2', 'roma'] }),
  U('aleksey', 'Алексей Майорников', 'm', { spouses: ['vera'],
    children: ['oleg2', 'yura', 'ira2', 'roma'] }),
  U('aleksandr_z', 'Александр', 'm', { spouses: ['zinaida'], children: ['elena'] }),
  U('zinaida', 'Зинаида', 'f', { spouses: ['aleksandr_z'], children: ['elena'] }),
  U('mihail', 'Михаил', 'm', { spouses: ['lilya'], children: ['ira3', 'natasha'] }),
  U('lilya', 'Лиля', 'f', { spouses: ['mihail'], children: ['ira3', 'natasha'] }),
  U('vanya1', 'Ваня', 'm'),

  // — Поколение 4: дети Виктора ♥ Иры —
  U('katya1', 'Катя', 'f', { spouses: ['misha'], children: ['aleksandr_o'] }),
  U('misha', 'Миша', 'm', { spouses: ['katya1'], children: ['aleksandr_o'] }),
  U('vitya', 'Витя', 'm'),
  U('oleg1', 'Олег', 'm', { spouses: ['larisa'], children: ['dima', 'dasha'] }),
  U('larisa', 'Лариса', 'f', { spouses: ['oleg1'], children: ['dima', 'dasha'] }),
  U('pavel2', 'Павел', 'm', { spouses: ['inna'], children: ['anton', 'danya'] }),
  U('inna', 'Инна', 'f', { spouses: ['pavel2'], children: ['anton', 'danya'] }),

  // — дети Веры ♥ Алексея —
  U('oleg2', 'Олег', 'm'),
  U('yura', 'Юра', 'm'),
  U('ira2', 'Ира', 'f'),
  U('roma', 'Рома', 'm'),

  // — Александр ♥ Зинаида → Елена; Елена ♥ Сергей → Герка —
  U('elena', 'Елена', 'f', { spouses: ['sergey'], children: ['gerka'] }),
  U('sergey', 'Сергей', 'm', { spouses: ['elena'], children: ['gerka'] }),
  U('gerka', 'Георгий (Герка из Полковой горы)', 'm'),

  // — дети Михаила ♥ Лили —
  U('ira3', 'Ира', 'f'),
  U('natasha', 'Наташа', 'f'),

  // — Поколение 5 —
  U('aleksandr_o', 'Александр', 'm'),
  U('dima', 'Дима', 'm', { spouses: ['katya2'], children: ['diana', 'vanya2'] }),
  U('katya2', 'Катя', 'f', { spouses: ['dima'], children: ['diana', 'vanya2'] }),
  U('dasha', 'Даша', 'f', { spouses: ['denis'], children: ['polina'] }),
  U('denis', 'Денис', 'm', { spouses: ['dasha'], children: ['polina'] }),
  U('anton', 'Антон', 'm'),
  U('danya', 'Даня', 'm'),

  // — Поколение 6 —
  U('diana', 'Диана', 'f'),
  U('vanya2', 'Ваня', 'm'),
  U('polina', 'Полина', 'f')
];

writeFileSync(new URL('../data.json', import.meta.url), encodeData({ persons }));
console.log('data.json создан:', persons.length, 'персон');
