// Fitness App. Разделы переключаются по адресу (#today, #strength, ...),
// поэтому кнопка «назад» и обновление страницы работают как ожидается.

(function () {
  'use strict';

  var STORAGE_KEY = 'fitness-app:v1';

  // Разделы нижней панели
  var SCREENS = {
    today: 'Сегодня',
    progress: 'Прогресс',
    profile: 'Профиль'
  };

  // Разделы тренировок: открываются плитками с главного экрана
  var SECTIONS = {
    strength: 'Силовые',
    core: 'Кор',
    stretch: 'Растяжка'
  };

  var PLACE_NAMES = { home: 'дом', gym: 'зал' };

  var DATA = window.FITNESS_DATA;

  // Что измеряем. Порядок здесь = порядок в анкете и в «Прогрессе».
  var METRICS = [
    { key: 'weight', label: 'Вес', unit: 'кг', hint: 'утром, натощак', min: 30, max: 250 },
    { key: 'waist', label: 'Талия', unit: 'см', hint: 'самое узкое место', min: 40, max: 200 },
    { key: 'belly', label: 'Живот', unit: 'см', hint: 'на уровне пупка', min: 40, max: 200 },
    { key: 'chest', label: 'Грудь', unit: 'см', hint: 'по соскам, на выдохе', min: 50, max: 200 },
    { key: 'hips', label: 'Бёдра', unit: 'см', hint: 'по самой широкой части ягодиц', min: 50, max: 200 },
    { key: 'thigh', label: 'Бедро', unit: 'см', hint: 'одна нога, под ягодицей', min: 20, max: 120 },
    { key: 'biceps', label: 'Бицепс', unit: 'см', hint: 'напряжённый, самое широкое место', min: 15, max: 70 },
    { key: 'neck', label: 'Шея', unit: 'см', hint: 'под кадыком', min: 20, max: 70 }
  ];

  var PROFILE_FIELDS = [
    { key: 'height', label: 'Рост', unit: 'см', min: 100, max: 230 },
    { key: 'age', label: 'Возраст', unit: 'лет', min: 10, max: 100 }
  ];

  // Как часто приложение просит обновлять замеры, в днях
  var WEIGHT_EVERY = 7;
  var BODY_EVERY = 14;

  var MONTHS = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
  ];

  // Стартовое состояние нового Игрока. Формулы опыта появятся вместе с квестами.
  var DEFAULT_STATE = {
    player: { name: 'Ожгибон', level: 1, rank: 'E', xp: 0 },
    profile: null, // { height, age } после анкеты
    measurements: [], // { id, date: 'ГГГГ-ММ-ДД', weight, waist, ... }
    place: 'home',
    trainTab: 'plan',
    nextWorkout: 0, // больше не используется: очередь считается по истории тренировок
    workouts: [], // { id, date, place, workoutId, startedAt, finishedAt, complete, total, items }
    session: null, // тренировка, которая идёт сейчас
    core: [], // сделанные тренировки кора: { id, date, n, doneAt }
    stretch: [], // сделанные растяжки: { id, date, routine, doneAt }
    corePick: null, // кор, выбранный вручную на сегодня: { date, n }
    restPref: {}, // свой отдых по упражнениям, секунды: { Barbell_Squat: 150 }
    coreFolder: null, // ссылка на папку курса кора на Яндекс Диске, только на этом устройстве
    theme: 'auto', // 'auto' — как в системе, 'light', 'dark'
    seenXp: null, // сколько опыта Игрок уже видел на горе: разницу гора проигрывает подъёмом
    seenBadges: null, // ачивки, о которых уже сказали
    seeded: {} // какие разовые записи уже добавлены
  };

  // Отдых меняется кнопками по 15 секунд, от 15 секунд до 5 минут
  var REST_STEP = 15;
  var REST_MIN = 15;
  var REST_MAX = 300;

  // ---------- Хранилище ----------

  function loadState() {
    var saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch (error) {
      saved = null;
    }
    var state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    if (saved && typeof saved === 'object') {
      if (saved.player && typeof saved.player === 'object') {
        Object.assign(state.player, saved.player);
      }
      if (saved.profile && typeof saved.profile === 'object') state.profile = saved.profile;
      if (Array.isArray(saved.measurements)) {
        state.measurements = saved.measurements.filter(function (entry) {
          return entry && typeof entry.date === 'string';
        });
      }
      if (PLACE_NAMES[saved.place]) state.place = saved.place;
      if (saved.trainTab === 'plan' || saved.trainTab === 'exercises') state.trainTab = saved.trainTab;
      if (saved.nextWorkout >= 0) state.nextWorkout = Math.floor(saved.nextWorkout);
      if (Array.isArray(saved.workouts)) {
        state.workouts = saved.workouts.filter(function (entry) {
          return entry && typeof entry.date === 'string' && Array.isArray(entry.items);
        });
      }
      if (saved.seeded && typeof saved.seeded === 'object') state.seeded = saved.seeded;
      if (Array.isArray(saved.core)) {
        state.core = saved.core.filter(function (entry) {
          return entry && typeof entry.date === 'string' && typeof entry.n === 'number';
        });
      }
      if (Array.isArray(saved.stretch)) {
        state.stretch = saved.stretch.filter(function (entry) {
          return entry && typeof entry.date === 'string' && typeof entry.routine === 'string';
        });
      }
      if (saved.theme === 'light' || saved.theme === 'dark') state.theme = saved.theme;
      if (saved.corePick && typeof saved.corePick.n === 'number') state.corePick = saved.corePick;
      if (saved.restPref && typeof saved.restPref === 'object') state.restPref = saved.restPref;
      if (typeof saved.coreFolder === 'string' && isDiskLink(saved.coreFolder)) state.coreFolder = saved.coreFolder;
      if (typeof saved.seenXp === 'number') state.seenXp = saved.seenXp;
      if (Array.isArray(saved.seenBadges)) state.seenBadges = saved.seenBadges;
      var session = saved.session;
      var planned = session && findWorkout(session.place, session.workoutId);
      // Незаконченная тренировка переживает перезагрузку, если программа не поменялась
      if (planned && Array.isArray(session.items) && session.items.length === planned.items.length) {
        state.session = session;
      }
    }
    return state;
  }

  // Публичная ссылка на Яндекс Диск: disk.yandex.ru/d/…, disk.yandex.com/d/… или yadi.sk/d/…
  function isDiskLink(text) {
    return /^https:\/\/(disk\.yandex\.(ru|com|by|kz)|yadi\.sk)\/(d|i)\/[\w-]+\/?$/.test(text);
  }

  function findWorkout(place, id) {
    var program = DATA.programs[place];
    if (!program) return null;
    return (
      program.workouts.filter(function (workout) {
        return workout.id === id;
      })[0] || null
    );
  }

  // Название тренировки для людей: «Тренировка A» дома, «Грудь + бицепс» в зале
  function workoutLabel(place, id) {
    if (place === 'gym') {
      var workout = findWorkout('gym', id);
      return workout ? workout.title : 'Тренировка в зале';
    }
    return 'Тренировка ' + id;
  }

  // Коротко для календаря и опыта: «силовая A» или «грудь + бицепс»
  function workoutShort(place, id) {
    return place === 'gym' ? workoutLabel(place, id).toLowerCase() : 'силовая ' + id;
  }

  // Где Игрок в программе зала. Очередь двигают только тренировки, сделанные целиком.
  // n — сколько тренировок в зале сделано, блок меняется каждые blockSize тренировок.
  function gymState() {
    var gym = DATA.programs.gym;
    var n = state.workouts.filter(function (record) {
      return record.place === 'gym' && record.complete;
    }).length;
    var cycle = gym.blocks.length * gym.blockSize;
    var blockIndex = Math.floor((n % cycle) / gym.blockSize);
    var block = gym.blocks[blockIndex];
    var day = gym.rotation[n % gym.rotation.length];
    return {
      n: n,
      lap: Math.floor(n / cycle) + 1,
      block: block,
      blockIndex: blockIndex,
      inBlock: n % gym.blockSize,
      workout: findWorkout('gym', block.n + '-' + day)
    };
  }

  // Следующая тренировка по месту
  function nextPlanned(place) {
    if (place === 'gym') return gymState().workout;
    var program = DATA.programs.home;
    return program.workouts[nextWorkoutIndex() % program.workouts.length];
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      // Хранилище недоступно (например, приватный режим): работаем без сохранения
      return false;
    }
  }

  var state = loadState();

  // 26 октября 2026 Игрок попросил начать с чистого листа перед залом:
  // один раз стираем замеры и все тренировки. Анкета и тема остаются.
  if (!state.seeded.cleanStart) {
    state.seeded.cleanStart = true;
    state.measurements = [];
    state.workouts = [];
    state.core = [];
    state.stretch = [];
    state.session = null;
    state.corePick = null;
    state.restPref = {};
    state.seenXp = null;
    state.seenBadges = null;
    state.place = 'gym';
    saveState();
  }

  // Отдых истёк, пока приложение было закрыто: сигнал уже не нужен
  if (state.session && state.session.rest && state.session.rest.endsAt <= Date.now()) {
    state.session.rest.over = true;
  }

  // ---------- Даты и числа ----------

  function isoDate(date) {
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    return date.getFullYear() + '-' + month + '-' + day;
  }

  function todayIso() {
    return isoDate(new Date());
  }

  function parseIso(iso) {
    var parts = iso.split('-').map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function addDays(iso, days) {
    var date = parseIso(iso);
    date.setDate(date.getDate() + days);
    return isoDate(date);
  }

  // «1 октября», а для другого года — «1 октября 2025»
  function formatDate(iso) {
    var date = parseIso(iso);
    var text = date.getDate() + ' ' + MONTHS[date.getMonth()];
    if (date.getFullYear() !== new Date().getFullYear()) text += ' ' + date.getFullYear();
    return text;
  }

  // 71.65 → «71,65», 87 → «87»
  function formatNum(value) {
    return String(Math.round(value * 100) / 100).replace('.', ',');
  }

  function formatDelta(value) {
    var rounded = Math.round(value * 100) / 100;
    if (rounded === 0) return 'без изменений';
    return (rounded > 0 ? '+' : '−') + formatNum(Math.abs(rounded));
  }

  // Понимает и «71,65», и «71.65». Пустая строка → null, мусор → NaN.
  function parseNum(text) {
    var clean = String(text).trim().replace(',', '.');
    if (clean === '') return null;
    if (!/^\d+(\.\d{1,2})?$/.test(clean)) return NaN;
    return Number(clean);
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }

  // ---------- Замеры: выборки ----------

  // От старых к новым
  function sortedMeasurements() {
    return state.measurements.slice().sort(function (a, b) {
      return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
    });
  }

  function hasValue(entry, key) {
    return typeof entry[key] === 'number' && !isNaN(entry[key]);
  }

  // Первая и последняя запись, где этот показатель заполнен
  function metricRange(key) {
    var withValue = sortedMeasurements().filter(function (entry) {
      return hasValue(entry, key);
    });
    if (!withValue.length) return null;
    return { first: withValue[0], last: withValue[withValue.length - 1], count: withValue.length };
  }

  function lastDateWith(keys) {
    var list = sortedMeasurements().filter(function (entry) {
      return keys.some(function (key) {
        return hasValue(entry, key);
      });
    });
    return list.length ? list[list.length - 1].date : null;
  }

  var BODY_KEYS = METRICS.filter(function (metric) {
    return metric.key !== 'weight';
  }).map(function (metric) {
    return metric.key;
  });

  // Когда пора делать следующие замеры
  function schedule() {
    var weightDate = lastDateWith(['weight']);
    var bodyDate = lastDateWith(BODY_KEYS);
    var today = todayIso();
    var weightDue = weightDate ? addDays(weightDate, WEIGHT_EVERY) : null;
    var bodyDue = bodyDate ? addDays(bodyDate, BODY_EVERY) : null;
    return {
      weightDue: weightDue,
      bodyDue: bodyDue,
      weightNow: !weightDue || weightDue <= today,
      bodyNow: !bodyDue || bodyDue <= today
    };
  }

  // ---------- Строки «подпись — значение» ----------

  function row(label, value, empty) {
    return (
      '<div class="row"><dt>' + escapeHtml(label) + '</dt><dd' +
      (empty ? ' class="is-empty"' : ' class="num"') + '>' + value + '</dd></div>'
    );
  }

  function metricValue(key) {
    var metric = METRICS.filter(function (item) {
      return item.key === key;
    })[0];
    var range = metricRange(key);
    if (!range) return null;
    return formatNum(range.last[key]) + ' ' + metric.unit;
  }

  // ---------- Опыт, ранги, серии ----------

  // Опыт даётся только за сделанную работу. Считается заново из истории,
  // поэтому старые тренировки тоже засчитаны, а удалённая запись забирает свой опыт.
  var XP = {
    strength: 100, // силовая целиком; не целиком — доля по сделанным подходам
    core: 40,
    stretch: 30,
    streak3: 50, // третий день подряд с любой тренировкой
    streak7: 150 // каждый седьмой день подряд
  };

  // Ранги растут медленно: при 3–4 силовых, ежедневном коре и растяжке
  // выходит около 900 опыта в неделю, и до S примерно год.
  var RANKS = [
    { id: 'E', xp: 0, name: 'Подножие' },
    { id: 'D', xp: 3500, name: 'Первый лагерь' },
    { id: 'C', xp: 11000, name: 'Второй лагерь' },
    { id: 'B', xp: 23000, name: 'Перевал' },
    { id: 'A', xp: 35000, name: 'Гребень' },
    { id: 'S', xp: 47000, name: 'Вершина' }
  ];

  var LEVEL_XP = 500;

  // Все начисления по датам: { date, xp, kind, text }
  function xpEvents() {
    var events = [];
    state.workouts.forEach(function (record) {
      var done = doneSets(record);
      if (!done) return;
      var xp = record.complete ? XP.strength : Math.round((XP.strength * done) / record.total);
      events.push({
        date: record.date,
        xp: xp,
        kind: 'strength',
        text: capitalize(workoutShort(record.place, record.workoutId)) + (record.complete ? '' : ', не целиком')
      });
    });
    state.core.forEach(function (record) {
      events.push({ date: record.date, xp: XP.core, kind: 'core', text: 'Кор, тренировка ' + record.n });
    });
    var stretchDays = {};
    state.stretch.forEach(function (record) {
      // Растяжка даёт опыт один раз в день, сколько комплексов ни сделай
      if (stretchDays[record.date]) return;
      stretchDays[record.date] = true;
      var routine = stretchRoutine(record.routine);
      events.push({
        date: record.date,
        xp: XP.stretch,
        kind: 'stretch',
        text: 'Растяжка' + (routine ? ': ' + routine.title.toLowerCase() : '')
      });
    });

    // Бонусы за серию: день считается, если в нём была хоть одна тренировка
    var days = activeDays();
    var run = 0;
    days.forEach(function (iso, index) {
      run = index > 0 && daysBetween(days[index - 1], iso) === 1 ? run + 1 : 1;
      if (run === 3) events.push({ date: iso, xp: XP.streak3, kind: 'streak', text: 'Серия: 3 дня подряд' });
      if (run >= 7 && run % 7 === 0) {
        events.push({ date: iso, xp: XP.streak7, kind: 'streak', text: 'Серия: ' + run + ' дней подряд' });
      }
    });
    return events;
  }

  // Дни, когда была хоть одна тренировка, по возрастанию
  function activeDays() {
    var seen = {};
    state.workouts.forEach(function (record) {
      if (doneSets(record)) seen[record.date] = true;
    });
    state.core.forEach(function (record) {
      seen[record.date] = true;
    });
    state.stretch.forEach(function (record) {
      seen[record.date] = true;
    });
    return Object.keys(seen).sort();
  }

  function totalXp() {
    return xpEvents().reduce(function (sum, event) {
      return sum + event.xp;
    }, 0);
  }

  // Ранг, уровень и доля пути до следующего ранга
  function rankInfo(xp) {
    var index = 0;
    RANKS.forEach(function (rank, at) {
      if (xp >= rank.xp) index = at;
    });
    var rank = RANKS[index];
    var next = RANKS[index + 1] || null;
    return {
      index: index,
      rank: rank,
      next: next,
      level: 1 + Math.floor(xp / LEVEL_XP),
      share: next ? (xp - rank.xp) / (next.xp - rank.xp) : 1,
      left: next ? next.xp - xp : 0
    };
  }

  // Серия: сколько дней подряд с тренировкой. Если сегодня ещё ничего не было,
  // серия жива до конца дня и считается по вчера.
  function streakInfo() {
    var days = activeDays();
    var today = todayIso();
    var set = {};
    days.forEach(function (iso) {
      set[iso] = true;
    });
    var from = set[today] ? today : addDays(today, -1);
    var count = 0;
    while (set[addDays(from, -count)]) count += 1;
    return { days: count, today: !!set[today] };
  }

  // ---------- Ачивки ----------

  // Всё считается из истории: ачивку нельзя получить нажатием, только работой
  function gameStats() {
    var full = state.workouts.filter(function (record) {
      return record.complete;
    });

    // Самая длинная серия дней подряд
    var days = activeDays();
    var best = 0;
    var run = 0;
    days.forEach(function (iso, index) {
      run = index > 0 && daysBetween(days[index - 1], iso) === 1 ? run + 1 : 1;
      best = Math.max(best, run);
    });

    // Лучшая неделя по силовым целиком
    var weeks = {};
    full.forEach(function (record) {
      var monday = mondayOf(record.date);
      weeks[monday] = (weeks[monday] || 0) + 1;
    });
    var bestWeek = Object.keys(weeks).reduce(function (max, key) {
      return Math.max(max, weeks[key]);
    }, 0);

    // Рекорд: в каком-то упражнении рабочий вес вырос относительно первого раза
    var record = liftIds().some(function (id) {
      var series = liftSeries(id);
      var first = series[0];
      return series.some(function (point) {
        return point.unit === first.unit && point.value > first.value;
      });
    });

    // Полный круг кора: все 13 разных тренировок в одном круге
    var fullCircle = false;
    var circle = {};
    coreSorted().forEach(function (item) {
      if (circle[item.n]) circle = {};
      circle[item.n] = true;
      if (Object.keys(circle).length === CORE.videos.length) fullCircle = true;
    });

    var routines = {};
    state.stretch.forEach(function (item) {
      if (String(item.routine).indexOf('cool-') === 0) return; // заминки не комплексы
      routines[item.routine] = true;
    });

    var measures = sortedMeasurements();
    var span = measures.length > 1 ? daysBetween(measures[0].date, measures[measures.length - 1].date) : 0;
    var waist = metricRange('waist');

    return {
      any: days.length,
      full: full.length,
      core: state.core.length,
      stretch: state.stretch.length,
      routines: Object.keys(routines).length,
      streak: best,
      bestWeek: bestWeek,
      record: record,
      fullCircle: fullCircle,
      measures: measures.length,
      span: span,
      waistDrop: waist && waist.count > 1 ? waist.first.waist - waist.last.waist : 0,
      rank: rankInfo(totalXp()).index
    };
  }

  // glyph — короткая надпись на медали; have/need — для полоски прогресса
  function achievements() {
    var s = gameStats();
    function count(id, glyph, name, how, have, need) {
      return { id: id, glyph: glyph, name: name, how: how, have: Math.min(have, need), need: need, done: have >= need };
    }
    function flag(id, glyph, name, how, done) {
      return { id: id, glyph: glyph, name: name, how: how, have: done ? 1 : 0, need: 1, done: done };
    }
    return [
      count('first', '1', 'Первый шаг', 'Любая тренировка', s.any, 1),
      count('strength1', 'A', 'Первая силовая', 'Силовая целиком', s.full, 1),
      count('strength10', '10', 'Десятка', '10 силовых целиком', s.full, 10),
      count('strength25', '25', 'Четверть сотни', '25 силовых целиком', s.full, 25),
      count('strength50', '50', 'Полсотни', '50 силовых целиком', s.full, 50),
      count('week3', '3×', 'Неделя по плану', '3 силовые за одну неделю', s.bestWeek, 3),
      flag('record', '↑', 'Рекорд', 'Рабочий вес выше, чем в первый раз', s.record),
      count('core10', '10', 'Крепкий кор', '10 тренировок кора', s.core, 10),
      flag('coreCircle', '13', 'Полный круг', 'Все 13 тренировок кора в одном круге', s.fullCircle),
      count('core50', '50', 'Стальной кор', '50 тренировок кора', s.core, 50),
      count('stretch1', '~', 'Первая растяжка', 'Растяжка до конца', s.stretch, 1),
      count('stretchAll', '3', 'Все комплексы', 'Утро, всё тело и спина', s.routines, 3),
      count('stretch20', '20', 'Гибкость', '20 растяжек', s.stretch, 20),
      count('streak3', '3д', 'Разгон', '3 дня подряд', s.streak, 3),
      count('streak7', '7д', 'Неделя без пропусков', '7 дней подряд', s.streak, 7),
      count('streak30', '30д', 'Месяц без пропусков', '30 дней подряд', s.streak, 30),
      count('measure', '◎', 'Точка отсчёта', 'Первый замер', s.measures, 1),
      count('measureMonth', '30', 'Месяц замеров', 'Замеры с разницей в 30 дней', s.span, 30),
      count('waist2', '−2', 'Минус 2 см', 'Талия на 2 см меньше старта', s.waistDrop, 2),
      flag('rankD', 'D', 'Первый лагерь', 'Ранг D', s.rank >= 1),
      flag('rankB', 'B', 'Перевал', 'Ранг B', s.rank >= 3),
      flag('rankS', 'S', 'Вершина', 'Ранг S', s.rank >= 5)
    ];
  }

  // Полученные сначала, дальше — те, что ближе всего
  function badgeGrid(badges) {
    var ordered = badges.slice().sort(function (a, b) {
      if (a.done !== b.done) return a.done ? -1 : 1;
      return b.have / b.need - a.have / a.need;
    });
    return (
      '<ul class="badges">' +
      ordered.map(function (badge) {
        var share = badge.need ? badge.have / badge.need : 0;
        return (
          '<li class="badge' + (badge.done ? ' is-done' : '') + '">' +
          '<span class="badge-medal num" aria-hidden="true" style="--share:' + share.toFixed(3) + '">' +
          '<span>' + badge.glyph + '</span></span>' +
          '<span class="badge-name">' + badge.name + '</span>' +
          '<span class="badge-how num">' +
          (badge.done ? badge.how : badge.need > 1 ? formatNum(Math.max(0, badge.have)) + ' из ' + badge.need : badge.how) +
          '</span>' +
          '<span class="sr-only">' + (badge.done ? 'получена' : 'ещё не получена') + '</span></li>'
        );
      }).join('') +
      '</ul>'
    );
  }

  // Новые ранги и ачивки с прошлого раза: главный экран показывает их всплывашкой
  function newsSinceSeen() {
    var earned = achievements().filter(function (badge) {
      return badge.done;
    }).map(function (badge) {
      return badge;
    });
    var seen = state.seenBadges;
    // Первый запуск новой версии: всё, что уже есть, считается увиденным, чтобы не засыпать всплывашками
    if (!Array.isArray(seen)) {
      state.seenBadges = earned.map(function (badge) {
        return badge.id;
      });
      saveState();
      return [];
    }
    var fresh = earned.filter(function (badge) {
      return seen.indexOf(badge.id) === -1;
    });
    if (fresh.length) {
      state.seenBadges = seen.concat(fresh.map(function (badge) {
        return badge.id;
      }));
      saveState();
    }
    return fresh;
  }

  var toastTimer = null;

  function showToasts(items) {
    var box = document.getElementById('toasts');
    if (!box || !items.length) return;
    // Больше трёх сразу не помещается: две плюс сводка
    if (items.length > 3) {
      var more = items.length - 2;
      items = items.slice(0, 2).concat([{
        glyph: '+' + more,
        title: 'И ещё ' + more + ' ' + plural(more, 'ачивка', 'ачивки', 'ачивок'),
        text: 'Все в разделе «Прогресс»'
      }]);
    }
    box.innerHTML = items.map(function (item) {
      return (
        '<div class="toast"><span class="badge-medal num" aria-hidden="true" style="--share:1"><span>' + item.glyph +
        '</span></span><span class="toast-text"><b>' + escapeHtml(item.title) + '</b><span>' + escapeHtml(item.text) +
        '</span></span></div>'
      );
    }).join('');
    box.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      box.classList.add('is-leaving');
      setTimeout(function () {
        box.hidden = true;
        box.classList.remove('is-leaving');
      }, 500);
    }, 5200);
  }

  // ---------- Гора ----------

  // Тропа от подножия (E) к вершине (S): вершины ломаной стоят в лагерях рангов
  var TRAIL = [
    [110, 316],
    [192, 280],
    [146, 234],
    [224, 186],
    [214, 136],
    [250, 66]
  ];

  // Точка на тропе для этого количества опыта
  function trailPoint(xp) {
    var info = rankInfo(xp);
    var from = TRAIL[info.index];
    var to = TRAIL[info.index + 1];
    if (!to) return { x: from[0], y: from[1], reached: info.index };
    var t = Math.max(0, Math.min(1, info.share));
    return { x: from[0] + (to[0] - from[0]) * t, y: from[1] + (to[1] - from[1]) * t, reached: info.index };
  }

  function trailDone(point) {
    return TRAIL.slice(0, point.reached + 1)
      .concat([[point.x, point.y]])
      .map(function (p) {
        return Math.round(p[0] * 10) / 10 + ',' + Math.round(p[1] * 10) / 10;
      })
      .join(' ');
  }

  function mountainSvg(xp) {
    var point = trailPoint(xp);
    var camps = RANKS.map(function (rank, index) {
      var at = TRAIL[index];
      return (
        '<g class="camp' + (index <= point.reached ? ' is-reached' : '') + '" data-camp="' + index + '">' +
        '<circle cx="' + at[0] + '" cy="' + at[1] + '" r="8.5" />' +
        '<text x="' + at[0] + '" y="' + (at[1] + 0.5) + '">' + rank.id + '</text></g>'
      );
    }).join('');

    return (
      '<svg class="mountain-svg" viewBox="0 0 390 360" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      // Небо полосами, как на плоских пейзажах
      '<rect class="m-sky-2" width="390" height="360" />' +
      '<rect class="m-sky" y="96" width="390" height="264" />' +
      '<rect class="m-sky-2" y="150" width="390" height="10" opacity="0.6" />' +
      '<circle class="m-sun layer layer-far" cx="318" cy="78" r="24" />' +
      '<g class="layer layer-far"><path class="m-far" d="M0 206 L46 176 L84 192 L132 150 L168 172 L206 146 L250 170 L300 140 L346 168 L390 150 V360 H0Z" /></g>' +
      '<g class="layer layer-mid"><path class="m-mid" d="M0 250 L52 214 L96 232 L134 204 L170 226 L212 214 L270 238 L320 206 L390 236 V360 H0Z" /></g>' +
      '<g class="layer layer-main">' +
      '<path class="m-main" d="M24 340 L80 300 L150 200 L200 120 L250 58 L290 110 L330 150 L390 206 V340Z" />' +
      '<path class="m-shade" d="M250 58 L290 110 L330 150 L390 206 V340 H300 L270 196 Z" />' +
      '<path class="m-snow" d="M250 58 L273 88 L262 84 L252 96 L242 86 L226 90 Z" />' +
      '</g>' +
      '<g class="layer layer-fore">' +
      '<path class="m-fore" d="M0 304 Q64 284 128 300 T250 302 T390 292 V360 H0Z" />' +
      '<path class="m-fore-2" d="M0 324 Q96 306 196 322 T390 316 V360 H0Z" />' +
      '</g>' +
      // Тропа поверх холмов, чтобы лагерь E у подножия было видно
      '<g class="layer layer-main">' +
      '<polyline class="mountain-trail" points="' + TRAIL.map(function (p) {
        return p.join(',');
      }).join(' ') + '" />' +
      '<polyline class="mountain-trail-done" id="trail-done" points="' + trailDone(point) + '" />' +
      camps +
      '<g id="marker" style="transform: translate(' + point.x + 'px,' + point.y + 'px)">' +
      '<circle class="marker-pulse" r="7" /><circle class="marker-dot" r="6" /></g>' +
      '</g>' +
      '<g class="layer layer-water">' +
      '<rect class="m-water" y="338" width="390" height="22" />' +
      '<rect class="m-water-2" x="40" y="343" width="150" height="2" rx="1" />' +
      '<rect class="m-water-2" x="230" y="346" width="110" height="2" rx="1" />' +
      '<rect class="m-water-2" x="96" y="351" width="200" height="2" rx="1" />' +
      '</g>' +
      '</svg>'
    );
  }

  // Подъём по тропе: маркер едет от того, что Игрок видел в прошлый раз, к сегодняшнему
  var climbFrame = null;

  function climb(fromXp, toXp) {
    var marker = document.getElementById('marker');
    var done = document.getElementById('trail-done');
    var number = document.getElementById('altitude-xp');
    var bar = document.getElementById('altitude-bar');
    if (!marker || !done) return;
    cancelAnimationFrame(climbFrame);

    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var duration = reduce ? 0 : 1800;
    var delay = reduce ? 0 : 900;
    var started = null;

    function paint(xp) {
      var point = trailPoint(xp);
      marker.style.transform = 'translate(' + point.x + 'px,' + point.y + 'px)';
      done.setAttribute('points', trailDone(point));
      document.querySelectorAll('.camp').forEach(function (camp) {
        camp.classList.toggle('is-reached', Number(camp.dataset.camp) <= point.reached);
      });
      if (number) number.textContent = formatInt(Math.round(xp));
      if (bar) bar.style.transform = 'scaleX(' + rankInfo(xp).share + ')';
    }

    paint(fromXp);
    function step(now) {
      if (started === null) started = now;
      var t = duration ? Math.min(1, Math.max(0, now - started - delay) / duration) : 1;
      // Экспоненциальное замедление к концу
      var eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      paint(fromXp + (toXp - fromXp) * eased);
      if (t < 1) climbFrame = requestAnimationFrame(step);
    }
    climbFrame = requestAnimationFrame(step);
  }

  // 12 345 — с узким неразрывным пробелом
  function formatInt(value) {
    return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  // Слои пейзажа сдвигаются с разной скоростью, когда листаешь
  var PARALLAX = { 'layer-far': 0.22, 'layer-mid': 0.15, 'layer-main': 0.08, 'layer-fore': 0.03 };
  var parallaxTicking = false;

  function parallax() {
    parallaxTicking = false;
    var svg = document.querySelector('.screen-today:not([hidden]) .mountain-svg');
    if (!svg) return;
    var y = Math.min(window.scrollY, 600);
    Object.keys(PARALLAX).forEach(function (name) {
      svg.querySelectorAll('.' + name).forEach(function (layer) {
        layer.style.translate = '0 ' + (y * PARALLAX[name]).toFixed(1) + 'px';
      });
    });
  }

  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.addEventListener(
      'scroll',
      function () {
        if (parallaxTicking) return;
        parallaxTicking = true;
        requestAnimationFrame(parallax);
      },
      { passive: true }
    );
  }

  // ---------- Сегодня ----------

  var WEEKDAY_NAMES = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

  function greeting() {
    var hour = new Date().getHours();
    if (hour < 5) return 'Доброй ночи,';
    if (hour < 12) return 'Доброе утро,';
    if (hour < 18) return 'Привет,';
    return 'Добрый вечер,';
  }

  // Неделя с понедельника: точка залита, если в день была тренировка
  function weekStrip() {
    var today = todayIso();
    var monday = mondayOf(today);
    var days = {};
    activeDays().forEach(function (iso) {
      days[iso] = true;
    });
    var html = '';
    for (var index = 0; index < 7; index += 1) {
      var iso = addDays(monday, index);
      html +=
        '<li class="week-day' + (days[iso] ? ' is-on' : '') + (iso === today ? ' is-today' : '') + '">' +
        '<span class="week-dot"></span>' + WEEKDAYS[index] + '</li>';
    }
    var count = Object.keys(days).filter(function (iso) {
      return iso >= monday && iso <= addDays(monday, 6);
    }).length;
    return (
      '<ul class="week" aria-label="Эта неделя: дней с тренировкой ' + count + ' из 7">' + html + '</ul>'
    );
  }

  function strengthToday() {
    var today = todayIso();
    return state.workouts.filter(function (record) {
      return record.date === today && doneSets(record);
    })[0] || null;
  }

  // Подряд идущие дни с силовыми, заканчивая вчера
  function strengthDaysBefore() {
    var dates = {};
    state.workouts.forEach(function (record) {
      if (doneSets(record)) dates[record.date] = true;
    });
    var count = 0;
    while (dates[addDays(todayIso(), -(count + 1))]) count += 1;
    return count;
  }

  function tile(kind, wide, href, title, sub, stateText, done, art) {
    return (
      '<a class="tile tile-' + kind + (wide ? ' tile-wide' : '') + '" href="' + href + '">' +
      art +
      '<span><span class="tile-title">' + title + '</span>' +
      '<span class="tile-sub num" style="display:block">' + sub + '</span></span>' +
      '<span class="tile-foot"><span class="tile-state">' +
      (done ? '<svg class="icon" aria-hidden="true"><use href="#i-check" /></svg>' : '') +
      stateText + '</span>' +
      '<span class="tile-go" aria-hidden="true"><svg class="icon"><use href="#i-next" /></svg></span></span></a>'
    );
  }

  // Рисунки плиток: простые плоские формы того же мира, что и гора
  var TILE_ART = {
    strength:
      '<svg class="tile-art" viewBox="0 0 100 100" aria-hidden="true">' +
      '<rect x="4" y="44" width="92" height="12" rx="6" />' +
      '<rect x="14" y="20" width="16" height="60" rx="8" /><rect x="70" y="20" width="16" height="60" rx="8" />' +
      '<rect x="34" y="30" width="10" height="40" rx="5" /><rect x="56" y="30" width="10" height="40" rx="5" /></svg>',
    core:
      '<svg class="tile-art" viewBox="0 0 100 100" aria-hidden="true">' +
      '<circle cx="56" cy="44" r="40" opacity="0.55" /><circle cx="56" cy="44" r="26" />' +
      '<path d="M50 32 L68 44 L50 56Z" opacity="0.6" /></svg>',
    stretch:
      '<svg class="tile-art" viewBox="0 0 100 100" aria-hidden="true">' +
      '<path d="M0 78 Q50 8 100 78 Z" opacity="0.6" /><path d="M14 92 Q50 38 86 92 Z" />' +
      '<circle cx="50" cy="30" r="9" /></svg>'
  };

  function renderToday() {
    var xp = totalXp();
    var info = rankInfo(xp);
    var streak = streakInfo();
    var today = todayIso();
    var now = new Date();

    // Силовые
    var gymMode = state.place === 'gym';
    var next = nextPlanned(state.place);
    var nextName = gymMode ? next.title : 'Тренировка ' + next.id;
    var doneStrength = strengthToday();
    var strengthSub;
    var strengthState;
    if (state.session) {
      strengthSub = escapeHtml(workoutLabel(state.session.place, state.session.workoutId)) + ' идёт';
      strengthState = 'Продолжить';
    } else if (doneStrength) {
      strengthSub = 'Сегодня: ' + escapeHtml(workoutShort(doneStrength.place, doneStrength.workoutId));
      strengthState = doneStrength.complete ? 'Сделано' : 'Не целиком';
    } else {
      strengthSub = escapeHtml(nextName) + ' · ' + (gymMode ? 'зал' : escapeHtml(next.gear.toLowerCase())) +
        ' · ~' + workoutMinutes(next) + ' мин';
      strengthState = gymMode ? 'Следующая в зале' : 'Следующая: ' + next.id;
    }

    // Кор
    var core = coreToday();
    var coreNext = corePlanned();
    var coreSub = core ? 'Сделана тренировка ' + core.n : 'Тренировка ' + coreNext.n + ' · видео';
    var coreState = core ? 'Сделано' : 'Каждый день';

    // Растяжка
    var stretchDone = state.stretch.filter(function (record) {
      return record.date === today;
    })[0];
    var suggested = now.getHours() < 12 ? 'morning' : 'body';
    var stretchPick = stretchRoutine(suggested);
    var stretchSub = stretchDone
      ? 'Сделана: ' + escapeHtml(stretchRoutine(stretchDone.routine).title.toLowerCase())
      : stretchPick
        ? escapeHtml(stretchPick.title) + ' · ' + stretchMinutes(stretchPick) + ' мин'
        : 'Утро, всё тело, спина';
    var stretchState = stretchDone ? 'Сделано' : 'Три комплекса';

    // Совет дня: одна фраза по истории
    var tip;
    var inRow = strengthDaysBefore();
    if (state.session) {
      tip = 'Тренировка <b>' + escapeHtml(workoutShort(state.session.place, state.session.workoutId)) + '</b> не закончена. Вернись и допиши подходы.';
    } else if (doneStrength && core && stretchDone) {
      tip = '<b>Всё сделано.</b> Сегодня ты поднялся на гору выше. Отдыхай.';
    } else if (doneStrength) {
      var more = (core ? 0 : XP.core) + (stretchDone ? 0 : XP.stretch);
      tip = 'Силовая сегодня есть. ' + (core ? 'Осталась растяжка' : stretchDone ? 'Остался кор' : 'Добей кор и растяжку') +
        ', это ещё <b>+' + more + '</b> опыта.';
    } else if (inRow >= 2) {
      tip = 'Два дня подряд были силовые. Сегодня мышцам нужен отдых: <b>кор и растяжка</b> в самый раз.';
    } else if (streak.days >= 2 && !streak.today) {
      tip = 'Серия ' + streak.days + ' ' + plural(streak.days, 'день', 'дня', 'дней') + '. Сделай сегодня хоть что-то, чтобы её не потерять.';
    } else {
      tip = 'По плану <b>' + escapeHtml(gymMode ? next.title.toLowerCase() : 'силовая ' + next.id) + '</b>. За неё +' + XP.strength + ' опыта, за кор +' + XP.core + ', за растяжку +' + XP.stretch + '.';
    }

    var name = escapeHtml(state.player.name);
    var seen = typeof state.seenXp === 'number' ? Math.min(state.seenXp, xp) : 0;

    document.getElementById('today-body').innerHTML =
      '<header class="today-head">' +
      '<div><p class="today-date">' + capitalize(WEEKDAY_NAMES[now.getDay()]) + ', ' + formatDate(today) + '</p>' +
      '<h1 class="hello" id="today-hello"><span>' + greeting() + '</span><span class="hello-name">' + name + '.</span></h1></div>' +
      '<a class="rank-chip" href="#progress" aria-label="Ранг ' + info.rank.id + ', уровень ' + info.level + '. Открыть прогресс">' +
      '<span class="rank-letter" aria-hidden="true">' + info.rank.id + '</span>' +
      '<span aria-hidden="true">Ур. ' + info.level + '</span></a>' +
      '</header>' +
      '<div class="mountain">' + mountainSvg(seen) +
      '<div class="altitude">' +
      '<span class="altitude-xp num"><span id="altitude-xp">' + formatInt(seen) + '</span><small>опыта</small></span>' +
      '<span class="altitude-next">' +
      (info.next
        ? info.rank.name + ' · до ранга ' + info.next.id + ' ещё ' + formatInt(info.left)
        : 'Вершина. Ранг S') +
      '</span>' +
      '<span class="altitude-bar" aria-hidden="true"><span id="altitude-bar" style="transform: scaleX(' +
      rankInfo(seen).share + ')"></span></span>' +
      '</div></div>' +
      '<div class="streak-row">' +
      '<div class="streak' + (streak.days ? '' : ' is-cold') + '">' +
      '<svg class="icon" aria-hidden="true"><use href="#i-flame" /></svg>' +
      '<span class="streak-text"><b class="num">' +
      (streak.days ? streak.days + ' ' + plural(streak.days, 'день', 'дня', 'дней') + ' подряд' : 'Серии нет') +
      '</b><span>' + (streak.days >= 3 ? 'серия идёт' : 'с 3 дней бонус +' + XP.streak3) + '</span></span></div>' +
      weekStrip() +
      '</div>' +
      '<nav class="tiles" aria-label="Тренировки">' +
      tile('strength', true, state.session ? '#session' : '#strength', 'Силовые', strengthSub, strengthState, !!doneStrength && !state.session, TILE_ART.strength) +
      tile('core', false, '#core', 'Кор', coreSub, coreState, !!core, TILE_ART.core) +
      tile('stretch', false, '#stretch', 'Растяжка', stretchSub, stretchState, !!stretchDone, TILE_ART.stretch) +
      '</nav>' +
      '<p class="today-note">' + tip + '</p>';

    return { from: seen, to: xp };
  }

  function capitalize(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  // Показ главного экрана: гора поднимается на новый опыт, и он считается увиденным
  function enterToday() {
    var climbRange = renderToday();
    climb(climbRange.from, climbRange.to);

    // Новый ранг и новые ачивки — после подъёма маркера
    var news = [];
    var before = rankInfo(climbRange.from);
    var after = rankInfo(climbRange.to);
    if (after.index > before.index && state.seenXp !== null) {
      news.push({ glyph: after.rank.id, title: 'Новый ранг ' + after.rank.id, text: after.rank.name });
    }
    newsSinceSeen().forEach(function (badge) {
      if (/^rank/.test(badge.id) && news.length) return;
      news.push({ glyph: badge.glyph, title: badge.name, text: badge.how });
    });
    if (news.length) {
      var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      setTimeout(function () {
        showToasts(news);
      }, reduce ? 0 : 2400);
    }
    if (state.seenXp !== climbRange.to) {
      state.seenXp = climbRange.to;
      saveState();
    }
    parallax();
  }

  // ---------- Тема ----------

  var THEMES = [
    { id: 'auto', label: 'Как в системе' },
    { id: 'light', label: 'Светлая' },
    { id: 'dark', label: 'Тёмная' }
  ];

  function applyTheme() {
    var root = document.documentElement;
    if (state.theme === 'light' || state.theme === 'dark') root.setAttribute('data-theme', state.theme);
    else root.removeAttribute('data-theme');
    var dark =
      state.theme === 'dark' ||
      (state.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.querySelectorAll('meta[name="theme-color"]').forEach(function (meta) {
      meta.setAttribute('content', dark ? '#121815' : '#efe8db');
    });
  }

  // ---------- Профиль ----------

  function renderProfile() {
    var rows = [row('Имя', escapeHtml(state.player.name)), row('Цель', 'Подтянутая форма')];
    if (state.profile) {
      rows.push(row('Рост', formatNum(state.profile.height) + ' см'));
      rows.push(row('Возраст', formatNum(state.profile.age) + ' лет'));
    }
    ['weight', 'waist', 'belly'].forEach(function (key) {
      var metric = METRICS.filter(function (item) {
        return item.key === key;
      })[0];
      var value = metricValue(key);
      rows.push(value ? row(metric.label, value) : row(metric.label, 'нет записей', true));
    });

    var plan = schedule();
    var due = [];
    if (state.measurements.length) {
      if (plan.weightNow) due.push('вес');
      if (plan.bodyNow) due.push('обхваты');
    }

    document.getElementById('profile-body').innerHTML =
      '<dl class="rows rows-flat">' + rows.join('') + '</dl>' +
      (state.profile
        ? '<a class="btn btn-block" href="#measure">' +
          '<svg class="icon" aria-hidden="true"><use href="#i-plus" /></svg>Новый замер</a>' +
          '<p class="note">' +
          (due.length
            ? 'Пора обновить ' + due.join(' и ') + '.'
            : 'Следующий вес: ' + formatDate(plan.weightDue) + '. Обхваты: ' + formatDate(plan.bodyDue) + '.') +
          '</p>'
        : '<a class="btn btn-block" href="#measure/setup">Заполнить анкету</a>' +
          '<p class="note">Твои цифры от 1 октября уже подставлены: проверь и сохрани.</p>') +
      '<h2 class="group-title">Тема</h2>' +
      '<div class="seg" role="radiogroup" aria-label="Тема">' +
      THEMES.map(function (theme) {
        return (
          '<button class="seg-btn" type="button" role="radio" data-theme-pick="' + theme.id + '" aria-checked="' +
          (state.theme === theme.id) + '">' + theme.label + '</button>'
        );
      }).join('') +
      '</div>';
  }

  document.getElementById('profile-body').addEventListener('click', function (event) {
    var pick = event.target.closest('[data-theme-pick]');
    if (!pick) return;
    state.theme = pick.dataset.themePick;
    saveState();
    applyTheme();
    renderProfile();
    var again = document.querySelector('[data-theme-pick="' + state.theme + '"]');
    if (again) again.focus({ preventScroll: true });
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

  // ---------- Растяжка: выборки ----------

  var STRETCH = DATA.stretch || { routines: [] };

  function stretchRoutine(id) {
    if (typeof id === 'string' && id.indexOf('cool-') === 0) return cooldownRoutine(id.slice(5));
    return STRETCH.routines.filter(function (routine) {
      return routine.id === id;
    })[0] || null;
  }

  // ---------- Заминка после силовой ----------
  // Набор растяжек под мышцы дня. Каждый раз 5 упражнений со сдвигом по кругу:
  // сдвиг зависит от того, сколько раз эту заминку уже делали.

  function cooldownDay(place, workoutId) {
    var workout = findWorkout(place, workoutId);
    var day = workout && workout.day;
    var days = (STRETCH.cooldown && STRETCH.cooldown.days) || {};
    return day && days[day] ? day : 'full';
  }

  function cooldownRoutine(day) {
    var cool = STRETCH.cooldown;
    var info = cool && cool.days[day];
    if (!info) return null;
    var id = 'cool-' + day;
    var times = state.stretch.filter(function (record) {
      return record.routine === id;
    }).length;
    var size = Math.min(cool.size || 5, info.items.length);
    var start = (times * size) % info.items.length;
    var items = [];
    for (var index = 0; index < size; index += 1) {
      items.push(info.items[(start + index) % info.items.length]);
    }
    return { id: id, title: 'Заминка: ' + info.title.toLowerCase(), about: info.about, cooldown: true, items: items };
  }

  // Длительность комплекса в минутах, с переходами между упражнениями
  function stretchMinutes(routine) {
    var seconds = routine.items.reduce(function (sum, item) {
      return sum + item.hold * (item.sides ? 2 : 1) + (STRETCH.gap || 5) * (item.sides ? 2 : 1);
    }, 0);
    return Math.max(1, Math.round(seconds / 60));
  }


  // ---------- Прогресс ----------

  // Показатели, у которых есть график. Остальные обхваты идут цифрами.
  var TREND_KEYS = ['weight', 'waist', 'belly'];

  function deltaNote(first, last, unit) {
    return formatDelta(last - first) + (last === first ? '' : ' ' + unit) + ' от старта';
  }

  function trendBlock(metric) {
    var points = sortedMeasurements()
      .filter(function (entry) {
        return hasValue(entry, metric.key);
      })
      .map(function (entry) {
        return { date: entry.date, value: entry[metric.key] };
      });

    if (!points.length) {
      return (
        '<section class="trend"><div class="trend-head"><h3 class="trend-name">' + metric.label +
        '</h3><p class="trend-now is-empty">нет записей</p></div></section>'
      );
    }

    var first = points[0];
    var last = points[points.length - 1];
    return (
      '<section class="trend"><div class="trend-head"><h3 class="trend-name">' + metric.label + '</h3>' +
      '<p class="trend-now"><span class="num">' + formatNum(last.value) + ' ' + metric.unit + '</span>' +
      '<span class="row-note num">' +
      (points.length > 1 ? deltaNote(first.value, last.value, metric.unit) : 'старт ' + formatDate(first.date)) +
      '</span></p></div>' +
      (points.length > 1
        ? chartHtml(points, metric.unit, metric.label)
        : '<p class="trend-note">График появится после второго замера.</p>') +
      '</section>'
    );
  }

  // Темп: средний опыт в неделю за последние 4 недели
  function weeklyPace(events) {
    var from = addDays(todayIso(), -27);
    var sum = events.reduce(function (total, event) {
      return event.date >= from ? total + event.xp : total;
    }, 0);
    // Если учёт идёт меньше 4 недель, делим на реальный срок
    var first = events.reduce(function (min, event) {
      return !min || event.date < min ? event.date : min;
    }, null);
    var days = first ? Math.min(28, daysBetween(first < from ? from : first, todayIso()) + 1) : 28;
    return Math.round((sum / Math.max(7, days)) * 7);
  }

  function rankBlock(xp, events) {
    var info = rankInfo(xp);
    var pace = weeklyPace(events);
    var forecast = '';
    if (info.next && pace > 0) {
      var weeks = Math.ceil(info.left / pace);
      forecast =
        'В твоём темпе (≈' + formatInt(pace) + ' опыта в неделю) до ранга ' + info.next.id + ' примерно ' + weeks + ' ' +
        plural(weeks, 'неделя', 'недели', 'недель') + '.';
    } else if (info.next) {
      forecast = 'За последние 4 недели тренировок не было: темп посчитаю, когда появятся.';
    }

    var camps = RANKS.map(function (rank, index) {
      var cls = index < info.index ? 'is-passed' : index === info.index ? 'is-here' : '';
      return (
        '<li class="' + cls + '"><span class="camp-dot" aria-hidden="true">' + rank.id + '</span>' +
        '<span class="camp-name">' + rank.name + '</span>' +
        '<span class="camp-xp num">' + (index === info.index ? 'ты здесь' : formatInt(rank.xp)) + '</span></li>'
      );
    }).reverse().join('');

    return (
      '<section class="rank-hero" aria-labelledby="rank-title">' +
      '<div class="rank-hero-top">' +
      '<span class="rank-big" aria-hidden="true">' + info.rank.id + '</span>' +
      '<div class="rank-hero-text"><h2 class="rank-title" id="rank-title">Ранг ' + info.rank.id + '</h2>' +
      '<p class="rank-meta num">' + info.rank.name + ' · уровень ' + info.level + ' · ' + formatInt(xp) + ' опыта</p></div></div>' +
      (info.next
        ? '<div class="rank-progress"><div class="rank-progress-head num"><span>До ранга ' + info.next.id + '</span><span>ещё ' +
          formatInt(info.left) + '</span></div>' +
          '<span class="rank-bar" role="progressbar" aria-label="Путь до ранга ' + info.next.id + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' +
          Math.round(info.share * 100) + '"><span style="transform: scaleX(' + info.share + ')"></span></span></div>'
        : '<p class="rank-meta">Вершина взята. Дальше только удерживать форму.</p>') +
      (forecast ? '<p class="rank-forecast">' + forecast + '</p>' : '') +
      '<ol class="camps" aria-label="Лагеря на пути к вершине">' + camps + '</ol>' +
      '</section>'
    );
  }

  // История опыта: по дням, новые сверху
  function xpLog(events) {
    var byDay = {};
    events.forEach(function (event) {
      if (!byDay[event.date]) byDay[event.date] = [];
      byDay[event.date].push(event);
    });
    var html = Object.keys(byDay)
      .sort()
      .reverse()
      .map(function (iso) {
        var list = byDay[iso];
        var sum = list.reduce(function (total, event) {
          return total + event.xp;
        }, 0);
        return (
          '<li><div class="history-row is-static">' +
          '<span class="history-date">' + formatDate(iso) + '<span class="history-what">' +
          list.map(function (event) {
            return escapeHtml(event.text);
          }).join(' · ') + '</span></span>' +
          '<span class="history-sum xp-sum num">+' + sum + '</span></div></li>'
        );
      });
    return foldedList(html, 'Опыта пока нет. Первый появится после любой тренировки.');
  }

  function renderProgress() {
    var body = document.getElementById('progress-body');
    var list = sortedMeasurements();
    var events = xpEvents();
    var xp = events.reduce(function (sum, event) {
      return sum + event.xp;
    }, 0);
    var badges = achievements();
    var earned = badges.filter(function (badge) {
      return badge.done;
    }).length;

    var html =
      rankBlock(xp, events) +
      weekBlock(events) +
      '<h2 class="group-title">Ачивки <span class="group-sub num">' + earned + ' из ' + badges.length + '</span></h2>' +
      badgeGrid(badges) +
      calendarBlock() +
      '<h2 class="group-title">Опыт</h2>' +
      xpLog(events) +
      '<h2 class="group-title">Тело</h2>';

    if (!list.length) {
      html +=
        '<p class="note">Замеров пока нет. Первая запись станет точкой отсчёта, с ней будут сравниваться все следующие.</p>' +
        '<a class="btn btn-block" href="' + (state.profile ? '#measure' : '#measure/setup') + '">' +
        (state.profile ? 'Новый замер' : 'Заполнить анкету') + '</a>';
    } else {
      var trends = METRICS.filter(function (metric) {
        return TREND_KEYS.indexOf(metric.key) !== -1;
      })
        .map(trendBlock)
        .join('');

      var rest = METRICS.filter(function (metric) {
        return TREND_KEYS.indexOf(metric.key) === -1;
      })
        .map(function (metric) {
          var range = metricRange(metric.key);
          if (!range) {
            return '<div class="row"><dt>' + metric.label + '</dt><dd class="is-empty">нет записей</dd></div>';
          }
          var note =
            range.count > 1
              ? deltaNote(range.first[metric.key], range.last[metric.key], metric.unit)
              : 'старт ' + formatDate(range.first.date);
          return (
            '<div class="row row-stack"><dt>' + metric.label + '</dt><dd><span class="num">' +
            formatNum(range.last[metric.key]) + ' ' + metric.unit +
            '</span><span class="row-note num">' + note + '</span></dd></div>'
          );
        })
        .join('');

      html +=
        '<a class="btn btn-block" href="#measure"><svg class="icon" aria-hidden="true"><use href="#i-plus" /></svg>Новый замер</a>' +
        '<div class="trends">' + trends + '</div>' +
        '<dl class="rows rows-flat">' + rest + '</dl>';
    }

    html += '<h2 class="group-title">Рабочие веса</h2>' + liftList();

    if (list.length) {
      var history = list
        .slice()
        .reverse()
        .map(function (entry) {
          var filled = METRICS.filter(function (metric) {
            return hasValue(entry, metric.key);
          });
          var summary = hasValue(entry, 'weight') ? formatNum(entry.weight) + ' кг' : '';
          var others = filled.length - (hasValue(entry, 'weight') ? 1 : 0);
          if (others > 0) summary += (summary ? ' · ' : '') + 'обхватов: ' + others;
          return (
            '<li><a class="history-row" href="#measure/' + encodeURIComponent(entry.id) + '">' +
            '<span class="history-date">' + formatDate(entry.date) + '</span>' +
            '<span class="history-sum num">' + summary + '</span>' +
            '<svg class="icon" aria-hidden="true"><use href="#i-next" /></svg></a></li>'
          );
        })
        .join('');
      html += '<h2 class="group-title">История замеров</h2><ul class="list history">' + history + '</ul>';
    }

    body.innerHTML = html;
  }

  // ---------- Неделя и календарь ----------

  // Сколько силовых в неделю считается нормой и сколько недель видно в календаре
  var WEEK_STRENGTH = 3;
  var WEEK_CORE = 7;
  var WEEK_STRETCH = 2; // ACSM: растяжка минимум 2 раза в неделю
  var CALENDAR_WEEKS = 5;
  var WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  // Неделя начинается с понедельника
  function mondayOf(iso) {
    return addDays(iso, -((parseIso(iso).getDay() + 6) % 7));
  }

  // Что было в каждый день: { full: силовые целиком, part: силовые не целиком, core: номера кора }
  function dayLog() {
    var days = {};
    function day(iso) {
      if (!days[iso]) days[iso] = { full: [], part: [], core: [], stretch: [] };
      return days[iso];
    }
    state.workouts.forEach(function (record) {
      day(record.date)[record.complete ? 'full' : 'part'].push(workoutShort(record.place, record.workoutId));
    });
    state.core.forEach(function (record) {
      day(record.date).core.push(record.n);
    });
    state.stretch.forEach(function (record) {
      var routine = stretchRoutine(record.routine);
      day(record.date).stretch.push(routine ? routine.title.toLowerCase() : record.routine);
    });
    return days;
  }

  // «12–18 октября» или «28 сентября – 4 октября»
  function formatRange(fromIso, toIso) {
    var from = parseIso(fromIso);
    var to = parseIso(toIso);
    if (from.getMonth() === to.getMonth()) return from.getDate() + '–' + formatDate(toIso);
    return formatDate(fromIso) + ' – ' + formatDate(toIso);
  }

  // Шкала из делений: сколько сделано из нормы
  function meter(label, done, goal) {
    var cells = '';
    for (var index = 0; index < goal; index += 1) {
      cells += '<span' + (index < done ? ' class="is-on"' : '') + '></span>';
    }
    return (
      '<div class="meter"><div class="meter-head"><span class="meter-name">' + label + '</span>' +
      '<span class="meter-value num">' + done + ' из ' + goal + '</span></div>' +
      '<div class="meter-bar" role="img" aria-label="' + label + ': ' + done + ' из ' + goal + '">' + cells +
      '</div></div>'
    );
  }

  function weekBlock(events) {
    var monday = mondayOf(todayIso());
    var sunday = addDays(monday, 6);
    var days = dayLog();
    var strength = 0;
    var core = 0;
    var stretch = 0;
    Object.keys(days).forEach(function (iso) {
      if (iso < monday || iso > sunday) return;
      strength += days[iso].full.length;
      core += days[iso].core.length;
      stretch += days[iso].stretch.length ? 1 : 0;
    });
    var weekXp = events.reduce(function (sum, event) {
      return event.date >= monday && event.date <= sunday ? sum + event.xp : sum;
    }, 0);
    return (
      '<h2 class="group-title">Эта неделя <span class="group-sub num">' + formatRange(monday, sunday) + ' · +' +
      formatInt(weekXp) + ' опыта</span></h2>' +
      '<div class="meters">' +
      meter('Силовые целиком', Math.min(strength, WEEK_STRENGTH), WEEK_STRENGTH) +
      meter('Кор', Math.min(core, WEEK_CORE), WEEK_CORE) +
      meter('Растяжка', Math.min(stretch, WEEK_STRETCH), WEEK_STRETCH) +
      '</div>'
    );
  }

  // «9 октября: силовая A, кор 3»
  function dayText(iso, entry) {
    var today = todayIso();
    var parts = [];
    if (entry) {
      entry.full.forEach(function (name) {
        parts.push(name);
      });
      entry.part.forEach(function (name) {
        parts.push(name + ' не целиком');
      });
      entry.core.forEach(function (n) {
        parts.push('кор ' + n);
      });
      entry.stretch.forEach(function (title) {
        parts.push('растяжка: ' + title);
      });
    }
    var what = parts.length ? parts.join(', ') : iso > today ? 'ещё впереди' : iso === today ? 'пока ничего' : 'без тренировок';
    return '<b>' + (iso === today ? 'Сегодня' : formatDate(iso)) + ':</b> ' + escapeHtml(what);
  }

  function calendarBlock() {
    var today = todayIso();
    var days = dayLog();
    var start = addDays(mondayOf(today), -7 * (CALENDAR_WEEKS - 1));
    var cells = '';
    for (var index = 0; index < CALENDAR_WEEKS * 7; index += 1) {
      var iso = addDays(start, index);
      var entry = days[iso];
      var marks = '';
      if (entry) {
        if (entry.full.length) marks += '<span class="mark mark-full"></span>';
        else if (entry.part.length) marks += '<span class="mark mark-part"></span>';
        if (entry.core.length) marks += '<span class="mark mark-core"></span>';
        if (entry.stretch.length) marks += '<span class="mark mark-stretch"></span>';
      }
      cells +=
        '<button class="cal-day num' + (iso === today ? ' is-today is-active' : '') + (iso > today ? ' is-future' : '') +
        '" type="button" data-day="' + iso + '" aria-pressed="' + (iso === today) + '" aria-label="' +
        dayText(iso, entry).replace(/<\/?b>/g, '') + '">' + parseIso(iso).getDate() +
        '<span class="cal-marks" aria-hidden="true">' + marks + '</span></button>';
    }
    return (
      '<h2 class="group-title">Календарь <span class="group-sub">5 недель</span></h2>' +
      '<div class="cal-wrap"><div class="cal">' +
      WEEKDAYS.map(function (name) {
        return '<span class="cal-wd" aria-hidden="true">' + name + '</span>';
      }).join('') +
      cells + '</div>' +
      '<p class="cal-read num" id="cal-read" aria-live="polite">' + dayText(today, days[today]) + '</p>' +
      '<ul class="cal-legend" aria-label="Обозначения">' +
      '<li><span class="mark mark-full"></span>силовая</li>' +
      '<li><span class="mark mark-part"></span>силовая не целиком</li>' +
      '<li><span class="mark mark-core"></span>кор</li>' +
      '<li><span class="mark mark-stretch"></span>растяжка</li></ul></div>'
    );
  }

  // Нажатие на день показывает, что в этот день было
  document.getElementById('progress-body').addEventListener('click', function (event) {
    var cell = event.target.closest('.cal-day');
    if (!cell) return;
    document.querySelectorAll('.cal-day').forEach(function (other) {
      var active = other === cell;
      other.classList.toggle('is-active', active);
      other.setAttribute('aria-pressed', String(active));
    });
    document.getElementById('cal-read').innerHTML = dayText(cell.dataset.day, dayLog()[cell.dataset.day]);
  });

  // ---------- Рост весов по упражнениям ----------

  // Все тренировки, где упражнение делалось, от старых к новым.
  // value — рабочий вес (самый тяжёлый подход), а без снаряда — лучший подход по повторам.
  function liftSeries(exerciseId) {
    var series = [];
    sortedWorkouts().forEach(function (record) {
      record.items.forEach(function (item) {
        if (item.ex !== exerciseId || !item.sets.length) return;
        var weighted = typeof item.sets[0].w === 'number';
        var value = Math.max.apply(
          null,
          item.sets.map(function (set) {
            return weighted ? set.w : set.r;
          })
        );
        series.push({
          date: record.date,
          value: value,
          unit: weighted ? 'кг' : item.timed ? 'с' : 'раз',
          sets: item.sets,
          timed: !!item.timed
        });
      });
    });
    return series;
  }

  function liftIds() {
    var seen = {};
    var ids = [];
    sortedWorkouts()
      .reverse()
      .forEach(function (record) {
        record.items.forEach(function (item) {
          if (!item.sets.length || seen[item.ex] || !DATA.exercises[item.ex]) return;
          seen[item.ex] = true;
          ids.push(item.ex);
        });
      });
    return ids;
  }

  function liftList() {
    var ids = liftIds();
    if (!ids.length) {
      return '<p class="note">Записей нет. Рост весов появится после первой тренировки.</p>';
    }
    return (
      '<ul class="list history">' +
      ids
        .map(function (id) {
          var series = liftSeries(id);
          var first = series[0];
          var last = series[series.length - 1];
          var count = series.length;
          return (
            '<li><a class="history-row" href="#lift/' + encodeURIComponent(id) + '">' +
            '<span class="history-date">' + escapeHtml(DATA.exercises[id].name) +
            '<span class="history-what num">' + count + ' ' +
            plural(count, 'тренировка', 'тренировки', 'тренировок') + ' · ' + formatDate(last.date) + '</span></span>' +
            '<span class="history-sum lift-sum num"><span class="lift-now">' + formatNum(last.value) + ' ' + last.unit +
            '</span>' +
            (count > 1 && first.unit === last.unit && last.value !== first.value
              ? '<span class="row-note">' + formatDelta(last.value - first.value) + ' ' + last.unit + ' от старта</span>'
              : '') +
            '</span><svg class="icon" aria-hidden="true"><use href="#i-next" /></svg></a></li>'
          );
        })
        .join('') +
      '</ul>'
    );
  }

  function renderLift(exerciseId) {
    var exercise = DATA.exercises[exerciseId];
    var series = liftSeries(exerciseId);
    var first = series[0];
    var last = series[series.length - 1];
    var sameUnit = series.every(function (point) {
      return point.unit === last.unit;
    });
    var best = series.reduce(function (top, point) {
      return point.value > top.value ? point : top;
    }, first);

    var rows = [row('Сейчас', formatNum(last.value) + ' ' + last.unit)];
    if (series.length > 1 && sameUnit) {
      rows.push(row('Старт', formatNum(first.value) + ' ' + first.unit + ' · ' + formatDate(first.date)));
      rows.push(row('Лучший', formatNum(best.value) + ' ' + best.unit + ' · ' + formatDate(best.date)));
    }

    var sessions = series
      .slice()
      .reverse()
      .map(function (point) {
        return (
          '<li><span class="log-name">' + formatDate(point.date) + '</span>' +
          '<span class="log-sets num">' + setsSummary(point.sets, point.timed) + '</span></li>'
        );
      })
      .join('');

    document.getElementById('detail-body').innerHTML =
      '<div class="ex-head"><h2 class="ex-title">' + escapeHtml(exercise.name) + '</h2>' +
      '<p class="ex-meta">' + (last.unit === 'кг' ? 'Рабочий вес: самый тяжёлый подход за тренировку' : 'Лучший подход за тренировку') +
      '</p></div>' +
      '<dl class="rows rows-flat">' + rows.join('') + '</dl>' +
      (series.length > 1 && sameUnit
        ? chartHtml(series, last.unit, exercise.name)
        : '<p class="note">График появится после второй тренировки с этим упражнением.</p>') +
      '<h2 class="group-title">Тренировки</h2>' +
      '<ul class="list log-list">' + sessions + '</ul>' +
      '<a class="btn btn-ghost btn-block" href="#exercise/' + encodeURIComponent(exerciseId) + '">Техника упражнения</a>';
  }

  // ---------- График ----------

  // Шкала с круглыми делениями: не больше пяти линий
  function niceScale(lo, hi) {
    var steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100];
    for (var index = 0; index < steps.length; index += 1) {
      var step = steps[index];
      var from = Math.floor(lo / step + 1e-9) * step;
      var to = Math.ceil(hi / step - 1e-9) * step;
      if (to === from) to = from + step;
      var count = Math.round((to - from) / step);
      if (count <= 4) {
        var ticks = [];
        for (var tick = 0; tick <= count; tick += 1) ticks.push(Math.round((from + tick * step) * 100) / 100);
        return ticks;
      }
    }
    return [lo, hi];
  }

  function daysBetween(fromIso, toIso) {
    return Math.round((parseIso(toIso) - parseIso(fromIso)) / 86400000);
  }

  // Линия по датам. points: [{ date, value }], от старых к новым, минимум две точки.
  // Цифру под пальцем показывает строка над графиком.
  function chartHtml(points, unit, label) {
    var values = points.map(function (point) {
      return point.value;
    });
    var ticks = niceScale(Math.min.apply(null, values), Math.max.apply(null, values));
    var bottom = ticks[0];
    var top = ticks[ticks.length - 1];
    var span = daysBetween(points[0].date, points[points.length - 1].date) || 1;

    var placed = points.map(function (point) {
      return {
        date: point.date,
        value: point.value,
        x: Math.round((daysBetween(points[0].date, point.date) / span) * 10000) / 100,
        y: Math.round(((top - point.value) / (top - bottom)) * 10000) / 100
      };
    });
    var last = placed[placed.length - 1];

    var grid = ticks
      .map(function (tick) {
        return '<span class="chart-grid" style="top:' + ((top - tick) / (top - bottom)) * 100 + '%"></span>';
      })
      .join('');
    var axis = ticks
      .map(function (tick) {
        return '<span style="top:' + ((top - tick) / (top - bottom)) * 100 + '%">' + formatNum(tick) + '</span>';
      })
      .join('');
    var dots = placed
      .map(function (point, index) {
        return (
          '<span class="chart-dot' + (index === placed.length - 1 ? ' is-active' : '') + '" style="left:' +
          point.x + '%;top:' + point.y + '%"></span>'
        );
      })
      .join('');
    var data = placed.map(function (point) {
      return [point.date, point.value, point.x];
    });

    return (
      '<div class="chart' + (placed.length > 40 ? ' is-dense' : '') + '">' +
      '<p class="chart-read num" aria-live="polite">' + chartRead(last.date, last.value, unit) + '</p>' +
      '<div class="chart-body">' +
      '<div class="chart-y num" aria-hidden="true">' + axis + '</div>' +
      '<div class="chart-area" tabindex="0" role="group" aria-label="График: ' + escapeHtml(label) + ', ' + unit +
      '. Записей: ' + placed.length + ', с ' + formatDate(placed[0].date) + ' по ' + formatDate(last.date) +
      '. Стрелки влево и вправо переключают записи." data-unit="' + unit + '" data-active="' + (placed.length - 1) +
      '" data-points="' + escapeHtml(JSON.stringify(data)) + '">' +
      grid +
      '<svg class="chart-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
      '<polyline class="chart-line" points="' +
      placed
        .map(function (point) {
          return point.x + ',' + point.y;
        })
        .join(' ') +
      '" /></svg>' +
      '<div class="chart-dots"><span class="chart-cross" hidden></span>' + dots + '</div>' +
      '</div>' +
      '<div class="chart-x num" aria-hidden="true"><span>' + formatDate(placed[0].date) + '</span><span>' +
      formatDate(last.date) + '</span></div>' +
      '</div></div>'
    );
  }

  function chartRead(date, value, unit) {
    return '<b>' + formatNum(value) + ' ' + unit + '</b> · ' + formatDate(date);
  }

  function setChartPoint(area, index, cross) {
    var points = JSON.parse(area.dataset.points);
    index = Math.max(0, Math.min(points.length - 1, index));
    area.dataset.active = index;
    area.querySelectorAll('.chart-dot').forEach(function (dot, dotIndex) {
      dot.classList.toggle('is-active', dotIndex === index);
    });
    var line = area.querySelector('.chart-cross');
    line.style.left = points[index][2] + '%';
    line.hidden = !cross;
    area.closest('.chart').querySelector('.chart-read').innerHTML = chartRead(
      points[index][0],
      points[index][1],
      area.dataset.unit
    );
  }

  // Палец или курсор над графиком выбирает ближайшую запись
  function chartPointer(event) {
    var area = event.target.closest && event.target.closest('.chart-area');
    if (!area) return;
    var box = area.querySelector('.chart-dots').getBoundingClientRect();
    var at = ((event.clientX - box.left) / box.width) * 100;
    var points = JSON.parse(area.dataset.points);
    var nearest = 0;
    points.forEach(function (point, index) {
      if (Math.abs(point[2] - at) < Math.abs(points[nearest][2] - at)) nearest = index;
    });
    setChartPoint(area, nearest, true);
  }

  document.addEventListener('pointermove', chartPointer);
  document.addEventListener('pointerdown', chartPointer);

  document.addEventListener('keydown', function (event) {
    var area = event.target.closest && event.target.closest('.chart-area');
    var step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!area || !step) return;
    event.preventDefault();
    setChartPoint(area, Number(area.dataset.active) + step, true);
  });


  // ---------- Форма замера ----------

  var form = document.getElementById('measure-form');
  var formMode = null; // { kind: 'setup' | 'new' | 'edit', entry }

  function fieldRow(field, value, required) {
    var id = 'f-' + field.key;
    return (
      '<div class="field" data-field="' + field.key + '">' +
      '<label class="field-label" for="' + id + '">' + field.label +
      (field.hint ? '<span class="field-hint">' + field.hint + '</span>' : '') + '</label>' +
      '<span class="field-control"><input class="field-input num" id="' + id + '" name="' + field.key +
      '" type="text" inputmode="decimal" autocomplete="off" enterkeyhint="next"' +
      (required ? ' aria-required="true"' : '') +
      ' value="' + (value === null || value === undefined ? '' : formatNum(value)) + '" />' +
      '<span class="field-unit" aria-hidden="true">' + field.unit + '</span></span>' +
      '<p class="field-error" id="' + id + '-error" hidden></p>' +
      '</div>'
    );
  }

  function renderForm(mode) {
    formMode = mode;
    var source = mode.kind === 'setup' ? {} : mode.entry || {};
    var date = mode.kind === 'edit' ? source.date : todayIso();
    var intro = '';

    if (mode.kind === 'setup') {
      intro =
        '<p class="note">Рост, возраст и сегодняшние замеры. Это точка старта: от неё приложение считает прогресс.</p>';
    } else if (mode.kind === 'new') {
      intro =
        '<p class="note">Заполни то, что измерил сегодня. Пустые поля можно оставить.</p>';
    } else {
      intro = '<p class="note">Запись от ' + formatDate(source.date) + '. Поправь цифры и сохрани.</p>';
    }

    var profile = '';
    if (mode.kind === 'setup') {
      profile =
        '<h2 class="group-title">О тебе</h2><div class="fields">' +
        PROFILE_FIELDS.map(function (field) {
          return fieldRow(field, source[field.key], true);
        }).join('') +
        '</div>';
    }

    form.innerHTML =
      intro +
      '<p class="form-error" id="form-error" role="alert" hidden></p>' +
      profile +
      '<h2 class="group-title">Замеры</h2>' +
      '<div class="fields">' +
      '<div class="field" data-field="date">' +
      '<label class="field-label" for="f-date">Дата</label>' +
      '<span class="field-control"><input class="field-input field-date" id="f-date" name="date" type="date" aria-required="true" max="' +
      todayIso() + '" value="' + date + '" /></span>' +
      '<p class="field-error" id="f-date-error" hidden></p></div>' +
      METRICS.map(function (metric) {
        return fieldRow(metric, source[metric.key], mode.kind === 'setup' && metric.key === 'weight');
      }).join('') +
      '</div>' +
      (mode.kind === 'edit'
        ? '<button class="btn btn-danger" type="button" id="delete-entry">Удалить запись</button>'
        : '') +
      '<div class="form-actions">' +
      '<a class="btn btn-ghost" href="' + (mode.kind === 'setup' ? '#profile' : '#progress') + '">Отмена</a>' +
      '<button class="btn" type="submit">Сохранить</button>' +
      '</div>';

    var deleteButton = document.getElementById('delete-entry');
    if (deleteButton) armDelete(deleteButton, mode.entry);
  }

  // Удаление в два касания: первое просит подтверждение, второе удаляет
  function armDelete(button, entry) {
    var armed = false;
    var timer = null;
    button.addEventListener('click', function () {
      if (!armed) {
        armed = true;
        button.textContent = 'Нажми ещё раз, чтобы удалить';
        button.classList.add('is-armed');
        timer = setTimeout(function () {
          armed = false;
          button.textContent = 'Удалить запись';
          button.classList.remove('is-armed');
        }, 4000);
        return;
      }
      clearTimeout(timer);
      state.measurements = state.measurements.filter(function (item) {
        return item.id !== entry.id;
      });
      saveState();
      renderAll();
      location.hash = '#progress';
    });
  }

  function setFieldError(key, text) {
    var wrap = form.querySelector('[data-field="' + key + '"]');
    var input = wrap.querySelector('input');
    var error = wrap.querySelector('.field-error');
    if (text) {
      error.textContent = text;
      error.hidden = false;
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', error.id);
    } else {
      error.hidden = true;
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
    }
  }

  function readField(field, required, errors) {
    var input = form.elements[field.key];
    var value = parseNum(input.value);
    var text = '';
    if (value === null) {
      if (required) text = 'Нужно для расчётов.';
    } else if (isNaN(value) || value < field.min || value > field.max) {
      text = 'Нужно число от ' + field.min + ' до ' + field.max + '.';
    }
    setFieldError(field.key, text);
    if (text) errors.push(field.key);
    return text ? null : value;
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (!formMode) return;

    var errors = [];
    var formError = document.getElementById('form-error');
    formError.hidden = true;

    var profile = null;
    if (formMode.kind === 'setup') {
      profile = {};
      PROFILE_FIELDS.forEach(function (field) {
        profile[field.key] = readField(field, true, errors);
      });
    }

    // Дата
    var date = form.elements.date.value;
    var dateText = '';
    var editingId = formMode.kind === 'edit' ? formMode.entry.id : null;
    if (!date) dateText = 'Укажи дату замера.';
    else if (date > todayIso()) dateText = 'Дата не может быть в будущем.';
    else if (
      state.measurements.some(function (item) {
        return item.date === date && item.id !== editingId;
      })
    ) {
      dateText = 'За эту дату уже есть запись. Открой её в истории и поправь.';
    }
    setFieldError('date', dateText);
    if (dateText) errors.push('date');

    var entry = { id: editingId || String(Date.now()), date: date };
    var filled = 0;
    METRICS.forEach(function (metric) {
      var required = formMode.kind === 'setup' && metric.key === 'weight';
      var value = readField(metric, required, errors);
      if (value !== null) {
        entry[metric.key] = value;
        filled += 1;
      }
    });

    if (!errors.length && filled === 0) {
      formError.textContent = 'Все поля пустые. Заполни хотя бы одно, например вес.';
      formError.hidden = false;
      form.elements.weight.focus();
      return;
    }

    if (errors.length) {
      form.elements[errors[0]].focus();
      return;
    }

    if (profile) state.profile = profile;
    if (editingId) {
      state.measurements = state.measurements.map(function (item) {
        return item.id === editingId ? entry : item;
      });
    } else {
      state.measurements.push(entry);
    }

    if (!saveState()) {
      formError.textContent =
        'Не получилось сохранить: браузер не даёт доступ к памяти. Выключи приватный режим и попробуй ещё раз.';
      formError.hidden = false;
      return;
    }

    renderAll();
    location.hash = formMode.kind === 'setup' ? '#profile' : '#progress';
  });

  // Ошибка у поля гаснет, как только его начали править
  form.addEventListener('input', function (event) {
    var wrap = event.target.closest('[data-field]');
    if (wrap && event.target.getAttribute('aria-invalid')) setFieldError(wrap.dataset.field, '');
  });

  // ---------- Разделы ----------

  var titleNode = document.getElementById('screen-title');
  var topbar = document.getElementById('topbar');
  var tabbar = document.getElementById('tabbar');
  var firstRender = true;

  // Адрес → что показать. parent — куда ведёт стрелка «назад», если истории нет.
  function currentRoute() {
    var parts = location.hash.replace('#', '').split('/');
    var id = parts[0];
    var home = { screen: 'today', nav: 'today', title: SCREENS.today };
    var strength = { screen: 'strength', nav: 'today', title: SECTIONS.strength, parent: '#today', render: renderPlan };

    if (id === 'measure') {
      var param = parts[1] ? decodeURIComponent(parts[1]) : '';
      if (param === 'setup') {
        // Анкета заполняется один раз
        if (state.profile) return { screen: 'profile', nav: 'profile', title: SCREENS.profile, render: renderProfile };
        return { screen: 'measure', nav: 'profile', title: 'Анкета', parent: '#profile', mode: { kind: 'setup' } };
      }
      if (param) {
        var entry = state.measurements.filter(function (item) {
          return item.id === param;
        })[0];
        if (!entry) return { screen: 'progress', nav: 'progress', title: SCREENS.progress, render: renderProgress };
        return { screen: 'measure', nav: 'progress', title: 'Замер', parent: '#progress', mode: { kind: 'edit', entry: entry } };
      }
      return { screen: 'measure', nav: 'progress', title: 'Новый замер', parent: '#progress', mode: { kind: 'new' } };
    }

    if (id === 'strength' || id === 'train') return strength;

    if (id === 'workout') {
      var program = DATA.programs[parts[1]];
      var workout = program && program.workouts.filter(function (item) {
        return item.id === parts[2];
      })[0];
      if (!workout) return strength;
      return {
        screen: 'detail',
        nav: 'today',
        title: workoutLabel(parts[1], workout.id),
        parent: '#strength',
        render: function () {
          renderWorkout(parts[1], workout);
        }
      };
    }

    if (id === 'session') {
      if (!state.session) return strength;
      return {
        screen: 'session',
        nav: 'today',
        title: workoutLabel(state.session.place, state.session.workoutId),
        parent: '#strength',
        focus: true,
        render: renderSession
      };
    }

    if (id === 'log') {
      var logId = parts[1] ? decodeURIComponent(parts[1]) : '';
      var record = state.workouts.filter(function (item) {
        return item.id === logId;
      })[0];
      if (!record) return strength;
      return {
        screen: 'detail',
        nav: 'today',
        title: 'Итог тренировки',
        parent: '#strength',
        render: function () {
          renderLog(record);
        }
      };
    }

    if (id === 'core') {
      return { screen: 'core', nav: 'today', title: SECTIONS.core, parent: '#today', core: true, render: renderCore };
    }

    if (id === 'stretch') {
      var picked = parts[1] ? stretchRoutine(decodeURIComponent(parts[1])) : null;
      return {
        screen: 'stretch',
        nav: 'today',
        title: picked ? (picked.cooldown ? picked.title : 'Растяжка: ' + picked.title.toLowerCase()) : SECTIONS.stretch,
        parent: picked ? '#stretch' : '#today',
        render: renderStretch
      };
    }

    // Разминка перед силовой: тот же плеер, что у растяжки, возврат в тренировку
    if (id === 'warmup') {
      if (!state.session || !STRETCH.warmup) return strength;
      return {
        screen: 'stretch-run',
        nav: 'today',
        title: 'Разминка',
        parent: '#session',
        focus: true,
        bare: true,
        run: STRETCH.warmup
      };
    }

    if (id === 'stretch-run') {
      var routine = parts[1] ? stretchRoutine(decodeURIComponent(parts[1])) : null;
      if (!routine) return { screen: 'stretch', nav: 'today', title: SECTIONS.stretch, parent: '#today', render: renderStretch };
      return {
        screen: 'stretch-run',
        nav: 'today',
        title: routine.cooldown ? routine.title : 'Растяжка: ' + routine.title.toLowerCase(),
        parent: '#stretch/' + routine.id,
        focus: true,
        bare: true,
        run: routine
      };
    }

    if (id === 'lift') {
      var liftId = parts[1] ? decodeURIComponent(parts[1]) : '';
      if (!DATA.exercises[liftId] || !liftSeries(liftId).length) {
        return { screen: 'progress', nav: 'progress', title: SCREENS.progress, render: renderProgress };
      }
      return {
        screen: 'detail',
        nav: 'progress',
        title: 'Рост веса',
        parent: '#progress',
        render: function () {
          renderLift(liftId);
        }
      };
    }

    if (id === 'exercise') {
      var exerciseId = parts[1] ? decodeURIComponent(parts[1]) : '';
      if (!DATA.exercises[exerciseId]) return strength;
      return {
        screen: 'detail',
        nav: 'today',
        title: 'Упражнение',
        parent: '#strength',
        render: function () {
          renderExercise(exerciseId);
        }
      };
    }

    if (id === 'progress') return { screen: 'progress', nav: 'progress', title: SCREENS.progress, render: renderProgress };
    if (id === 'profile') return { screen: 'profile', nav: 'profile', title: SCREENS.profile, render: renderProfile };
    return home;
  }

  var currentParent = '#today';

  function paintRoute() {
    var route = currentRoute();
    // Ушёл с экрана кора: видео не должно играть за кадром
    if (!route.core) stopVideo();
    // Ушёл с растяжки — таймер останавливается; пришёл — комплекс начинается заново
    if (run && !route.run) stopRun();
    if (route.run && (!run || run.routine.id !== route.run.id || run.phase === 'done')) {
      stopRun();
      startRun(route.run);
    }
    if (route.mode) renderForm(route.mode);
    if (route.render) route.render();
    if (route.screen === 'today') enterToday();
    currentParent = route.parent || '#today';

    document.querySelectorAll('.screen').forEach(function (screen) {
      var active = screen.dataset.screen === route.screen;
      screen.hidden = !active;
      screen.classList.remove('is-entering');
      if (active) {
        // Перезапуск анимации появления
        void screen.offsetWidth;
        screen.classList.add('is-entering');
      }
    });

    document.querySelectorAll('[data-nav]').forEach(function (link) {
      if (link.dataset.nav === route.nav) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });

    // На главном экране заголовок — приветствие, верхней полосы нет
    topbar.hidden = route.screen === 'today' || !!route.bare;
    topbar.classList.toggle('is-root', !route.parent);
    // Во время тренировки нижняя панель уходит: внизу живёт таймер отдыха
    tabbar.classList.toggle('is-hidden', !!route.focus);

    titleNode.textContent = route.title;
    document.title = route.title + ' · Fitness App';

    if (!firstRender) {
      window.scrollTo(0, 0);
      // Экранный диктор объявит новый раздел
      var heading = route.screen === 'today' ? document.getElementById('today-hello')
        : route.bare ? document.getElementById('run-title') : titleNode;
      if (heading) {
        heading.setAttribute('tabindex', '-1');
        heading.focus({ preventScroll: true });
      }
    }
    firstRender = false;
  }

  // Плавный переход между экранами, где браузер это умеет
  function showRoute() {
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (document.startViewTransition && !firstRender && !reduce) {
      document.startViewTransition(paintRoute);
    } else {
      paintRoute();
    }
  }

  window.addEventListener('hashchange', showRoute);

  // «Назад» возвращает туда, откуда пришёл; если истории нет — на уровень выше
  document.addEventListener('click', function (event) {
    if (!event.target.closest('[data-back]')) return;
    if (history.length > 1) history.back();
    else location.hash = currentParent;
  });

  // ---------- Программа, тренировка, упражнение ----------

  // У части упражнений вместо фото рисунок линиями (svg), он всегда на светлой карточке
  var ART = {};
  (DATA.art || []).forEach(function (id) {
    ART[id] = true;
  });

  function hasArt(exerciseId) {
    return !!ART[exerciseId];
  }

  function photo(exerciseId, index) {
    return 'exercises/' + encodeURIComponent(exerciseId) + '/' + index + (hasArt(exerciseId) ? '.svg' : '.jpg');
  }

  // Два кадра движения в одной рамке: второй проявляется поверх первого и уходит
  function frames(exerciseId, extraClass) {
    var name = escapeHtml(DATA.exercises[exerciseId].name);
    return (
      '<span class="frames' + (hasArt(exerciseId) ? ' is-art' : '') + (extraClass ? ' ' + extraClass : '') + '">' +
      '<img src="' + photo(exerciseId, 0) + '" alt="' + name + ': как делать" />' +
      '<img class="frames-b" src="' + photo(exerciseId, 1) + '" alt="" aria-hidden="true" />' +
      '</span>'
    );
  }

  function restText(seconds) {
    if (seconds >= 120 && seconds % 60 === 0) return seconds / 60 + ' мин';
    if (seconds > 60 && seconds % 60 !== 0) return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
    return seconds + ' с';
  }

  // Отдых по программе или свой, если Игрок его менял
  function restFor(entry) {
    var mine = state.restPref[entry.ex];
    return typeof mine === 'number' ? mine : entry.rest;
  }

  // Примерная длительность: дорожка 5 мин и разминка ~4,5 мин плюс подходы с отдыхом
  function workoutMinutes(workout) {
    var seconds = 5 * 60 + 270;
    workout.items.forEach(function (entry) {
      seconds += entry.sets * (50 + entry.rest);
    });
    return Math.round(seconds / 60 / 5) * 5;
  }

  function exerciseRow(exerciseId, sub) {
    var exercise = DATA.exercises[exerciseId];
    return (
      '<a class="ex-row" href="#exercise/' + encodeURIComponent(exerciseId) + '">' +
      '<img class="ex-thumb' + (hasArt(exerciseId) ? ' is-art' : '') + '" src="' + photo(exerciseId, hasArt(exerciseId) ? 1 : 0) +
      '" alt="" width="64" height="52" loading="lazy" />' +
      '<span class="ex-text"><span class="ex-name">' + escapeHtml(exercise.name) + '</span>' +
      '<span class="ex-sub num">' + escapeHtml(sub) + '</span></span>' +
      '<svg class="icon" aria-hidden="true"><use href="#i-next" /></svg></a>'
    );
  }

  // Опыт за запись силовой: целиком — полный, не целиком — по доле подходов
  function strengthXp(record) {
    var done = doneSets(record);
    if (!done) return 0;
    return record.complete ? XP.strength : Math.round((XP.strength * done) / record.total);
  }

  function workoutLine(workout) {
    return escapeHtml(workout.gear) + ' · ' + workout.items.length + ' упражнений · ~' + workoutMinutes(workout) + ' мин';
  }

  // Буква тренировки зала: первая буква группы мышц
  var DAY_GLYPH = { chest: 'Г', back: 'С', legs: 'Н', full: 'В' };

  function workoutGlyph(workout) {
    return workout.day ? DAY_GLYPH[workout.day] : workout.id;
  }

  function guideHtml(blocks) {
    return blocks
      .map(function (block) {
        var links = (block.links || [])
          .map(function (link) {
            return (
              '<li><a class="link" href="' + link.url + '" target="_blank" rel="noopener">' +
              escapeHtml(link.label) + '</a></li>'
            );
          })
          .join('');
        return (
          '<details class="fold"><summary>' + escapeHtml(block.title) +
          '<svg class="icon" aria-hidden="true"><use href="#i-next" /></svg></summary>' +
          '<div class="fold-body">' +
          block.text
            .map(function (text) {
              return '<p>' + escapeHtml(text) + '</p>';
            })
            .join('') +
          (links ? '<ul class="fold-links">' + links + '</ul>' : '') +
          '</div></details>'
        );
      })
      .join('');
  }

  // Главная карточка: тренировка, которую делать сейчас
  function leadCard(place, lead, running, subline) {
    return (
      '<section class="lead" aria-labelledby="lead-title">' +
      (lead.day ? '' : '<span class="lead-letter" aria-hidden="true">' + lead.id + '</span>') +
      '<h2 class="lead-title" id="lead-title">' + escapeHtml(workoutLabel(place, lead.id)) + '</h2>' +
      '<p class="lead-sub num">' + subline + '</p>' +
      '<ol class="lead-list">' +
      lead.items.map(function (entry) {
        return '<li><span>' + escapeHtml(DATA.exercises[entry.ex].name) + '</span><span class="num">' +
          entry.sets + '×' + escapeHtml(entry.reps.replace(/ на (ногу|руку)/, '').replace('до запаса в 2 повтора', 'макс')) +
          '</span></li>';
      }).join('') +
      '</ol>' +
      '<div class="lead-actions">' +
      (running
        ? '<a class="btn btn-light" href="#session">Продолжить</a>'
        : '<button class="btn btn-light" type="button" data-start="' + place + '/' + lead.id + '">Начать</button>') +
      '<a class="btn btn-light-ghost" href="#workout/' + place + '/' + lead.id + '">Подробнее</a>' +
      '</div></section>'
    );
  }

  // Тренировка идёт в другом месте: начать новую нельзя, только вернуться к ней
  function otherSessionNote(place) {
    var session = state.session;
    if (!session || session.place === place) return '';
    return (
      '<p class="note">Сейчас идёт ' + escapeHtml(workoutShort(session.place, session.workoutId)) +
      ' (' + PLACE_NAMES[session.place] + '). Закончи её, потом начинай новую.</p>' +
      '<a class="btn btn-ghost btn-block" href="#session">Открыть тренировку</a>'
    );
  }

  function pickRow(place, workout, tag) {
    var running = state.session && state.session.place === place && state.session.workoutId === workout.id;
    return (
      '<li><a class="pick-row" href="' + (running ? '#session' : '#workout/' + place + '/' + workout.id) + '">' +
      '<span class="letter" aria-hidden="true">' + workoutGlyph(workout) + '</span>' +
      '<span class="ex-text"><span class="ex-name">' + escapeHtml(workoutLabel(place, workout.id)) +
      (running ? ' <span class="tag">идёт</span>' : tag ? ' <span class="tag">' + tag + '</span>' : '') + '</span>' +
      '<span class="ex-sub num">' + workoutLine(workout) + '</span></span>' +
      '<svg class="icon" aria-hidden="true"><use href="#i-next" /></svg></a></li>'
    );
  }

  // Тропа блоков: три лагеря, у каждого 12 делений-тренировок
  function blockPath(gs) {
    var gym = DATA.programs.gym;
    var camps = gym.blocks
      .map(function (block, index) {
        var status = index < gs.blockIndex ? 'is-done' : index === gs.blockIndex ? 'is-now' : '';
        var filled = index < gs.blockIndex ? gym.blockSize : index === gs.blockIndex ? gs.inBlock : 0;
        var ticks = '';
        for (var tick = 0; tick < gym.blockSize; tick += 1) {
          ticks += '<i' + (tick < filled ? ' class="on"' : tick === filled && status === 'is-now' ? ' class="next"' : '') + '></i>';
        }
        return (
          '<li class="path-block ' + status + '"' + (status === 'is-now' ? ' aria-current="step"' : '') + '>' +
          '<span class="path-camp" aria-hidden="true"><svg viewBox="0 0 24 20"><path d="M12 2 22 18H2Z" /></svg></span>' +
          '<span class="path-name">' + escapeHtml(block.title) + '</span>' +
          '<span class="path-count num">' + filled + ' из ' + gym.blockSize + '</span>' +
          '<span class="path-ticks" aria-hidden="true">' + ticks + '</span>' +
          '</li>'
        );
      })
      .join('');
    return (
      '<section class="path" aria-labelledby="path-title">' +
      '<div class="path-head"><h2 class="path-title" id="path-title">Путь блоков</h2>' +
      '<span class="path-lap num">' + (gs.lap > 1 ? 'Круг ' + gs.lap : 'Сделано ' + gs.n) + '</span></div>' +
      '<ol class="path-blocks">' + camps + '</ol>' +
      '<p class="path-idea"><b>Блок ' + gs.block.n + ', ' + escapeHtml(gs.block.title.toLowerCase()) + '.</b> ' +
      escapeHtml(gs.block.idea) + '</p>' +
      '</section>'
    );
  }

  function gymPlan() {
    var session = state.session;
    var gym = DATA.programs.gym;
    var gs = gymState();
    var running = session && session.place === 'gym';
    var lead = running ? findWorkout('gym', session.workoutId) : gs.workout;
    var block = gym.blocks[lead.block - 1];
    var subline = running
      ? 'Идёт сейчас · ~' + workoutMinutes(lead) + ' мин'
      : 'Блок ' + block.n + ' · ' + escapeHtml(block.title.toLowerCase()) + ' · ' + (gs.inBlock + 1) + '-я из ' +
        gym.blockSize + ' · ~' + workoutMinutes(lead) + ' мин';

    var list = gym.rotation
      .map(function (day) {
        var workout = findWorkout('gym', gs.block.n + '-' + day);
        return pickRow('gym', workout, !session && workout.id === gs.workout.id ? 'следующая' : '');
      })
      .join('');

    return (
      (otherSessionNote('gym') || leadCard('gym', lead, running, subline)) +
      blockPath(gs) +
      '<h2 class="group-title">Тренировки блока</h2>' +
      '<p class="note">Идут по кругу: грудь, спина, ноги, всё тело. 3 в неделю, не больше двух дней подряд.</p>' +
      '<ul class="list pick-list">' + list + '</ul>' +
      '<h2 class="group-title">История</h2>' +
      strengthHistory() +
      '<h2 class="group-title">Как это работает</h2>' +
      '<div class="folds">' + guideHtml(DATA.gymGuide) + '</div>'
    );
  }

  function homePlan() {
    var program = DATA.programs.home;
    var next = nextWorkoutIndex() % program.workouts.length;
    var session = state.session;
    var running = session && session.place === 'home';
    var lead = running ? findWorkout('home', session.workoutId) : program.workouts[next];
    var subline = (running ? 'Идёт сейчас' : 'Следующая по кругу') + ' · ' +
      escapeHtml(lead.gear.toLowerCase()) + ' · ~' + workoutMinutes(lead) + ' мин · +' + XP.strength + ' опыта';

    var workouts = program.workouts
      .map(function (workout, index) {
        return pickRow('home', workout, !session && index === next ? 'следующая' : '');
      })
      .join('');

    return (
      (otherSessionNote('home') || leadCard('home', lead, running, subline)) +
      '<h2 class="group-title">Все тренировки</h2>' +
      '<p class="note">Идут по кругу: A, B, C, снова A. 3–4 в неделю, не больше двух дней подряд.</p>' +
      '<ul class="list pick-list">' + workouts + '</ul>' +
      '<h2 class="group-title">История</h2>' +
      strengthHistory() +
      '<h2 class="group-title">Как это работает</h2>' +
      '<div class="folds">' + guideHtml(DATA.guide) + '</div>'
    );
  }

  function renderPlan() {
    var place = state.place;
    var seg =
      '<div class="seg place-seg" role="radiogroup" aria-label="Где тренируешься">' +
      ['gym', 'home']
        .map(function (option) {
          return (
            '<button class="seg-btn" type="button" role="radio" aria-checked="' + (place === option) +
            '" data-place="' + option + '">' + (option === 'gym' ? 'Зал' : 'Дом') + '</button>'
          );
        })
        .join('') +
      '</div>';
    document.getElementById('plan-body').innerHTML = seg + (place === 'gym' ? gymPlan() : homePlan());
  }

  document.getElementById('plan-body').addEventListener('click', function (event) {
    var button = event.target.closest('[data-place]');
    if (!button || button.dataset.place === state.place) return;
    state.place = button.dataset.place;
    saveState();
    renderPlan();
    var picked = document.querySelector('[data-place="' + state.place + '"]');
    if (picked) picked.focus({ preventScroll: true });
  });

  // ---------- Кор ----------

  var CORE = DATA.core;
  var planDay = todayIso();

  // Сегодняшняя запись кора, если тренировка уже отмечена
  function coreToday() {
    var today = todayIso();
    return (
      state.core.filter(function (record) {
        return record.date === today;
      })[0] || null
    );
  }

  function coreVideo(n) {
    return CORE.videos.filter(function (video) {
      return video.n === n;
    })[0];
  }

  // Отметки кора по порядку выполнения
  function coreSorted() {
    return state.core.slice().sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return (a.doneAt || 0) - (b.doneAt || 0);
    });
  }

  function coreIndex(n) {
    for (var index = 0; index < CORE.videos.length; index += 1) {
      if (CORE.videos[index].n === n) return index;
    }
    return -1;
  }

  // Очередь идёт дальше от последней сделанной, даже если её выбрали не по порядку
  function coreQueueNext(records) {
    var list = records || coreSorted();
    var last = list[list.length - 1];
    if (!last) return CORE.videos[0];
    return CORE.videos[(coreIndex(last.n) + 1) % CORE.videos.length];
  }

  // Новый круг начинается, когда тренировку, уже сделанную в этом круге, делают снова.
  // Пропущенные можно добрать позже в том же круге.
  function coreCircle(records) {
    var list = records || coreSorted();
    var number = 1;
    var done = {};
    list.forEach(function (record) {
      if (done[record.n]) {
        number += 1;
        done = {};
      }
      done[record.n] = true;
    });
    return { number: number, done: done, count: Object.keys(done).length };
  }

  // Что делать сегодня: выбранная вручную или следующая по очереди
  function corePlanned() {
    var pick = state.corePick;
    if (pick && pick.date === todayIso() && coreVideo(pick.n)) return coreVideo(pick.n);
    return coreQueueNext();
  }

  function markCoreDone(n) {
    if (coreToday()) return;
    state.corePick = null;
    state.core.push({ id: String(Date.now()), date: todayIso(), n: n, doneAt: Date.now() });
    // Экран кора перерисовывает только низ: видео не должно перезапуститься
    saveState();
  }

  function unmarkCoreToday() {
    var today = todayIso();
    state.core = state.core.filter(function (record) {
      return record.date !== today;
    });
    saveState();
  }

  // ---------- Экран кора: видео и отметка ----------

  // Диск выдаёт прямую ссылку на файл по запросу. Она временная, поэтому
  // запрашивается каждый раз, когда открывается экран.
  function coreSource(video) {
    var api =
      'https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=' +
      encodeURIComponent(state.coreFolder) + '&path=' + encodeURIComponent('/' + video.file);
    return fetch(api)
      .then(function (response) {
        if (!response.ok) throw new Error('disk ' + response.status);
        return response.json();
      })
      .then(function (data) {
        if (!data.href) throw new Error('no href');
        return data.href;
      });
  }

  function stopVideo() {
    document.querySelectorAll('.video video').forEach(function (video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    });
  }

  var coreLoad = 0;

  // Ссылки на курс нет: просим вставить её один раз
  function askCoreFolder(box, video, wrong, typed) {
    box.className = 'core-link';
    box.innerHTML =
      '<form class="core-link-form" id="core-link-form" novalidate>' +
      '<h3 class="core-link-title">Ссылка на курс</h3>' +
      '<p class="core-link-text">Видео лежат в твоей папке на Яндекс Диске. Вставь ссылку на неё один раз: ' +
      'она сохранится только на этом устройстве, в коде приложения её нет.</p>' +
      '<label class="sr-only" for="core-link-input">Ссылка на папку Яндекс Диска</label>' +
      '<input class="field-input core-link-input" id="core-link-input" type="url" inputmode="url" autocomplete="off" ' +
      'placeholder="https://disk.yandex.ru/d/…" value="' + escapeHtml(typed !== undefined ? typed : state.coreFolder || '') + '"' +
      (wrong ? ' aria-invalid="true"' : '') + ' aria-describedby="core-link-error" />' +
      '<p class="field-error" id="core-link-error" role="alert"' + (wrong ? '' : ' hidden') + '>' +
      (wrong ? escapeHtml(wrong) : '') + '</p>' +
      '<button class="btn btn-block" type="submit">Сохранить и включить видео</button>' +
      '</form>';
    document.getElementById('core-link-form').addEventListener('submit', function (event) {
      event.preventDefault();
      var value = document.getElementById('core-link-input').value.trim();
      if (!isDiskLink(value)) {
        askCoreFolder(box, video, 'Нужна ссылка на папку Яндекс Диска, например https://disk.yandex.ru/d/…', value);
        document.getElementById('core-link-input').focus();
        return;
      }
      state.coreFolder = value;
      saveState();
      loadCoreVideo(video);
    });
  }

  function loadCoreVideo(video) {
    var box = document.getElementById('core-video');
    if (!box) return;
    var ticket = (coreLoad += 1);
    if (!state.coreFolder) {
      askCoreFolder(box, video);
      return;
    }
    box.className = 'video';
    box.innerHTML = '<p class="video-state" role="status">Загружаю видео с Диска…</p>';

    function fail() {
      // Ответ пришёл, когда экран уже другой или запрошено другое видео
      if (ticket !== coreLoad || !document.body.contains(box)) return;
      box.innerHTML =
        '<div class="video-state" role="alert"><p>Видео не загрузилось. Проверь интернет или ссылку на папку.</p>' +
        '<div class="video-state-actions">' +
        '<button class="btn btn-ghost" type="button" id="core-retry">Ещё раз</button>' +
        '<button class="btn btn-ghost" type="button" id="core-relink">Другая ссылка</button></div></div>';
      document.getElementById('core-retry').addEventListener('click', function () {
        loadCoreVideo(video);
      });
      document.getElementById('core-relink').addEventListener('click', function () {
        coreLoad += 1;
        askCoreFolder(box, video);
        document.getElementById('core-link-input').focus();
      });
    }

    coreSource(video)
      .then(function (href) {
        if (ticket !== coreLoad || !document.body.contains(box)) return;
        var player = document.createElement('video');
        player.controls = true;
        player.playsInline = true;
        player.preload = 'metadata';
        player.setAttribute('aria-label', 'Видео: кор, тренировка ' + video.n);
        player.addEventListener('error', fail);
        player.src = href;
        box.innerHTML = '';
        box.appendChild(player);
      })
      .catch(fail);
  }

  // Низ экрана кора перерисовывается отдельно, чтобы отметка не сбрасывала видео
  function renderCoreAction(video) {
    var box = document.getElementById('core-action');
    if (!box) return;
    var done = coreToday();

    if (done) {
      box.innerHTML =
        '<p class="core-status"><svg class="icon" aria-hidden="true"><use href="#i-check" /></svg>' +
        '<span>Сегодня сделана тренировка ' + done.n + ', +' + XP.core + ' опыта. Завтра тренировка ' +
        coreQueueNext().n + '.</span></p>' +
        '<button class="btn btn-ghost btn-block" type="button" id="core-screen-undo">Снять отметку</button>';
      armConfirm(document.getElementById('core-screen-undo'), 'Нажми ещё раз, чтобы снять', function () {
        unmarkCoreToday();
        // Очередь вернулась назад: экран показывает ту же тренировку заново
        renderCore();
      });
      return;
    }

    box.innerHTML =
      '<button class="btn btn-block" type="button" id="core-screen-done">Сделано · +' + XP.core + ' опыта</button>';
    document.getElementById('core-screen-done').addEventListener('click', function () {
      markCoreDone(video.n);
      renderCoreAction(video);
      paintCoreRing();
      var undo = document.getElementById('core-screen-undo');
      if (undo) undo.focus({ preventScroll: true });
    });
  }

  // Круг из 13 тренировок: сделанные в этом круге залиты, сегодняшняя обведена.
  // Пока сегодня ничего не отмечено, любую можно выбрать нажатием.
  function coreRing() {
    var today = coreToday();
    var circle = coreCircle();
    var planned = today ? coreVideo(today.n) : corePlanned();
    return CORE.videos.map(function (video) {
      var done = circle.done[video.n];
      var current = planned && planned.n === video.n;
      var cls = (done ? ' is-done' : '') + (current ? ' is-today' : '');
      var label = 'Тренировка ' + video.n + (done ? ', сделана в этом круге' : '') + (current ? ', на сегодня' : '');
      return (
        '<li><button class="ring-step' + cls + '" type="button" data-core-pick="' + video.n + '" aria-label="' + label +
        '" aria-pressed="' + !!current + '"' + (today ? ' disabled' : '') + '><span class="num">' + video.n +
        '</span></button></li>'
      );
    }).join('');
  }

  function coreSubline() {
    var today = coreToday();
    var circle = coreCircle();
    var pick = state.corePick;
    var picked = !today && pick && pick.date === todayIso();
    var queue = coreQueueNext();
    return (
      '«Глубокий кор» · круг ' + circle.number + ', сделано ' + circle.count + ' из ' + CORE.videos.length +
      (today ? '' : picked && queue.n !== pick.n
        ? ' · <button class="text-btn" type="button" data-core-pick="' + queue.n + '">вернуться к очереди: ' + queue.n + '</button>'
        : ' · нажми на кружок, чтобы выбрать другую')
    );
  }

  function paintCoreRing() {
    var ring = document.getElementById('core-ring');
    if (ring) ring.innerHTML = coreRing();
    var sub = document.getElementById('core-sub');
    if (sub) sub.innerHTML = coreSubline();
    var history = document.getElementById('core-history');
    if (history) history.innerHTML = coreHistory();
  }

  // Сегодняшняя тренировка: если уже отмечена, показываем её же, чтобы можно было досмотреть
  function renderCore() {
    var done = coreToday();
    var video = done ? coreVideo(done.n) : corePlanned();

    document.getElementById('core-body').innerHTML =
      '<header class="core-hero">' +
      '<h2 class="core-title num" id="core-title">Тренировка ' + video.n + '</h2>' +
      '<p class="core-sub num" id="core-sub">' + coreSubline() + '</p>' +
      '<ol class="ring" id="core-ring" aria-label="Тренировки курса">' + coreRing() + '</ol>' +
      '</header>' +
      '<div class="video" id="core-video"></div>' +
      '<div class="stack" id="core-action"></div>' +
      '<p class="note">Видео идёт с Яндекс Диска, нужен интернет. Без выбора тренировки идут по порядку, а после выбранной очередь продолжается с неё.</p>' +
      '<h2 class="group-title">История</h2>' +
      '<div id="core-history">' + coreHistory() + '</div>';

    loadCoreVideo(video);
    renderCoreAction(video);
  }

  // Выбор тренировки нажатием на кружок: меняется видео, очередь продолжится с неё
  document.getElementById('core-body').addEventListener('click', function (event) {
    var button = event.target.closest('[data-core-pick]');
    if (!button || coreToday()) return;
    var n = Number(button.dataset.corePick);
    if (!coreVideo(n)) return;
    var queue = coreQueueNext();
    state.corePick = n === queue.n ? null : { date: todayIso(), n: n };
    saveState();
    var video = coreVideo(n);
    document.getElementById('core-title').textContent = 'Тренировка ' + n;
    loadCoreVideo(video);
    renderCoreAction(video);
    paintCoreRing();
    var again = document.querySelector('.ring-step[data-core-pick="' + n + '"]');
    if (again) again.focus({ preventScroll: true });
  });

  // Приложение могло провисеть открытым до следующего дня: тогда очередь кора устарела
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && planDay !== todayIso()) {
      planDay = todayIso();
      renderAll();
    }
  });

  // Сколько последних записей видно сразу, остальные под «Показать ещё»
  var HISTORY_SHOWN = 10;

  // Длинный список: первые строки сразу, остальные под «Показать ещё»
  function foldedList(html, empty) {
    if (!html.length) return '<p class="note">' + empty + '</p>';
    var older = html.length - HISTORY_SHOWN;
    return (
      '<ul class="list history">' + html.slice(0, HISTORY_SHOWN).join('') + '</ul>' +
      (older > 0
        ? '<details class="fold more"><summary>Показать ещё ' + older +
          '<svg class="icon" aria-hidden="true"><use href="#i-next" /></svg></summary>' +
          '<ul class="list history">' + html.slice(HISTORY_SHOWN).join('') + '</ul></details>'
        : '')
    );
  }

  function strengthHistory() {
    var html = sortedWorkouts()
      .reverse()
      .map(function (record) {
        var done = doneSets(record);
        var summary = record.complete
          ? done + ' ' + plural(done, 'подход', 'подхода', 'подходов')
          : done + ' из ' + record.total;
        return (
          '<li><a class="history-row" href="#log/' + encodeURIComponent(record.id) + '">' +
          '<span class="history-date">' + formatDate(record.date) + '<span class="history-what">' +
          escapeHtml(workoutLabel(record.place, record.workoutId)) + (record.place === 'gym' ? ', зал' : '') +
          (record.complete ? '' : ', не целиком') + '</span></span>' +
          '<span class="history-sum num">' + summary + '</span>' +
          '<svg class="icon" aria-hidden="true"><use href="#i-next" /></svg></a></li>'
        );
      });
    return foldedList(html, 'Записей пока нет. Первая появится, когда закончишь тренировку.');
  }

  function coreHistory() {
    var html = state.core
      .slice()
      .sort(function (a, b) {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        return (b.doneAt || 0) - (a.doneAt || 0);
      })
      .map(function (record) {
        return (
          '<li><div class="history-row is-static">' +
          '<span class="history-date">' + formatDate(record.date) + '</span>' +
          '<span class="history-sum num">тренировка ' + record.n + '</span></div></li>'
        );
      });
    return foldedList(html, 'Пока пусто. Первая отметка появится после «Сделано».');
  }

  function renderWorkout(place, workout) {
    var program = DATA.programs[place];
    var rows = workout.items
      .map(function (entry) {
        return (
          '<li>' +
          exerciseRow(entry.ex, entry.sets + ' × ' + entry.reps + ' · отдых ' + restText(restFor(entry))) +
          '</li>'
        );
      })
      .join('');

    var session = state.session;
    var action = '';
    if (!session) {
      action =
        '<button class="btn btn-block" type="button" data-start="' + place + '/' + workout.id + '">Начать тренировку</button>';
    } else if (session.place === place && session.workoutId === workout.id) {
      action = '<a class="btn btn-block" href="#session">Продолжить тренировку</a>';
    } else {
      action =
        '<p class="note">Сейчас идёт ' + escapeHtml(workoutShort(session.place, session.workoutId)) + '. Закончи её, потом начинай эту.</p>' +
        '<a class="btn btn-ghost btn-block" href="#session">Открыть тренировку</a>';
    }

    var block = workout.block ? DATA.programs.gym.blocks[workout.block - 1] : null;

    document.getElementById('detail-body').innerHTML =
      '<section class="sys">' +
      (block
        ? '<p class="sys-text"><b>Блок ' + block.n + ', ' + escapeHtml(block.title.toLowerCase()) + '.</b> ' + escapeHtml(block.idea) + '</p>'
        : '') +
      '<p class="sys-text"><b>' + escapeHtml(workout.gear) + '.</b> ' + escapeHtml(workout.setup) + '</p>' +
      '<p class="sys-text sys-text-dim num">Около ' + workoutMinutes(workout) + ' минут · +' + XP.strength + ' опыта</p>' +
      '</section>' +
      action +
      '<h2 class="group-title">Разминка</h2>' +
      '<p class="note">' + escapeHtml(program.warmup) + '</p>' +
      '<h2 class="group-title">Упражнения</h2>' +
      '<ol class="list ex-list">' + rows + '</ol>' +
      '<h2 class="group-title">Заминка</h2>' +
      '<p class="note">' + escapeHtml(program.cooldown) + '</p>';
  }

  function renderExercise(exerciseId) {
    var exercise = DATA.exercises[exerciseId];
    var steps = exercise.steps
      .map(function (step) {
        return '<li>' + escapeHtml(step) + '</li>';
      })
      .join('');

    document.getElementById('detail-body').innerHTML =
      '<div class="ex-head"><h2 class="ex-title">' + escapeHtml(exercise.name) + '</h2>' +
      '<p class="ex-meta">' + escapeHtml(exercise.muscles) + '</p>' +
      '<p class="ex-meta ex-meta-dim">' + escapeHtml(exercise.gear) + '</p></div>' +
      '<div class="photos' + (hasArt(exerciseId) ? ' is-art' : '') + '">' +
      [0, 1]
        .map(function (index) {
          return (
            '<figure class="photo"><img src="' + photo(exerciseId, index) + '" alt="' +
            escapeHtml(exercise.name) + ', положение ' + (index + 1) +
            '" width="640" height="427" /><figcaption class="num">' + (index + 1) + '</figcaption></figure>'
          );
        })
        .join('') +
      '</div>' +
      (hasArt(exerciseId)
        ? '<p class="credit">Рисунок: <a class="link" href="https://github.com/everkinetic/data" target="_blank" rel="noopener">Everkinetic</a>, CC BY-SA 4.0</p>'
        : '') +
      '<h2 class="group-title">Как делать</h2>' +
      '<ol class="steps">' + steps + '</ol>' +
      '<h2 class="group-title">Следи за этим</h2>' +
      '<p class="note">' + escapeHtml(exercise.tip) + '</p>' +
      (exercise.home
        ? '<h2 class="group-title">Дома</h2><p class="note">' + escapeHtml(exercise.home) + '</p>'
        : '');
  }

  document.addEventListener('click', function (event) {
    var start = event.target.closest('[data-start]');
    if (!start) return;
    var target = start.dataset.start.split('/');
    startSession(target[0], findWorkout(target[0], target[1]));
  });

  // ---------- Запись тренировки ----------

  // 1 подход, 2 подхода, 5 подходов
  function plural(count, one, few, many) {
    var mod10 = count % 10;
    var mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
    return many;
  }

  // От старых к новым
  function sortedWorkouts() {
    return state.workouts.slice().sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return (a.finishedAt || 0) - (b.finishedAt || 0);
    });
  }

  function doneSets(record) {
    return record.items.reduce(function (sum, item) {
      return sum + item.sets.length;
    }, 0);
  }

  // Очередь A → B → C сдвигает только тренировка, пройденная целиком
  function nextWorkoutIndex() {
    var complete = sortedWorkouts().filter(function (record) {
      return record.complete && record.place !== 'gym';
    });
    if (!complete.length) return 0;
    var ids = DATA.programs.home.workouts.map(function (workout) {
      return workout.id;
    });
    return (ids.indexOf(complete[complete.length - 1].workoutId) + 1) % ids.length;
  }

  // Подходы этого упражнения с прошлой тренировки, где оно делалось
  function lastSetsFor(exerciseId) {
    var list = sortedWorkouts();
    for (var index = list.length - 1; index >= 0; index -= 1) {
      var found = list[index].items.filter(function (item) {
        return item.ex === exerciseId && item.sets.length;
      })[0];
      if (found) return found.sets;
    }
    return null;
  }

  // Упражнения без снаряда: вес не спрашиваем
  function isBodyweight(exerciseId) {
    return /^(Свой вес|Турник|Брусья)/.test(DATA.exercises[exerciseId].gear);
  }

  // Планка считается в секундах, а не в повторах
  function isTimed(entry) {
    return entry.reps.indexOf('секунд') !== -1;
  }

  // «8–12 на ногу» → { lo: 8, hi: 12 }. У «до запаса в 2 повтора» диапазона нет.
  function repRange(entry) {
    var match = /(\d+)\s*–\s*(\d+)/.exec(entry.reps);
    return match ? { lo: Number(match[1]), hi: Number(match[2]) } : null;
  }

  // Какие веса можно собрать дома из блинов для этого упражнения, по возрастанию.
  // Блины вешаются парами. На две гантели их приходится делить пополам.
  function homeWeights(exerciseId) {
    var gear = DATA.exercises[exerciseId].gear;
    var pair = /^Гантели/.test(gear);
    var single = /^(Одна гантель|Гантель)/.test(gear);
    if (!pair && !single && !/^Штанга/.test(gear)) return null;

    var sums = [0];
    DATA.homeGear.plates.forEach(function (plate) {
      var pairs = Math.floor(plate.count / 2 / (pair ? 2 : 1));
      var next = [];
      sums.forEach(function (sum) {
        for (var used = 0; used <= pairs; used += 1) next.push(sum + used * plate.kg * 2);
      });
      sums = next;
    });
    var limit = single ? DATA.homeGear.dumbbellMax : Infinity;
    return sums
      .filter(function (sum, index) {
        return sum > 0 && sum <= limit && sums.indexOf(sum) === index;
      })
      .sort(function (a, b) {
        return a - b;
      });
  }

  // Шаг веса больше этой доли считается большим: до него сначала добирают повторы
  var BIG_STEP = 0.1;
  // На сколько повторов выйти за верхнюю границу перед большим шагом
  var EXTRA_REPS = 3;

  // Совет по прошлой тренировке: { text, up }. up — пора добавлять вес.
  // Только совет: цифры в полях приложение не меняет.
  function progressHint(place, entry, previous) {
    var range = repRange(entry);
    if (isTimed(entry)) return null;
    var body = isBodyweight(entry.ex);

    if (!previous) {
      if (!range || body) return null;
      return {
        text: 'Первый раз: возьми вес, с которым сделаешь ' + range.lo + ' ' +
          plural(range.lo, 'повтор', 'повтора', 'повторов') + ' и останется запас ещё на два.'
      };
    }

    if (!range) return { text: 'Цель: хотя бы на повтор больше, чем в прошлый раз.' };

    var weight = body
      ? null
      : Math.max.apply(
          null,
          previous.map(function (set) {
            return set.w;
          })
        );
    var keep = body ? '' : 'Оставь ' + formatNum(weight) + ' кг. ';

    if (previous.length < entry.sets) {
      return {
        text: 'В прошлый раз подходов было меньше. ' + keep + 'Сделай ' +
          (entry.sets === 2 ? 'оба подхода' : 'все ' + entry.sets + ' ' + plural(entry.sets, 'подход', 'подхода', 'подходов')) + '.'
      };
    }

    var lowest = Math.min.apply(
      null,
      previous.map(function (set) {
        return set.r;
      })
    );
    if (lowest < range.hi) {
      return { text: keep + 'Добавляй по повтору, пока не выйдет ' + range.hi + ' во всех подходах.' };
    }

    var reached = 'Все подходы по ' + range.hi + (lowest > range.hi ? ' и больше' : '') + '. ';
    if (body) return { text: reached + 'Усложняй: опускайся медленно, на три счёта.', up: true };

    if (place !== 'home') {
      var heavier = Math.round((weight + weightStep(entry.ex)) * 100) / 100;
      var perDumbbell = /^Гантели/.test(DATA.exercises[entry.ex].gear) ? ' на гантель' : '';
      return {
        text: reached + 'Пора добавить: поставь ' + formatNum(heavier) + ' кг' + perDumbbell + ' и начни с ' + range.lo + ' повторов.',
        up: true
      };
    }

    var options = homeWeights(entry.ex) || [];
    var next = options.filter(function (option) {
      return option > weight;
    })[0];
    var each = /^Гантели/.test(DATA.exercises[entry.ex].gear) ? ' на гантель' : '';

    if (!next) {
      return {
        text: reached + 'Тяжелее из блинов не собрать. Вес тот же: добавляй повторы или опускай вес медленно, на три счёта.',
        up: true
      };
    }
    if ((next - weight) / weight > BIG_STEP && lowest < range.hi + EXTRA_REPS) {
      return {
        text: reached + 'Следующий вес ' + formatNum(next) + ' кг' + each + ', шаг большой. Сначала дойди до ' +
          (range.hi + EXTRA_REPS) + ' повторов с ' + formatNum(weight) + ' кг.'
      };
    }
    return {
      text: reached + 'Пора добавить: поставь ' + formatNum(next) + ' кг' + each + ' и начни с ' + range.lo + ' повторов.',
      up: true
    };
  }

  // «24 кг × 12, 12, 12», «15, 14, 12 раз», «40, 35 с»
  function setsSummary(sets, timed) {
    var sameWeight = sets.every(function (set) {
      return set.w === sets[0].w;
    });
    if (sameWeight) {
      var reps = sets
        .map(function (set) {
          return formatNum(set.r);
        })
        .join(', ');
      if (typeof sets[0].w !== 'number') return reps + (timed ? ' с' : ' раз');
      return formatNum(sets[0].w) + ' кг × ' + reps + (timed ? ' с' : '');
    }
    return sets
      .map(function (set) {
        return (typeof set.w === 'number' ? formatNum(set.w) + ' кг × ' : '') + formatNum(set.r) + (timed ? ' с' : '');
      })
      .join(', ');
  }

  // Подходы для упражнения: вес и повторы подставляются с прошлого раза.
  // Хранятся текстом, как их набрал Игрок.
  function freshSets(exerciseId, count) {
    var previous = lastSetsFor(exerciseId) || [];
    var sets = [];
    for (var index = 0; index < count; index += 1) {
      var before = previous[index] || previous[previous.length - 1];
      sets.push({
        w: before && typeof before.w === 'number' ? formatNum(before.w) : '',
        r: before ? formatNum(before.r) : '',
        done: false
      });
    }
    return sets;
  }

  var TREAD_MINUTES = 5;

  function startSession(place, workout) {
    if (!workout || state.session) return;
    unlockAudio();
    state.session = {
      place: place,
      workoutId: workout.id,
      startedAt: Date.now(),
      rest: null,
      // Перед подходами: 'tread' — дорожка, 'moves' — разминка, null — упражнения
      warm: 'tread',
      treadEndsAt: Date.now() + TREAD_MINUTES * 60000,
      items: workout.items.map(function (entry) {
        return { ex: entry.ex, sets: freshSets(entry.ex, entry.sets) };
      })
    };
    saveState();
    renderAll();
    location.hash = '#session';
  }

  // Упражнение тренировки с учётом замены: ex — что делаем сейчас, orig — что стоит в программе
  function sessionEntry(exIndex) {
    var session = state.session;
    var base = findWorkout(session.place, session.workoutId).items[exIndex];
    return {
      ex: session.items[exIndex].ex || base.ex,
      orig: base.ex,
      sets: base.sets,
      reps: base.reps,
      rest: base.rest
    };
  }

  // Похожие упражнения: все из тех же групп замен
  function swapOptions(entry) {
    var list = [entry.orig];
    DATA.swaps.forEach(function (group) {
      if (group.indexOf(entry.orig) === -1) return;
      group.forEach(function (id) {
        if (list.indexOf(id) === -1 && DATA.exercises[id]) list.push(id);
      });
    });
    return list.filter(function (id) {
      return id !== entry.ex;
    });
  }

  function sessionCounts() {
    var total = 0;
    var done = 0;
    state.session.items.forEach(function (item) {
      item.sets.forEach(function (set) {
        total += 1;
        if (set.done) done += 1;
      });
    });
    return { total: total, done: done };
  }

  var sessionBody = document.getElementById('session-body');
  // Какое упражнение сейчас раскрыто для замены (номер) или null
  var swapOpen = null;

  // Шаг кнопок −/+: гантели по килограмму, штанга и тренажёры по 2,5 кг
  function weightStep(exerciseId) {
    return /^(Гантел|Гантель|Одна гантель)/.test(DATA.exercises[exerciseId].gear) ? 1 : 2.5;
  }

  function setInput(set, key, label, mode) {
    return (
      '<input class="field-input set-input num" type="text" inputmode="' + mode +
      '" autocomplete="off" enterkeyhint="done" data-key="' + key + '" aria-label="' + label +
      '" value="' + escapeHtml(set[key]) + '"' + (set.done ? ' readonly' : '') + ' />'
    );
  }

  // Поле с кнопками сверху и снизу: колонка той же ширины, что у остальных подходов,
  // поэтому кг и повторы стоят ровно друг под другом. Цифру можно и вписать руками.
  function stepper(set, key, label, mode, unit, what) {
    return (
      '<div class="stepper" data-key="' + key + '">' +
      '<button class="step" type="button" data-step="1" aria-label="Больше: ' + what + '">' +
      '<svg class="icon" aria-hidden="true"><use href="#i-plus" /></svg></button>' +
      '<span class="set-field">' + setInput(set, key, label, mode) +
      '<span class="field-unit" aria-hidden="true">' + unit + '</span></span>' +
      '<button class="step" type="button" data-step="-1" aria-label="Меньше: ' + what + '">' +
      '<svg class="icon" aria-hidden="true"><use href="#i-minus" /></svg></button>' +
      '</div>'
    );
  }

  // Кнопки «+ Подход» / «− Подход» под подходами упражнения.
  // Убрать можно только последний несделанный подход, и хотя бы один должен остаться.
  var SETS_MAX = 8;

  function setControls(exIndex, sets) {
    var last = sets[sets.length - 1];
    var canRemove = sets.length > 1 && !last.done;
    var canAdd = sets.length < SETS_MAX;
    return (
      '<div class="set-count">' +
      '<button class="set-count-btn" type="button" data-set-add="' + exIndex + '"' + (canAdd ? '' : ' disabled') + '>' +
      '<svg class="icon" aria-hidden="true"><use href="#i-plus" /></svg>Подход</button>' +
      '<button class="set-count-btn" type="button" data-set-remove="' + exIndex + '"' + (canRemove ? '' : ' disabled') + '>' +
      '<svg class="icon" aria-hidden="true"><use href="#i-minus" /></svg>Подход</button>' +
      '</div>'
    );
  }

  function addSet(exIndex) {
    var sets = state.session.items[exIndex].sets;
    if (sets.length >= SETS_MAX) return;
    var last = sets[sets.length - 1];
    sets.push({ w: last ? last.w : '', r: last ? last.r : '', done: false });
    saveState();
    renderSession({ ex: exIndex, add: true });
  }

  function removeSet(exIndex) {
    var sets = state.session.items[exIndex].sets;
    if (sets.length <= 1 || sets[sets.length - 1].done) return;
    sets.pop();
    // Убрали последний несделанный подход, а всё остальное сделано: отдых больше не нужен
    var counts = sessionCounts();
    if (counts.done === counts.total) stopRest();
    saveState();
    renderSession({ ex: exIndex, remove: true });
  }

  function swapPanel(exIndex, entry) {
    var options = swapOptions(entry);
    if (!options.length) return '<p class="note swap-empty">Похожих упражнений в базе нет.</p>';
    return (
      '<div class="swap" id="swap-' + exIndex + '">' +
      '<p class="swap-title">Чем заменить на сегодня</p>' +
      '<ul class="swap-list">' +
      options
        .map(function (id) {
          var exercise = DATA.exercises[id];
          return (
            '<li><button class="swap-pick" type="button" data-swap="' + exIndex + '" data-to="' + escapeHtml(id) + '">' +
            '<img class="ex-thumb' + (hasArt(id) ? ' is-art' : '') + '" src="' + photo(id, hasArt(id) ? 1 : 0) +
            '" alt="" width="64" height="52" loading="lazy" />' +
            '<span class="ex-text"><span class="ex-name">' + escapeHtml(exercise.name) +
            (id === entry.orig ? ' <span class="tag">из программы</span>' : '') + '</span>' +
            '<span class="ex-sub">' + escapeHtml(exercise.gear) + '</span></span>' +
            '</button></li>'
          );
        })
        .join('') +
      '</ul></div>'
    );
  }

  // ---------- Дорожка и разминка перед подходами ----------

  var treadTimer = null;

  function clock(seconds) {
    var m = Math.floor(seconds / 60);
    var sec = seconds % 60;
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  }

  function warmupMinutes() {
    return STRETCH.warmup ? stretchMinutes(STRETCH.warmup) : 0;
  }

  function warmCard(session) {
    if (session.warm === 'tread') {
      var left = Math.max(0, Math.ceil((session.treadEndsAt - Date.now()) / 1000));
      return (
        '<section class="warm" aria-labelledby="warm-title">' +
        '<ol class="warm-steps" aria-label="Шаг 1 из 3: дорожка">' +
        '<li class="is-now">Дорожка</li><li>Разминка</li><li>Упражнения</li></ol>' +
        '<div class="warm-main">' +
        '<div><h2 class="warm-title" id="warm-title">Дорожка</h2>' +
        '<p class="warm-text">Быстрый шаг или лёгкий бег. Разогрейся до лёгкого пота.</p></div>' +
        '<p class="warm-clock num' + (left ? '' : ' is-over') + '" id="tread-time" role="timer" aria-live="off">' +
        (left ? clock(left) : 'Время') + '</p>' +
        '</div>' +
        '<button class="btn btn-light btn-block" type="button" data-warm="tread-done">Готово, к разминке</button>' +
        '<button class="warm-skip" type="button" data-warm="skip">Пропустить разминку</button>' +
        '</section>'
      );
    }
    if (session.warm === 'moves') {
      return (
        '<section class="warm" aria-labelledby="warm-title">' +
        '<ol class="warm-steps" aria-label="Шаг 2 из 3: разминка">' +
        '<li class="is-done">Дорожка</li><li class="is-now">Разминка</li><li>Упражнения</li></ol>' +
        '<div class="warm-main">' +
        '<div><h2 class="warm-title" id="warm-title">Разминка</h2>' +
        '<p class="warm-text">' + STRETCH.warmup.items.length + ' движений, около ' + formatNum(warmupMinutes()) +
        ' мин. Таймер сам переключает.</p></div>' +
        '</div>' +
        '<a class="btn btn-light btn-block" href="#warmup">Начать разминку</a>' +
        '<button class="warm-skip" type="button" data-warm="skip">Пропустить разминку</button>' +
        '</section>'
      );
    }
    return '';
  }

  // Часы дорожки: раз в секунду, по часам устройства. В ноль — сигнал один раз.
  function runTread() {
    clearInterval(treadTimer);
    treadTimer = null;
    var session = state.session;
    if (!session || session.warm !== 'tread') return;
    treadTimer = setInterval(function () {
      var box = document.getElementById('tread-time');
      if (!state.session || state.session.warm !== 'tread' || !box) {
        clearInterval(treadTimer);
        treadTimer = null;
        return;
      }
      var left = Math.max(0, Math.ceil((state.session.treadEndsAt - Date.now()) / 1000));
      box.textContent = left ? clock(left) : 'Время';
      box.classList.toggle('is-over', !left);
      if (!left && !state.session.treadBeeped) {
        state.session.treadBeeped = true;
        saveState();
        beep();
      }
    }, 1000);
  }

  function warmStep(what) {
    var session = state.session;
    if (!session) return;
    unlockAudio();
    if (what === 'tread-done') {
      session.warm = 'moves';
      saveState();
      location.hash = '#warmup';
      return;
    }
    if (what === 'skip') {
      session.warm = null;
      saveState();
      renderSession('current');
    }
  }

  // focus: куда поставить фокус после перерисовки ('current' или { ex, set, key })
  function renderSession(focus) {
    var session = state.session;
    if (!session) return;
    var workout = findWorkout(session.place, session.workoutId);
    var program = DATA.programs[session.place];
    var counts = sessionCounts();
    var currentFound = false;

    var groups = workout.items
      .map(function (base, exIndex) {
        var entry = sessionEntry(exIndex);
        var exercise = DATA.exercises[entry.ex];
        var timed = isTimed(entry);
        var body = isBodyweight(entry.ex);
        var previous = lastSetsFor(entry.ex);
        var hint = progressHint(session.place, entry, previous);
        var sets = session.items[exIndex].sets;
        var hasCurrent = !currentFound && sets.some(function (set) {
          return !set.done;
        });
        var touched = sets.some(function (set) {
          return set.done;
        });

        var rows = sets
          .map(function (set, setIndex) {
            var current = !set.done && !currentFound;
            if (current) currentFound = true;
            var number = setIndex + 1;
            var fields;
            if (current) {
              fields =
                (body
                  ? '<span class="set-none">свой вес</span>'
                  : stepper(set, 'w', 'Вес в килограммах, подход ' + number, 'decimal', 'кг', 'вес')) +
                stepper(set, 'r', (timed ? 'Секунды' : 'Повторы') + ', подход ' + number, 'numeric', timed ? 'с' : 'раз',
                  timed ? 'секунды' : 'повторы');
            } else {
              fields =
                (body
                  ? '<span class="set-none">свой вес</span>'
                  : '<span class="set-field">' + setInput(set, 'w', 'Вес в килограммах, подход ' + number, 'decimal') +
                    '<span class="field-unit" aria-hidden="true">кг</span></span>') +
                '<span class="set-field">' +
                setInput(set, 'r', (timed ? 'Секунды' : 'Повторы') + ', подход ' + number, 'numeric') +
                '<span class="field-unit" aria-hidden="true">' + (timed ? 'с' : 'раз') + '</span></span>';
            }
            return (
              '<li class="set' + (set.done ? ' is-done' : '') + (current ? ' is-current' : '') +
              '" data-ex="' + exIndex + '" data-set="' + setIndex + '">' +
              '<span class="set-no num" aria-hidden="true">' + number + '</span>' +
              fields +
              '<button class="set-done" type="button" aria-pressed="' + set.done + '" aria-label="Подход ' +
              number + ' сделан"><svg class="icon" aria-hidden="true"><use href="#i-check" /></svg></button>' +
              '<p class="field-error" role="alert" hidden></p></li>'
            );
          })
          .join('');

        var swapped = entry.ex !== entry.orig;
        var canSwap = !touched && swapOptions(entry).length;
        var open = swapOpen === exIndex && canSwap;

        return (
          '<section class="set-group' + (hasCurrent ? ' is-current' : '') + '" aria-label="' + escapeHtml(exercise.name) + '">' +
          (hasCurrent ? '<a class="set-art" href="#exercise/' + encodeURIComponent(entry.ex) + '" aria-label="Техника: ' +
            escapeHtml(exercise.name) + '">' + frames(entry.ex) + '</a>' : '') +
          exerciseRow(entry.ex, entry.sets + ' × ' + entry.reps + ' · отдых ' + restText(restFor(entry))) +
          (swapped
            ? '<p class="set-swapped">Замена на сегодня вместо «' + escapeHtml(DATA.exercises[entry.orig].name) + '»</p>'
            : '') +
          (canSwap
            ? '<button class="swap-toggle" type="button" data-swap-open="' + exIndex + '" aria-expanded="' + !!open +
              '" aria-controls="swap-' + exIndex + '">' + (open ? 'Не менять' : swapped ? 'Другая замена' : 'Заменить') + '</button>'
            : '') +
          (open ? swapPanel(exIndex, entry) : '') +
          (previous
            ? '<p class="set-prev num">Прошлый раз: ' + setsSummary(previous, timed) + '</p>'
            : '') +
          (hint ? '<p class="set-hint num' + (hint.up ? ' is-up' : '') + '">' + escapeHtml(hint.text) + '</p>' : '') +
          '<ol class="sets">' + rows + '</ol>' + setControls(exIndex, sets) + '</section>'
        );
      })
      .join('');

    var end = '';
    if (counts.done === counts.total) {
      end = '<button class="btn btn-block" type="button" id="session-end">Завершить тренировку</button>';
    } else if (counts.done) {
      end = '<button class="btn btn-ghost btn-block" type="button" id="session-end">Закончить досрочно</button>';
    } else {
      end = '<button class="btn btn-danger" type="button" id="session-end">Отменить тренировку</button>';
    }

    sessionBody.innerHTML =
      '<section class="session-head">' +
      '<div class="session-count"><span class="num"><b>' + counts.done + '</b> из ' + counts.total + '</span>' +
      '<span>подходов</span></div>' +
      '<span class="session-bar" role="progressbar" aria-label="Сделано подходов" aria-valuemin="0" aria-valuemax="' +
      counts.total + '" aria-valuenow="' + counts.done + '"><span style="transform: scaleX(' +
      (counts.done / counts.total) + ')"></span></span>' +
      '</section>' +
      warmCard(session) +
      (counts.done
        ? ''
        : '<details class="fold folds"' + (session.warm ? '' : ' open') + '><summary>Перед стартом<svg class="icon" aria-hidden="true"><use href="#i-next" /></svg></summary>' +
          '<div class="fold-body"><p><b>' + escapeHtml(workout.gear) + '.</b> ' + escapeHtml(workout.setup) + '</p>' +
          '<p>Разминка: ' + escapeHtml(program.warmup) + '</p></div></details>') +
      groups +
      '<h2 class="group-title">Заминка</h2>' +
      '<p class="note">' + escapeHtml(program.cooldown) + '</p>' +
      end;

    runTread();
    var endButton = document.getElementById('session-end');
    if (counts.done === counts.total) {
      endButton.addEventListener('click', finishSession);
    } else if (counts.done) {
      armConfirm(endButton, 'Сделано ' + counts.done + ' из ' + counts.total + '. Нажми ещё раз', finishSession);
    } else {
      armConfirm(endButton, 'Нажми ещё раз, чтобы отменить', finishSession);
    }

    var target = null;
    if (focus === 'current') {
      target = sessionBody.querySelector('.set.is-current .set-done') || endButton;
    } else if (focus && typeof focus === 'object' && (focus.add || focus.remove)) {
      target = sessionBody.querySelector(
        '[data-set-' + (focus.add ? 'add' : 'remove') + '="' + focus.ex + '"]:not([disabled])'
      ) || sessionBody.querySelector('[data-set-add="' + focus.ex + '"]');
    } else if (focus && typeof focus === 'object' && focus.swap !== undefined) {
      target = sessionBody.querySelector('[data-swap-open="' + focus.swap + '"]');
    } else if (focus && typeof focus === 'object') {
      target = sessionBody.querySelector(
        '.set[data-ex="' + focus.ex + '"][data-set="' + focus.set + '"] [data-key="' + focus.key + '"]'
      );
    }
    if (target) target.focus({ preventScroll: true });
  }

  // Действие в два касания: первое меняет подпись, второе выполняет
  function armConfirm(button, armedText, action) {
    var armed = false;
    var timer = null;
    var label = button.textContent;
    button.addEventListener('click', function () {
      if (!armed) {
        armed = true;
        button.textContent = armedText;
        button.classList.add('is-armed');
        timer = setTimeout(function () {
          armed = false;
          button.textContent = label;
          button.classList.remove('is-armed');
        }, 4000);
        return;
      }
      clearTimeout(timer);
      action();
    });
  }

  // Что не так с подходом: { key, text } или null
  function checkSet(entry, set) {
    if (!isBodyweight(entry.ex)) {
      var weight = parseNum(set.w);
      if (weight === null || isNaN(weight) || weight < 0.5 || weight > 500) {
        return { key: 'w', text: 'Впиши вес: число от 0,5 до 500.' };
      }
    }
    var timed = isTimed(entry);
    var reps = parseNum(set.r);
    if (reps === null || isNaN(reps) || reps % 1 !== 0 || reps < 1 || reps > (timed ? 3600 : 200)) {
      return {
        key: 'r',
        text: timed
          ? 'Впиши время в секундах: целое число от 1 до 3600.'
          : 'Впиши повторы: целое число от 1 до 200.'
      };
    }
    return null;
  }

  function toggleSet(row) {
    var session = state.session;
    var exIndex = Number(row.dataset.ex);
    var setIndex = Number(row.dataset.set);
    var entry = sessionEntry(exIndex);
    var sets = session.items[exIndex].sets;
    var set = sets[setIndex];
    unlockAudio();

    // Повторное нажатие снимает отметку, чтобы поправить цифры
    if (set.done) {
      set.done = false;
      saveState();
      renderSession({ ex: exIndex, set: setIndex, key: 'r' });
      return;
    }

    var problem = checkSet(entry, set);
    if (problem) {
      var input = row.querySelector('.set-input[data-key="' + problem.key + '"]');
      var error = row.querySelector('.field-error');
      error.textContent = problem.text;
      error.hidden = false;
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      return;
    }

    set.done = true;
    swapOpen = null;
    // Следующие подходы наследуют цифры, если Игрок их ещё не трогал
    sets.forEach(function (other, index) {
      if (index <= setIndex || other.done) return;
      if (!other.w) other.w = set.w;
      if (!other.r) other.r = set.r;
    });

    var counts = sessionCounts();
    if (counts.done < counts.total) startRest(restFor(entry), entry.ex);
    else stopRest();
    saveState();
    renderSession('current');
  }

  // −/+ у текущего подхода: вес шагом снаряда, повторы по одному
  function stepValue(button) {
    var row = button.closest('.set');
    var key = button.closest('.stepper').dataset.key;
    var exIndex = Number(row.dataset.ex);
    var entry = sessionEntry(exIndex);
    var set = state.session.items[exIndex].sets[Number(row.dataset.set)];
    var direction = Number(button.dataset.step);
    var value = parseNum(set[key]);
    if (value === null || isNaN(value)) value = 0;
    var next;
    if (key === 'w') {
      var step = weightStep(entry.ex);
      // Нестандартный вес (например, 23 при шаге 2,5) сначала встаёт на ближайший шаг: 22,5 или 25
      var onStep = Math.abs(value / step - Math.round(value / step)) < 1e-6;
      if (onStep) next = value + direction * step;
      else next = (direction > 0 ? Math.ceil(value / step) : Math.floor(value / step)) * step;
      next = Math.max(0, Math.round(next * 100) / 100);
    } else {
      next = Math.max(1, Math.round(value) + direction);
    }
    set[key] = next ? formatNum(next) : '';
    saveState();
    var input = row.querySelector('.set-input[data-key="' + key + '"]');
    input.value = set[key];
    input.removeAttribute('aria-invalid');
    row.querySelector('.field-error').hidden = true;
  }

  function swapExercise(exIndex, to) {
    var item = state.session.items[exIndex];
    if (!DATA.exercises[to] || item.sets.some(function (set) { return set.done; })) return;
    item.ex = to;
    item.sets = freshSets(to, item.sets.length);
    swapOpen = null;
    saveState();
    renderSession({ swap: exIndex });
  }

  sessionBody.addEventListener('click', function (event) {
    var step = event.target.closest('.step');
    if (step) {
      stepValue(step);
      return;
    }
    var warm = event.target.closest('[data-warm]');
    if (warm) {
      warmStep(warm.dataset.warm);
      return;
    }
    var add = event.target.closest('[data-set-add]');
    if (add) {
      addSet(Number(add.dataset.setAdd));
      return;
    }
    var remove = event.target.closest('[data-set-remove]');
    if (remove) {
      removeSet(Number(remove.dataset.setRemove));
      return;
    }
    var toggle = event.target.closest('[data-swap-open]');
    if (toggle) {
      var index = Number(toggle.dataset.swapOpen);
      swapOpen = swapOpen === index ? null : index;
      renderSession({ swap: index });
      return;
    }
    var pick = event.target.closest('[data-swap]');
    if (pick) {
      swapExercise(Number(pick.dataset.swap), pick.dataset.to);
      return;
    }
    var button = event.target.closest('.set-done');
    if (button) toggleSet(button.closest('.set'));
  });

  sessionBody.addEventListener('input', function (event) {
    var input = event.target.closest('.set-input');
    if (!input || !state.session) return;
    var row = input.closest('.set');
    state.session.items[Number(row.dataset.ex)].sets[Number(row.dataset.set)][input.dataset.key] = input.value;
    saveState();
    if (input.getAttribute('aria-invalid')) {
      input.removeAttribute('aria-invalid');
      row.querySelector('.field-error').hidden = true;
    }
  });

  // «Готово» на клавиатуре отмечает подход
  sessionBody.addEventListener('keydown', function (event) {
    var input = event.target.closest('.set-input');
    if (!input || event.key !== 'Enter') return;
    event.preventDefault();
    var row = input.closest('.set');
    if (!row.classList.contains('is-done')) toggleSet(row);
  });

  function finishSession() {
    var session = state.session;
    if (!session) return;
    var workout = findWorkout(session.place, session.workoutId);
    var counts = sessionCounts();
    var planned = workout.items.reduce(function (sum, entry) {
      return sum + entry.sets;
    }, 0);
    var home = '#workout/' + session.place + '/' + session.workoutId;
    clearInterval(restTimer);
    letSleep();

    // Ни одного подхода: записывать нечего
    if (!counts.done) {
      state.session = null;
      saveState();
      renderAll();
      paintRest();
      location.replace(home);
      return;
    }

    var record = {
      id: String(Date.now()),
      date: isoDate(new Date(session.startedAt)),
      place: session.place,
      workoutId: session.workoutId,
      startedAt: session.startedAt,
      finishedAt: Date.now(),
      // Целиком: всё отмечено и подходов не меньше, чем в программе
      complete: counts.done === counts.total && counts.done >= planned,
      total: Math.max(counts.total, planned),
      items: workout.items.map(function (entry, index) {
        // Если упражнение заменили, в историю идёт то, что реально делал
        var ex = session.items[index].ex || entry.ex;
        var item = {
          ex: ex,
          sets: session.items[index].sets
            .filter(function (set) {
              return set.done;
            })
            .map(function (set) {
              return { w: isBodyweight(ex) ? null : parseNum(set.w), r: parseNum(set.r) };
            })
        };
        if (ex !== entry.ex) item.swappedFrom = entry.ex;
        if (isTimed(entry)) item.timed = true;
        return item;
      })
    };

    state.workouts.push(record);
    justFinished = record.id;
    state.session = null;
    saveState();
    renderAll();
    paintRest();
    location.replace('#log/' + record.id);
  }

  // Запись, которую только что закончили: экран записи празднует её
  var justFinished = null;

  // ---------- Таймер отдыха ----------

  var restBar = document.getElementById('rest-bar');
  var restFill = document.getElementById('rest-fill');
  var restLabel = document.getElementById('rest-label');
  var restTime = document.getElementById('rest-time');
  var restSkip = document.getElementById('rest-skip');
  var restLess = document.getElementById('rest-less');
  var restStatus = document.getElementById('rest-status');
  var restTimer = null;

  function startRest(seconds, exerciseId) {
    state.session.rest = { endsAt: Date.now() + seconds * 1000, total: seconds, over: false, ex: exerciseId || null };
    restStatus.textContent = '';
    runRest();
  }

  function stopRest() {
    if (state.session) state.session.rest = null;
    runRest();
  }

  function runRest() {
    clearInterval(restTimer);
    restTimer = null;
    var rest = state.session && state.session.rest;
    if (rest && !rest.over) restTimer = setInterval(paintRest, 250);
    paintRest();
  }

  // Время считается от часов, а не от тиков: таймер не врёт после сна вкладки
  function paintRest() {
    var rest = state.session && state.session.rest;
    restBar.hidden = !rest;
    if (!rest) return;

    var left = Math.max(0, (rest.endsAt - Date.now()) / 1000);
    if (left === 0 && !rest.over) {
      rest.over = true;
      saveState();
      clearInterval(restTimer);
      restTimer = null;
      beep();
      restStatus.textContent = 'Отдых окончен.';
    }

    var seconds = Math.ceil(left);
    restBar.classList.toggle('is-over', rest.over);
    restLabel.textContent = rest.over ? 'Отдых окончен' : 'Отдых';
    restTime.textContent = Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
    restSkip.textContent = rest.over ? 'Скрыть' : 'Пропустить';
    restLess.disabled = rest.over || rest.total <= REST_MIN;
    restFill.style.scale = (rest.over ? 1 : Math.min(1, left / rest.total)) + ' 1';
  }

  // −15 / +15 секунд. Пока отдых идёт, новое время запоминается для этого упражнения:
  // в следующий раз отдых сразу будет таким. Когда отдых уже кончился, «+15» просто
  // даёт ещё 15 секунд и ничего не запоминает.
  function adjustRest(delta) {
    var rest = state.session && state.session.rest;
    if (!rest) return;
    unlockAudio();
    if (rest.over) {
      if (delta < 0) return;
      rest.total = REST_STEP;
      rest.endsAt = Date.now() + REST_STEP * 1000;
      rest.over = false;
    } else {
      var total = Math.min(REST_MAX, Math.max(REST_MIN, rest.total + delta));
      var change = total - rest.total;
      if (!change) return;
      rest.total = total;
      rest.endsAt += change * 1000;
      if (rest.ex) state.restPref[rest.ex] = total;
      restStatus.textContent = 'Отдых ' + restText(total) + ', запомнил для этого упражнения.';
      if (rest.endsAt <= Date.now()) rest.endsAt = Date.now();
    }
    saveState();
    runRest();
  }

  document.getElementById('rest-less').addEventListener('click', function () {
    adjustRest(-REST_STEP);
  });
  document.getElementById('rest-more').addEventListener('click', function () {
    adjustRest(REST_STEP);
  });

  restSkip.addEventListener('click', function () {
    stopRest();
    saveState();
  });

  // Сигнал конца отдыха. Браузер разрешает звук только после касания,
  // поэтому звук «открывается» при первой отметке подхода.
  var audio = null;

  // Вызывается на каждое касание во время тренировки: звук и «не гасить экран»
  // айфон разрешает включать только в ответ на касание
  function unlockAudio() {
    try {
      var Context = window.AudioContext || window.webkitAudioContext;
      if (!audio && Context) audio = new Context();
      if (audio && audio.state === 'suspended') audio.resume();
    } catch (error) {
      audio = null;
    }
    if (state.session) keepAwake();
  }

  // ---------- Экран не гаснет во время тренировки ----------
  // keepAwake / letSleep живут в разделе растяжки (Screen Wake Lock, на айфоне
  // с иконки рабочего стола работает с iOS 18.4). Айфон сам снимает блокировку,
  // когда приложение свернули, поэтому включаем заново при каждом касании.

  // Вернулся в приложение посреди тренировки: Safari иногда даёт включить сразу
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && state.session) keepAwake();
  });

  // Сигнал конца отдыха должен пробить беззвучный режим. Обычный звук сайта («ambient»)
  // беззвучный режим глушит, «playback» нет, но может приостановить музыку.
  // Поэтому «playback» включаем только на время сигнала и сразу возвращаем обратно.
  var loudTimer = null;

  function loudFor(seconds) {
    var session = navigator.audioSession;
    if (!session) return;
    try {
      session.type = 'playback';
      clearTimeout(loudTimer);
      loudTimer = setTimeout(function () {
        try {
          session.type = 'auto';
        } catch (error) {
          // ничего
        }
      }, seconds * 1000);
    } catch (error) {
      // браузер не умеет — играем как обычно
    }
  }

  // Сигналы: без названия — двойной (конец отдыха, конец упражнения),
  // 'go' — один повыше (начинай держать), 'tick' — тихий отсчёт последних секунд
  var BEEPS = {
    end: { at: [0, 0.24, 0.48], hz: 880, gain: 0.5, len: 0.18 },
    go: { at: [0], hz: 1046, gain: 0.3, len: 0.32 },
    tick: { at: [0], hz: 660, gain: 0.08, len: 0.08 }
  };

  function beep(kind) {
    if (!audio) return;
    var sound = BEEPS[kind] || BEEPS.end;
    if (sound === BEEPS.end) loudFor(1.5);
    try {
      if (audio.state === 'suspended') audio.resume();
      sound.at.forEach(function (offset) {
        var start = audio.currentTime + offset;
        var tone = audio.createOscillator();
        var volume = audio.createGain();
        tone.type = 'sine';
        tone.frequency.value = sound.hz;
        volume.gain.setValueAtTime(0.0001, start);
        volume.gain.exponentialRampToValueAtTime(sound.gain, start + 0.02);
        volume.gain.exponentialRampToValueAtTime(0.0001, start + sound.len);
        tone.connect(volume);
        volume.connect(audio.destination);
        tone.start(start);
        tone.stop(start + sound.len + 0.02);
      });
    } catch (error) {
      // Без звука таймер всё равно покажет, что отдых окончен
    }
  }

  // ---------- Запись в истории ----------

  function renderLog(record) {
    var done = doneSets(record);
    var rows = [row('Подходы', done + ' из ' + record.total)];
    if (record.startedAt && record.finishedAt) {
      rows.push(row('Время', Math.max(1, Math.round((record.finishedAt - record.startedAt) / 60000)) + ' мин'));
    }

    var items = record.items
      .map(function (item) {
        var exercise = DATA.exercises[item.ex];
        return (
          '<li><span class="log-name">' + escapeHtml(exercise ? exercise.name : item.ex) +
          (item.swappedFrom ? ' <span class="tag">замена</span>' : '') + '</span>' +
          (item.sets.length
            ? '<span class="log-sets num">' + setsSummary(item.sets, item.timed) + '</span>'
            : '<span class="log-sets is-empty">не делал</span>') +
          '</li>'
        );
      })
      .join('');

    var xp = strengthXp(record);
    var fresh = justFinished === record.id;
    justFinished = null;
    // Сегодняшняя силовая: сразу предлагаем заминку под мышцы дня
    var cool = record.date === todayIso() ? cooldownRoutine(cooldownDay(record.place, record.workoutId)) : null;
    if (cool && stretchDoneToday(cool.id)) cool = null;

    document.getElementById('detail-body').innerHTML =
      '<section class="done-card' + (fresh ? ' is-fresh' : '') + '">' +
      '<p class="done-xp num">+' + xp + '<span>опыта</span></p>' +
      '<h2 class="done-title">' + escapeHtml(workoutLabel(record.place, record.workoutId)) +
      (record.complete ? ': сделано' : ': не целиком') + '</h2>' +
      '<p class="done-sub">' + formatDate(record.date) +
      (record.complete ? '' : '. Очередь не сдвинулась: в следующий раз снова ' +
        escapeHtml(workoutShort(record.place, record.workoutId))) + '.</p>' +
      (cool
        ? '<p class="done-next">Теперь заминка: ' + cool.items.length + ' ' + plural(cool.items.length, 'растяжка', 'растяжки', 'растяжек') +
          ' на ' + escapeHtml(STRETCH.cooldown.days[cooldownDay(record.place, record.workoutId)].title.toLowerCase()) +
          ', около ' + stretchMinutes(cool) + ' мин, +' + XP.stretch + ' опыта.</p>' +
          '<div class="done-actions"><a class="btn btn-light" href="#stretch-run/' + cool.id + '">Начать заминку</a>' +
          (fresh ? '<a class="btn btn-light-ghost" href="#today">Потом</a>' : '') + '</div>'
        : fresh ? '<a class="btn btn-light" href="#today">На гору</a>' : '') +
      '</section>' +
      '<dl class="rows rows-flat">' + rows.join('') + '</dl>' +
      '<h2 class="group-title">Упражнения</h2>' +
      '<ul class="list log-list">' + items + '</ul>' +
      '<button class="btn btn-danger" type="button" id="delete-log">Удалить запись</button>';

    armConfirm(document.getElementById('delete-log'), 'Нажми ещё раз, чтобы удалить', function () {
      state.workouts = state.workouts.filter(function (item) {
        return item.id !== record.id;
      });
      saveState();
      renderAll();
      location.replace('#strength');
    });
  }

  // ---------- Растяжка ----------

  var MOVES = STRETCH.moves || {};

  // Комплекс по шагам: упражнение на обе стороны — два шага
  function stretchSteps(routine) {
    var steps = [];
    routine.items.forEach(function (item) {
      if (item.sides) {
        steps.push({ id: item.id, hold: item.hold, side: 'левая сторона' });
        steps.push({ id: item.id, hold: item.hold, side: 'правая сторона' });
      } else {
        steps.push({ id: item.id, hold: item.hold, side: '' });
      }
    });
    return steps;
  }

  function stretchDoneToday(id) {
    var today = todayIso();
    return state.stretch.filter(function (record) {
      return record.date === today && (!id || record.routine === id);
    })[0] || null;
  }

  function holdText(item) {
    return item.hold + ' с' + (item.sides ? ' на сторону' : '');
  }

  function stretchHistory() {
    var html = state.stretch
      .slice()
      .sort(function (a, b) {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        return (b.doneAt || 0) - (a.doneAt || 0);
      })
      .map(function (record) {
        var routine = stretchRoutine(record.routine);
        return (
          '<li><div class="history-row is-static">' +
          '<span class="history-date">' + formatDate(record.date) + '</span>' +
          '<span class="history-sum">' + escapeHtml(routine ? routine.title : record.routine) + '</span></div></li>'
        );
      });
    return foldedList(html, 'Пока пусто. Запись появится, когда пройдёшь комплекс до конца.');
  }

  // Список комплексов или один комплекс перед стартом
  function renderStretch() {
    var parts = location.hash.replace('#', '').split('/');
    var routine = parts[1] ? stretchRoutine(decodeURIComponent(parts[1])) : null;
    var body = document.getElementById('stretch-body');

    if (routine) {
      var done = stretchDoneToday(routine.id);
      body.innerHTML =
        '<section class="lead lead-stretch" aria-labelledby="stretch-title">' +
        '<h2 class="lead-title" id="stretch-title">' + escapeHtml(routine.title) + '</h2>' +
        '<p class="lead-sub num">' + escapeHtml(routine.about) + ' · ~' + stretchMinutes(routine) + ' мин · +' +
        XP.stretch + ' опыта</p>' +
        (done ? '<p class="lead-sub"><b>Сегодня уже сделан.</b> Можно ещё раз, опыт за день начисляется один раз.</p>' : '') +
        '<div class="lead-actions"><a class="btn btn-light" href="#stretch-run/' + routine.id + '">' +
        '<svg class="icon" aria-hidden="true"><use href="#i-play" /></svg>Начать</a></div>' +
        '</section>' +
        '<h2 class="group-title">Упражнения <span class="group-sub num">' + routine.items.length + '</span></h2>' +
        '<ol class="list ex-list">' +
        routine.items.map(function (item) {
          var moveInfo = MOVES[item.id];
          return (
            '<li><div class="ex-row is-static">' +
            '<img class="ex-thumb" src="' + photo(item.id, 1) + '" alt="" width="64" height="52" loading="lazy" />' +
            '<span class="ex-text"><span class="ex-name">' + escapeHtml(moveInfo.name) + '</span>' +
            '<span class="ex-sub num">' + holdText(item) + ' · ' + escapeHtml(moveInfo.feel.toLowerCase()) + '</span></span>' +
            '</div></li>'
          );
        }).join('') +
        '</ol>' +
        '<h2 class="group-title">Как тянуться</h2>' +
        '<ul class="rules">' +
        STRETCH.rules.map(function (rule) {
          return '<li>' + escapeHtml(rule) + '</li>';
        }).join('') +
        '</ul>';
      return;
    }

    var suggested = new Date().getHours() < 12 ? 'morning' : 'body';
    body.innerHTML =
      '<p class="note">Включи комплекс, положи телефон рядом и тянись: таймер сам переключает упражнения и подаёт сигнал. За комплекс +' +
      XP.stretch + ' опыта, один раз в день.</p>' +
      '<div class="routines">' +
      STRETCH.routines.map(function (routine) {
        var done = stretchDoneToday(routine.id);
        return (
          '<a class="routine' + (routine.id === suggested ? ' is-suggested' : '') + '" href="#stretch/' + routine.id + '">' +
          '<span class="routine-top"><span class="routine-title">' + escapeHtml(routine.title) + '</span>' +
          (done
            ? '<span class="tile-state"><svg class="icon" aria-hidden="true"><use href="#i-check" /></svg>Сегодня</span>'
            : routine.id === suggested ? '<span class="tile-state">Сейчас в самый раз</span>' : '') +
          '</span>' +
          '<span class="routine-about">' + escapeHtml(routine.about) + '</span>' +
          '<span class="routine-meta num">~' + stretchMinutes(routine) + ' мин · ' + routine.items.length + ' упражнений</span>' +
          '<span class="routine-thumbs" aria-hidden="true">' +
          routine.items.slice(0, 4).map(function (item) {
            return '<img src="' + photo(item.id, 1) + '" alt="" loading="lazy" />';
          }).join('') +
          '</span></a>'
        );
      }).join('') +
      '</div>' +
      '<h2 class="group-title">История</h2>' +
      stretchHistory() +
      '<p class="note">Зачем: растяжка держит суставы подвижными. Минимум 2 раза в неделю, около минуты на упражнение. ' +
      '<a class="link" href="' + STRETCH.source.url + '" target="_blank" rel="noopener">Источник: ACSM, 2011</a></p>';
  }

  // ---------- Растяжка идёт ----------

  // run: { routine, steps, index, phase: 'ready' | 'hold' | 'gap' | 'done', endsAt, left, paused, held, total }
  var run = null;
  var runFrame = null;
  var runTimer = null;
  var wakeLock = null;
  var RING = 2 * Math.PI * 88;
  var READY = 5;

  function keepAwake() {
    if (!navigator.wakeLock || wakeLock) return;
    navigator.wakeLock.request('screen').then(function (lock) {
      wakeLock = lock;
      lock.addEventListener('release', function () {
        wakeLock = null;
      });
    }).catch(function () {
      // Экран может погаснуть: таймер всё равно идёт по часам
    });
  }

  function letSleep() {
    if (wakeLock) wakeLock.release().catch(function () {});
    wakeLock = null;
  }

  // Экран снова виден: блокировка сна снимается системой, просим заново
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && run && run.phase !== 'done' && !run.paused) keepAwake();
  });

  function startRun(routine) {
    unlockAudio();
    var steps = stretchSteps(routine);
    run = {
      routine: routine,
      steps: steps,
      index: 0,
      phase: 'ready',
      endsAt: Date.now() + READY * 1000,
      left: READY * 1000,
      paused: false,
      held: 0,
      total: steps.reduce(function (sum, step) {
        return sum + step.hold;
      }, 0)
    };
    keepAwake();
    paintRun(true);
    tickRun();
  }

  function stopRun() {
    cancelAnimationFrame(runFrame);
    clearInterval(runTimer);
    runFrame = null;
    runTimer = null;
    letSleep();
    run = null;
  }

  function phaseLength() {
    if (run.phase === 'hold') return run.steps[run.index].hold;
    return run.phase === 'ready' ? READY : STRETCH.gap;
  }

  // Переход к следующей фазе: приготовься → держи → переход → держи … → готово
  // Сколько секунд реально продержал в текущей позе (паузы не считаются)
  function heldNow() {
    if (run.phase !== 'hold') return 0;
    var left = run.paused ? run.left : Math.max(0, run.endsAt - Date.now());
    return phaseLength() * 1000 - left;
  }

  function advanceRun() {
    if (run.phase === 'hold') {
      run.held += phaseLength() * 1000;
      if (run.index >= run.steps.length - 1) {
        finishRun();
        return;
      }
      run.phase = 'gap';
      beep();
    } else {
      if (run.phase === 'gap') run.index += 1;
      run.phase = 'hold';
      beep('go');
    }
    run.left = phaseLength() * 1000;
    run.endsAt = Date.now() + run.left;
    paintRun(true);
  }

  function jumpRun(step) {
    if (!run || run.phase === 'done') return;
    var index = Math.max(0, Math.min(run.steps.length - 1, run.index + step));
    run.held += heldNow();
    if (step > 0 && run.index === run.steps.length - 1) {
      finishRun();
      return;
    }
    run.index = index;
    run.phase = 'hold';
    run.left = phaseLength() * 1000;
    run.endsAt = Date.now() + run.left;
    paintRun(true);
  }

  function togglePause() {
    if (!run || run.phase === 'done') return;
    unlockAudio();
    if (run.paused) {
      run.paused = false;
      run.endsAt = Date.now() + run.left;
      keepAwake();
    } else {
      run.left = Math.max(0, run.endsAt - Date.now());
      run.paused = true;
      letSleep();
    }
    paintRun(false);
  }

  // Время считается по часам: таймер не врёт, даже если вкладка засыпала
  function tickRun() {
    cancelAnimationFrame(runFrame);
    clearInterval(runTimer);
    function step() {
      if (!run || run.phase === 'done') return;
      var now = Date.now();
      if (!run.paused) {
        var left = run.endsAt - now;
        if (left <= 0) advanceRun();
        else if (run.phase === 'hold' && Math.ceil(left / 1000) <= 3 && Math.ceil(left / 1000) !== run.ticked) {
          run.ticked = Math.ceil(left / 1000);
          beep('tick');
        }
      }
      paintClock();
    }
    // Кадры для плавного круга, интервал — на случай, если кадры не идут (экран погас)
    function frame() {
      step();
      if (run && run.phase !== 'done') runFrame = requestAnimationFrame(frame);
    }
    runFrame = requestAnimationFrame(frame);
    runTimer = setInterval(step, 500);
  }

  function finishRun() {
    var routine = run.routine;
    // Разминка: ничего не записываем, просто переходим к упражнениям
    if (routine.warmup) {
      cancelAnimationFrame(runFrame);
      clearInterval(runTimer);
      run = null;
      if (state.session) {
        state.session.warm = null;
        saveState();
      }
      beep();
      location.replace('#session');
      return;
    }
    var counted = run.held / 1000 >= run.total / 2;
    var already = stretchDoneToday();
    if (counted) {
      state.stretch.push({ id: String(Date.now()), date: todayIso(), routine: routine.id, doneAt: Date.now() });
      saveState();
    }
    run.phase = 'done';
    run.counted = counted;
    run.xp = counted && !already ? XP.stretch : 0;
    cancelAnimationFrame(runFrame);
    clearInterval(runTimer);
    letSleep();
    beep();
    paintRun(true);
  }

  // Полная перерисовка — при смене упражнения; часы — каждый кадр
  function paintRun(full) {
    var box = document.getElementById('run-body');
    if (!run) return;

    if (run.phase === 'done') {
      var minutes = Math.max(1, Math.round(run.held / 60000));
      box.innerHTML =
        '<div class="run-done">' +
        (run.counted
          ? '<p class="done-xp num">+' + run.xp + '<span>опыта</span></p>' +
            '<h1 class="done-title" id="run-title">' + escapeHtml(run.routine.title) + ': готово</h1>' +
            '<p class="done-sub num">' + minutes + ' ' + plural(minutes, 'минута', 'минуты', 'минут') + ' растяжки' +
            (run.xp ? '' : '. Опыт за растяжку сегодня уже начислен') + '.</p>' +
            '<a class="btn btn-light" href="#today">На гору</a>'
          : '<h1 class="done-title" id="run-title">Пройдено меньше половины</h1>' +
            '<p class="done-sub">Опыт и запись даются, когда комплекс пройден хотя бы наполовину.</p>' +
            '<a class="btn btn-light" href="#stretch-run/' + run.routine.id + '">Начать заново</a>' +
            '<a class="btn btn-light-ghost" href="#stretch">К растяжке</a>') +
        '</div>';
      document.getElementById('run-status').textContent = run.counted ? 'Комплекс готов.' : 'Комплекс прерван.';
      return;
    }

    var stepInfo = run.steps[run.index];
    var moveInfo = MOVES[stepInfo.id];
    var nextStep = run.steps[run.index + 1];
    // В переходе и перед стартом показываем то, что будет дальше
    var shown = run.phase === 'hold' ? stepInfo : run.phase === 'ready' ? run.steps[0] : nextStep;
    var shownMove = MOVES[shown.id];

    if (full) {
      box.innerHTML =
        '<div class="run">' +
        '<header class="run-top">' +
        '<a class="run-close" href="' + (run.routine.warmup ? '#session' : '#stretch/' + run.routine.id) +
        '" aria-label="' + (run.routine.warmup ? 'Выйти из разминки в тренировку' : 'Остановить и выйти') + '">' +
        '<svg class="icon" aria-hidden="true"><use href="#i-close" /></svg></a>' +
        '<ol class="run-steps" aria-label="Шаг ' + (run.index + 1) + ' из ' + run.steps.length + '">' +
        run.steps.map(function (item, index) {
          var cls = index < run.index || (index === run.index && run.phase === 'gap') ? ' is-done' : index === run.index && run.phase === 'hold' ? ' is-now' : '';
          return '<li class="' + cls.trim() + '"><span' + (index === run.index && run.phase === 'hold' ? ' id="run-step-fill"' : '') + '></span></li>';
        }).join('') +
        '</ol>' +
        '</header>' +
        '<figure class="run-photo' + (run.phase === 'hold' ? '' : ' is-next') + '">' +
        '<img src="' + photo(shown.id, 0) + '" alt="" />' +
        '<img class="run-photo-b" src="' + photo(shown.id, 1) + '" alt="' + escapeHtml(shownMove.name) + '" />' +
        (run.phase === 'hold' ? '' : '<figcaption>' + (run.phase === 'ready' ? 'Приготовься' : 'Дальше') + '</figcaption>') +
        '</figure>' +
        '<div class="run-text">' +
        '<h1 class="run-title" id="run-title">' + escapeHtml(shownMove.name) + '</h1>' +
        (shown.side ? '<p class="run-side">' + shown.side + '</p>' : '') +
        '<p class="run-how">' + escapeHtml(shownMove.how) + '</p>' +
        '<p class="run-feel">' + (run.routine.warmup ? 'Работает' : 'Тянется') + ': ' + escapeHtml(shownMove.feel.toLowerCase()) + '</p>' +
        '</div>' +
        '<div class="run-controls">' +
        '<button class="run-btn" type="button" data-run="prev" aria-label="Предыдущее упражнение"' + (run.index === 0 && run.phase !== 'gap' ? ' disabled' : '') + '>' +
        '<svg class="icon" aria-hidden="true"><use href="#i-prev" /></svg></button>' +
        '<button class="run-clock' + (run.phase === 'hold' ? '' : ' is-gap') + '" type="button" data-run="pause" aria-label="Пауза">' +
        '<svg class="run-ring" viewBox="0 0 200 200" aria-hidden="true">' +
        '<circle class="run-ring-track" cx="100" cy="100" r="88" />' +
        '<circle class="run-ring-fill" id="run-ring" cx="100" cy="100" r="88" stroke-dasharray="' + RING.toFixed(1) + '" />' +
        '</svg>' +
        '<span class="run-sec num" id="run-sec"></span>' +
        '<span class="run-state" id="run-state"></span>' +
        '</button>' +
        '<button class="run-btn" type="button" data-run="next" aria-label="Следующее упражнение">' +
        '<svg class="icon" aria-hidden="true"><use href="#i-skip" /></svg></button>' +
        '</div>' +
        '</div>';
      document.getElementById('run-status').textContent =
        (run.phase === 'hold' ? moveInfo.name + (stepInfo.side ? ', ' + stepInfo.side : '') + ', ' + stepInfo.hold + ' секунд' :
          'Дальше: ' + shownMove.name);
    }
    paintClock();
  }

  function paintClock() {
    if (!run || run.phase === 'done') return;
    var ring = document.getElementById('run-ring');
    var sec = document.getElementById('run-sec');
    var label = document.getElementById('run-state');
    var button = document.querySelector('[data-run="pause"]');
    if (!ring) return;
    var total = phaseLength() * 1000;
    var left = run.paused ? run.left : Math.max(0, run.endsAt - Date.now());
    var share = Math.max(0, Math.min(1, left / total));
    ring.style.strokeDashoffset = (RING * (1 - share)).toFixed(1);
    sec.textContent = Math.ceil(left / 1000);
    label.textContent = run.paused ? 'пауза' : run.phase === 'hold' ? (run.routine.warmup ? 'двигайся' : 'держи') : run.phase === 'ready' ? 'старт через' : 'переход';
    button.classList.toggle('is-paused', run.paused);
    button.setAttribute('aria-label', run.paused ? 'Продолжить' : 'Пауза');
    var fill = document.getElementById('run-step-fill');
    if (fill) fill.style.transform = 'scaleX(' + (1 - share) + ')';
  }

  document.getElementById('run-body').addEventListener('click', function (event) {
    var control = event.target.closest('[data-run]');
    if (!control) return;
    var what = control.dataset.run;
    if (what === 'pause') togglePause();
    if (what === 'next') jumpRun(1);
    if (what === 'prev') jumpRun(run && run.phase === 'gap' ? 0 : -1);
  });

  // Пробел — пауза, стрелки — упражнения (когда растяжка на экране с клавиатурой)
  document.addEventListener('keydown', function (event) {
    if (!run || run.phase === 'done' || document.querySelector('[data-screen="stretch-run"]').hidden) return;
    if (event.key === ' ') {
      event.preventDefault();
      togglePause();
    } else if (event.key === 'ArrowRight') {
      jumpRun(1);
    } else if (event.key === 'ArrowLeft') {
      jumpRun(-1);
    }
  });

  // ---------- Запуск ----------

  // Перерисовать то, что сейчас на экране, после изменения данных
  function renderAll() {
    var route = currentRoute();
    if (route.render) route.render();
    if (route.screen === 'today') renderToday();
  }

  // Приложение само решает, где начинать экран: после перезагрузки — сверху
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  applyTheme();
  showRoute();
  runRest();

  // Service worker кеширует оболочку: приложение открывается без сети
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {
        // Без https или на file:// регистрация не пройдёт: приложение работает и так
      });
    });
  }
})();
