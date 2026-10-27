// Service worker: приложение должно открываться без сети (в зале её может не быть).
// Стратегия — «сначала сеть, потом кеш»: пока сеть есть, код всегда свежий;
// когда сети нет, всё отдаётся из кеша.

const CACHE = 'fitness-app-v9';

// Оболочка приложения. Шрифты перечислены поимённо: без них интерфейс
// откатится на системный шрифт, а это заметно.
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './data.js',
  './fonts.css',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './fonts/geologica-cyrillic.woff2',
  './fonts/geologica-latin.woff2',
  './fonts/onest-cyrillic.woff2',
  './fonts/onest-latin.woff2'
];

// Рисунки упражнений зала (около 1 МБ): кладём в кеш сразу, в зале сети может не быть
const ART = [
  './exercises/Barbell_Bench_Press_-_Medium_Grip/0.svg',
  './exercises/Barbell_Bench_Press_-_Medium_Grip/1.svg',
  './exercises/Barbell_Curl/0.svg',
  './exercises/Barbell_Curl/1.svg',
  './exercises/Barbell_Deadlift/0.svg',
  './exercises/Barbell_Deadlift/1.svg',
  './exercises/Barbell_Incline_Bench_Press_-_Medium_Grip/0.svg',
  './exercises/Barbell_Incline_Bench_Press_-_Medium_Grip/1.svg',
  './exercises/Barbell_Squat/0.svg',
  './exercises/Barbell_Squat/1.svg',
  './exercises/Bent_Over_Cable_Rear_Raise/0.svg',
  './exercises/Bent_Over_Cable_Rear_Raise/1.svg',
  './exercises/Cable_Crossover/0.svg',
  './exercises/Cable_Crossover/1.svg',
  './exercises/Cable_Hammer_Curls_-_Rope_Attachment/0.svg',
  './exercises/Cable_Hammer_Curls_-_Rope_Attachment/1.svg',
  './exercises/Close-Grip_Barbell_Bench_Press/0.svg',
  './exercises/Close-Grip_Barbell_Bench_Press/1.svg',
  './exercises/Dips_-_Triceps_Version/0.svg',
  './exercises/Dips_-_Triceps_Version/1.svg',
  './exercises/Dumbbell_Bench_Press/0.svg',
  './exercises/Dumbbell_Bench_Press/1.svg',
  './exercises/Dumbbell_Flyes/0.svg',
  './exercises/Dumbbell_Flyes/1.svg',
  './exercises/Dumbbell_Lunges/0.svg',
  './exercises/Dumbbell_Lunges/1.svg',
  './exercises/Dumbbell_One-Arm_Shoulder_Press/0.svg',
  './exercises/Dumbbell_One-Arm_Shoulder_Press/1.svg',
  './exercises/Dumbbell_Rear_Lunge/0.svg',
  './exercises/Dumbbell_Rear_Lunge/1.svg',
  './exercises/EZ-Bar_Skullcrusher/0.svg',
  './exercises/EZ-Bar_Skullcrusher/1.svg',
  './exercises/Hack_Squat/0.svg',
  './exercises/Hack_Squat/1.svg',
  './exercises/Hammer_Curls/0.svg',
  './exercises/Hammer_Curls/1.svg',
  './exercises/Incline_Cable_Flye/0.svg',
  './exercises/Incline_Cable_Flye/1.svg',
  './exercises/Incline_Dumbbell_Curl/0.svg',
  './exercises/Incline_Dumbbell_Curl/1.svg',
  './exercises/Incline_Dumbbell_Press/0.svg',
  './exercises/Incline_Dumbbell_Press/1.svg',
  './exercises/Leg_Extensions/0.svg',
  './exercises/Leg_Extensions/1.svg',
  './exercises/Leg_Press/0.svg',
  './exercises/Leg_Press/1.svg',
  './exercises/Lying_Leg_Curls/0.svg',
  './exercises/Lying_Leg_Curls/1.svg',
  './exercises/Lying_Rear_Delt_Raise/0.svg',
  './exercises/Lying_Rear_Delt_Raise/1.svg',
  './exercises/Machine_Bench_Press/0.svg',
  './exercises/Machine_Bench_Press/1.svg',
  './exercises/Preacher_Curl/0.svg',
  './exercises/Preacher_Curl/1.svg',
  './exercises/Pullups/0.svg',
  './exercises/Pullups/1.svg',
  './exercises/Reverse_Grip_Bent-Over_Rows/0.svg',
  './exercises/Reverse_Grip_Bent-Over_Rows/1.svg',
  './exercises/Romanian_Deadlift/0.svg',
  './exercises/Romanian_Deadlift/1.svg',
  './exercises/Seated_Barbell_Military_Press/0.svg',
  './exercises/Seated_Barbell_Military_Press/1.svg',
  './exercises/Seated_Cable_Rows/0.svg',
  './exercises/Seated_Cable_Rows/1.svg',
  './exercises/Seated_Leg_Curl/0.svg',
  './exercises/Seated_Leg_Curl/1.svg',
  './exercises/Seated_Overhead_Triceps_Extension/0.svg',
  './exercises/Seated_Overhead_Triceps_Extension/1.svg',
  './exercises/Side_Lateral_Raise/0.svg',
  './exercises/Side_Lateral_Raise/1.svg',
  './exercises/Smith_Machine_Squat/0.svg',
  './exercises/Smith_Machine_Squat/1.svg',
  './exercises/Standing_Biceps_Cable_Curl/0.svg',
  './exercises/Standing_Biceps_Cable_Curl/1.svg',
  './exercises/Stiff-Legged_Dumbbell_Deadlift/0.svg',
  './exercises/Stiff-Legged_Dumbbell_Deadlift/1.svg',
  './exercises/Straight-Arm_Pulldown/0.svg',
  './exercises/Straight-Arm_Pulldown/1.svg',
  './exercises/T-Bar_Row_with_Handle/0.svg',
  './exercises/T-Bar_Row_with_Handle/1.svg',
  './exercises/Triceps_Pushdown_-_Rope_Attachment/0.svg',
  './exercises/Triceps_Pushdown_-_Rope_Attachment/1.svg',
  './exercises/Triceps_Pushdown_-_V-Bar_Attachment/0.svg',
  './exercises/Triceps_Pushdown_-_V-Bar_Attachment/1.svg',
  './exercises/Underhand_Cable_Pulldowns/0.svg',
  './exercises/Underhand_Cable_Pulldowns/1.svg',
  './exercises/V-Bar_Pulldown/0.svg',
  './exercises/V-Bar_Pulldown/1.svg'
];

