import { encodeData } from '../src/data.js';
import { writeFileSync } from 'node:fs';

// Каркас по схеме со стикеров (PDF) + правки families от владельца.
// Только ФИО + связи; остальное заполняется на сайте. status:'unknown'.
// ВАЖНО: повторяющиеся имена — РАЗНЫЕ люди (id уникальны, по имени не сливать).
// Оба супруга дублируют children, чтобы buildGraph проставил обоих родителями.
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
  // Павел (сын Захара) ♥ Пелагия (дочь Василисы) — брак, соединяющий обе семьи.
  // Дети: Ира, Вера, Александр, Михаил.
  U('pavel', 'Павел', 'm', { spouses: ['pelagia'],
    children: ['ira', 'vera', 'aleksandr_z', 'mihail'] }),
  U('pelagia', 'Пелагия', 'f', { spouses: ['pavel'],
    children: ['ira', 'vera', 'aleksandr_z', 'mihail'] }),
  U('andrey', 'Андрей', 'm'),
  U('ivan2', 'Иван', 'm'),
  U('petr2', 'Пётр', 'm'),
  U('evgenia', 'Евгения', 'f'),

  // — Поколение 3: дети Павла+Пелагии —
  U('ira', 'Ира', 'f', { spouses: ['viktor'],
    children: ['vitya', 'larisa', 'pavel_jr'] }),
  U('vera', 'Вера', 'f', { spouses: ['aleksey'],
    children: ['oleg_v', 'yura'] }),
  U('aleksandr_z', 'Александр', 'm', { spouses: ['zinaida'],
    children: ['elena', 'gerka'] }),
  U('mihail', 'Михаил', 'm', { spouses: ['lilya'],
    children: ['ira_ml', 'natasha'] }),

  // — Семья Виктора (orange-кластер): вошла через брак Виктор♥Ира.
  // Виктор, Вася, Нина, Люба, Ольга — родные siblings (дети Александра+Матрёны).
  U('aleksandr_m', 'Александр', 'm', { spouses: ['matrena'],
    children: ['viktor', 'nina', 'lyuba', 'olga'] }),
  U('matrena', 'Матрёна', 'f', { spouses: ['aleksandr_m'],
    children: ['viktor', 'nina', 'lyuba', 'olga'] }),
  U('viktor', 'Виктор', 'm', { spouses: ['ira'],
    children: ['vitya', 'larisa', 'pavel_jr'] }),
  // Нина (дочь Александра+Матрёны) ♥ Вася → Катя, Миша, Александр.
  // Вася вошёл по браку (НЕ брат Виктора). Бывший «остров» подключён через Нину.
  U('nina', 'Нина', 'f', { spouses: ['vasya'],
    children: ['katya_o', 'misha', 'aleksandr_o'] }),
  U('vasya', 'Вася', 'm', { spouses: ['nina'],
    children: ['katya_o', 'misha', 'aleksandr_o'] }),
  U('lyuba', 'Люба', 'f'),
  U('olga', 'Ольга', 'f'),

  // — Поколение 4: дети Виктора ♥ Иры —
  // Олег — отдельный человек (НЕ сын Веры), вошёл через брак с Ларисой.
  U('vitya', 'Витя', 'm'),
  U('larisa', 'Лариса', 'f', { spouses: ['oleg'], children: ['katya', 'dasha'] }),
  U('pavel_jr', 'Павел', 'm', { spouses: ['inna'], children: ['anton', 'danya'] }),
  U('oleg', 'Олег', 'm', { spouses: ['larisa'], children: ['katya', 'dasha'] }),
  U('inna', 'Инна', 'f', { spouses: ['pavel_jr'], children: ['anton', 'danya'] }),
  U('anton', 'Антон', 'm'),
  U('danya', 'Даня', 'm'),

  // — Дети Веры ♥ Алексея —
  U('aleksey', 'Алексей Майорников', 'm', { spouses: ['vera'],
    children: ['oleg_v', 'yura'] }),
  U('oleg_v', 'Олег', 'm'),
  // Юра ♥ Ира → Рома. Ира — жена (вошла по браку), НЕ сестра Юры.
  U('yura', 'Юра', 'm', { spouses: ['ira_v2'], children: ['roma_m'] }),
  U('ira_v2', 'Ира', 'f', { spouses: ['yura'], children: ['roma_m'] }),
  U('roma_m', 'Рома', 'm'),

  // — Александр ♥ Зинаида → Елена, Герка; Сергей ♥ Елена → Рома —
  U('zinaida', 'Зинаида', 'f', { spouses: ['aleksandr_z'],
    children: ['elena', 'gerka'] }),
  U('elena', 'Елена', 'f', { spouses: ['serezha'], children: ['roma'] }),
  U('serezha', 'Сергей', 'm', { spouses: ['elena'], children: ['roma'] }),
  U('roma', 'Рома', 'm'),
  U('gerka', 'Георгий (Герка из Полковой горы)', 'm'),

  // — Михаил ♥ Лиля → Ира, Наташа —
  U('lilya', 'Лиля', 'f', { spouses: ['mihail'], children: ['ira_ml', 'natasha'] }),
  U('ira_ml', 'Ира', 'f'),
  U('natasha', 'Наташа', 'f'),

  // — Поколение 5: дети Олега ♥ Ларисы —
  U('katya', 'Катя', 'f', { spouses: ['dima'], children: ['diana', 'vanya'] }),
  U('dasha', 'Даша', 'f', { spouses: ['denis'], children: ['polina'] }),
  U('dima', 'Дима', 'm', { spouses: ['katya'], children: ['diana', 'vanya'] }),
  U('denis', 'Денис', 'm', { spouses: ['dasha'], children: ['polina'] }),
  U('diana', 'Диана', 'f'),
  U('vanya', 'Ваня', 'm'),
  U('polina', 'Полина', 'f'),

  // — Дети Нины ♥ Васи: Катя, Миша, Александр (родные siblings) —
  U('katya_o', 'Катя', 'f'),
  U('misha', 'Миша', 'm'),
  U('aleksandr_o', 'Александр', 'm')
];

writeFileSync(new URL('../public/data.json', import.meta.url), encodeData({ persons }));
console.log('data.json создан:', persons.length, 'персон');