// Фото разминки и заминки после силовой: тоже нужны в зале без сети
const GYM_PHOTOS = [
  './exercises/Arm_Circles/0.jpg',
  './exercises/Arm_Circles/1.jpg',
  './exercises/Standing_Hip_Circles/0.jpg',
  './exercises/Standing_Hip_Circles/1.jpg',
  './exercises/Bodyweight_Squat/0.jpg',
  './exercises/Bodyweight_Squat/1.jpg',
  './exercises/Bodyweight_Walking_Lunge/0.jpg',
  './exercises/Bodyweight_Walking_Lunge/1.jpg',
  './exercises/Inchworm/0.jpg',
  './exercises/Inchworm/1.jpg',
  './exercises/Worlds_Greatest_Stretch/0.jpg',
  './exercises/Worlds_Greatest_Stretch/1.jpg',
  './exercises/Chest_And_Front_Of_Shoulder_Stretch/0.jpg',
  './exercises/Chest_And_Front_Of_Shoulder_Stretch/1.jpg',
  './exercises/Standing_Biceps_Stretch/0.jpg',
  './exercises/Standing_Biceps_Stretch/1.jpg',
  './exercises/One_Arm_Against_Wall/0.jpg',
  './exercises/One_Arm_Against_Wall/1.jpg',
  './exercises/Elbows_Back/0.jpg',
  './exercises/Elbows_Back/1.jpg',
  './exercises/Shoulder_Stretch/0.jpg',
  './exercises/Shoulder_Stretch/1.jpg',
  './exercises/Upward_Stretch/0.jpg',
  './exercises/Upward_Stretch/1.jpg',
  './exercises/Standing_Lateral_Stretch/0.jpg',
  './exercises/Standing_Lateral_Stretch/1.jpg',
  './exercises/Childs_Pose/0.jpg',
  './exercises/Childs_Pose/1.jpg',
  './exercises/Cat_Stretch/0.jpg',
  './exercises/Cat_Stretch/1.jpg',
  './exercises/Triceps_Stretch/0.jpg',
  './exercises/Triceps_Stretch/1.jpg',
  './exercises/Middle_Back_Stretch/0.jpg',
  './exercises/Middle_Back_Stretch/1.jpg',
  './exercises/Side-Lying_Floor_Stretch/0.jpg',
  './exercises/Side-Lying_Floor_Stretch/1.jpg',
  './exercises/Upper_Back_Stretch/0.jpg',
  './exercises/Upper_Back_Stretch/1.jpg',
  './exercises/Knee_Across_The_Body/0.jpg',
  './exercises/Knee_Across_The_Body/1.jpg',
  './exercises/On_Your_Side_Quad_Stretch/0.jpg',
  './exercises/On_Your_Side_Quad_Stretch/1.jpg',
  './exercises/Seated_Floor_Hamstring_Stretch/0.jpg',
  './exercises/Seated_Floor_Hamstring_Stretch/1.jpg',
  './exercises/Kneeling_Hip_Flexor/0.jpg',
  './exercises/Kneeling_Hip_Flexor/1.jpg',
  './exercises/Ankle_On_The_Knee/0.jpg',
  './exercises/Ankle_On_The_Knee/1.jpg',
  './exercises/Calf_Stretch_Hands_Against_Wall/0.jpg',
  './exercises/Calf_Stretch_Hands_Against_Wall/1.jpg',
  './exercises/Runners_Stretch/0.jpg',
  './exercises/Runners_Stretch/1.jpg',
  './exercises/The_Straddle/0.jpg',
  './exercises/The_Straddle/1.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // Одна недоступная мелочь не должна ронять всю установку
      .then((cache) => Promise.allSettled(SHELL.concat(ART, GYM_PHOTOS).map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    // no-cache: браузер сверяет файл с сервером и не подсовывает старую копию из своего кеша
    fetch(request, { cache: 'no-cache' })
      .then((response) => {
        // Кладём в кеш только удачные ответы, иначе однажды закешируем ошибку
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request, { ignoreSearch: true });
        if (cached) return cached;
        // Навигация без сети и без точного совпадения — отдаём главную страницу
        if (request.mode === 'navigate') {
          const shell = await caches.match('./index.html', { ignoreSearch: true });
          if (shell) return shell;
        }
        return new Response('Нет сети и нет копии в кеше', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      })
  );
});
