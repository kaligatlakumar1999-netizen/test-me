const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createApp, localDateString } = require('../src/app');

let server;
let base;
let app;
// Fixed "now": a Wednesday morning, so availability and slot maths are deterministic.
let fakeNow = new Date(2026, 9, 14, 8, 0);

before(async () => {
  app = createApp({ dbFile: ':memory:', now: () => fakeNow });
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

function client() {
  let cookie = '';
  return async (path, { method = 'GET', body } = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    return { status: res.status, body: await res.json() };
  };
}

const trainer = client();
const customer = client();
const other = client();
let trainerId;

const day = (offset) => {
  const d = new Date(fakeNow);
  d.setDate(d.getDate() + offset);
  return localDateString(d);
};

test('signup validates input', async () => {
  const r = await client()('/api/auth/signup', { method: 'POST', body: { name: 'X', email: 'bad', password: 'short', role: 'customer' } });
  assert.equal(r.status, 400);
});

test('trainer signs up and is hidden until published', async () => {
  const r = await trainer('/api/auth/signup', {
    method: 'POST',
    body: { name: 'Tara Trainer', email: 'tara@example.com', password: 'password123', role: 'trainer' },
  });
  assert.equal(r.status, 201);
  trainerId = r.body.user.id;
  assert.equal((await client()('/api/trainers')).body.trainers.length, 0);
  assert.equal((await client()(`/api/trainers/${trainerId}`)).status, 404);
  // Owner can preview their unpublished page.
  assert.equal((await trainer(`/api/trainers/${trainerId}`)).status, 200);
});

test('duplicate email is rejected', async () => {
  const r = await client()('/api/auth/signup', {
    method: 'POST',
    body: { name: 'Tara 2', email: 'TARA@example.com', password: 'password123', role: 'customer' },
  });
  assert.equal(r.status, 409);
});

test('publishing requires the key profile fields', async () => {
  const r = await trainer('/api/me/trainer-profile', { method: 'PUT', body: { name: 'Tara Trainer', published: true } });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /headline/);
});

test('trainer publishes profile and sets hours', async () => {
  const p = await trainer('/api/me/trainer-profile', {
    method: 'PUT',
    body: {
      name: 'Tara Trainer',
      headline: 'Strength & yoga',
      city: 'Pune',
      area: 'Koregaon Park',
      pricePerSession: 1000,
      yearsExperience: 4,
      workoutTypes: ['Strength Training', 'Yoga'],
      sessionModes: ['In person'],
      photoUrl: 'https://example.com/me.jpg',
      published: true,
    },
  });
  assert.equal(p.status, 200, p.body.error);
  const bad = await trainer('/api/me/trainer-profile', { method: 'PUT', body: { name: 'Tara', photoUrl: 'javascript:alert(1)' } });
  assert.equal(bad.status, 400);

  // Every day, 07:00–09:00 → two 1-hour slots.
  const a = await trainer('/api/me/availability', {
    method: 'PUT',
    body: { availability: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, start: '07:00', end: '09:00' })) },
  });
  assert.equal(a.status, 200, a.body.error);
});

test('customers can only change their role-appropriate data', async () => {
  await customer('/api/auth/signup', {
    method: 'POST',
    body: { name: 'Casey Customer', email: 'casey@example.com', password: 'password123', role: 'customer' },
  });
  const r = await customer('/api/me/trainer-profile', { method: 'PUT', body: { name: 'Hacker' } });
  assert.equal(r.status, 403);
});

test('search filters by workout and city', async () => {
  const c = client();
  assert.equal((await c('/api/trainers?workout=Yoga')).body.trainers.length, 1);
  assert.equal((await c('/api/trainers?workout=Boxing')).body.trainers.length, 0);
  assert.equal((await c('/api/trainers?city=pune')).body.trainers.length, 1);
  assert.equal((await c('/api/trainers?q=Koregaon')).body.trainers.length, 1);
});

test('slots exclude past times today and are bookable once', async () => {
  // Now is 08:00, so only later slots today… none left in a 07–09 window.
  assert.deepEqual((await customer(`/api/trainers/${trainerId}/slots?date=${day(0)}`)).body.slots, []);
  assert.deepEqual((await customer(`/api/trainers/${trainerId}/slots?date=${day(1)}`)).body.slots, ['07:00', '08:00']);

  const wrongWorkout = await customer('/api/bookings', {
    method: 'POST',
    body: { trainerId, workoutType: 'Boxing', date: day(1), time: '07:00' },
  });
  assert.equal(wrongWorkout.status, 400);

  const b = await customer('/api/bookings', {
    method: 'POST',
    body: { trainerId, workoutType: 'Yoga', date: day(1), time: '07:00', notes: 'Bad knee' },
  });
  assert.equal(b.status, 201, b.body.error);
  assert.equal(b.body.booking.status, 'pending');
  assert.equal(b.body.booking.trainerPhone, undefined);

  await other('/api/auth/signup', {
    method: 'POST',
    body: { name: 'Olive Other', email: 'olive@example.com', password: 'password123', role: 'customer' },
  });
  const clash = await other('/api/bookings', {
    method: 'POST',
    body: { trainerId, workoutType: 'Yoga', date: day(1), time: '07:00' },
  });
  assert.equal(clash.status, 409);
  assert.deepEqual((await other(`/api/trainers/${trainerId}/slots?date=${day(1)}`)).body.slots, ['08:00']);
});

test('trainers cannot book and anonymous users must log in', async () => {
  const body = { trainerId, workoutType: 'Yoga', date: day(2), time: '07:00' };
  assert.equal((await trainer('/api/bookings', { method: 'POST', body })).status, 403);
  assert.equal((await client()('/api/bookings', { method: 'POST', body })).status, 401);
});

test('review only allowed after the session happened', async () => {
  const { bookings } = (await customer('/api/me/bookings')).body;
  const id = bookings[0].id;

  let r = await customer('/api/reviews', { method: 'POST', body: { bookingId: id, rating: 5, comment: 'Great' } });
  assert.equal(r.status, 400);

  // Other customers can't see or touch this booking.
  assert.equal((await other(`/api/bookings/${id}`, { method: 'PATCH', body: { status: 'cancelled' } })).status, 404);

  r = await trainer(`/api/bookings/${id}`, { method: 'PATCH', body: { status: 'confirmed' } });
  assert.equal(r.status, 200);
  const confirmed = (await customer('/api/me/bookings')).body.bookings[0];
  assert.equal(confirmed.status, 'confirmed');

  // Can't complete a future session.
  assert.equal((await trainer(`/api/bookings/${id}`, { method: 'PATCH', body: { status: 'completed' } })).status, 400);

  // Jump to the session day; trainer marks it done.
  fakeNow = new Date(fakeNow.getTime() + 26 * 60 * 60 * 1000);
  r = await trainer(`/api/bookings/${id}`, { method: 'PATCH', body: { status: 'completed' } });
  assert.equal(r.status, 200, r.body.error);

  r = await customer('/api/reviews', { method: 'POST', body: { bookingId: id, rating: 6 } });
  assert.equal(r.status, 400);
  r = await customer('/api/reviews', { method: 'POST', body: { bookingId: id, rating: 4, comment: 'Lovely class' } });
  assert.equal(r.status, 201, r.body.error);
  r = await customer('/api/reviews', { method: 'POST', body: { bookingId: id, rating: 1 } });
  assert.equal(r.status, 400);

  const profile = (await client()(`/api/trainers/${trainerId}`)).body;
  assert.equal(profile.trainer.avgRating, 4);
  assert.equal(profile.trainer.reviewCount, 1);
  assert.equal(profile.reviews[0].customerName, 'Casey C.');
  assert.equal(profile.reviews[0].workoutType, 'Yoga');
  assert.equal(profile.trainer.completedSessions, 1);
});

test('cancelled booking frees the slot', async () => {
  const b = await other('/api/bookings', {
    method: 'POST',
    body: { trainerId, workoutType: 'Strength Training', date: day(3), time: '08:00' },
  });
  assert.equal(b.status, 201, b.body.error);
  const id = b.body.booking.id;
  assert.equal((await other(`/api/bookings/${id}`, { method: 'PATCH', body: { status: 'confirmed' } })).status, 400);
  assert.equal((await other(`/api/bookings/${id}`, { method: 'PATCH', body: { status: 'cancelled' } })).status, 200);
  assert.deepEqual((await other(`/api/trainers/${trainerId}/slots?date=${day(3)}`)).body.slots, ['07:00', '08:00']);
});

test('login and logout', async () => {
  const c = client();
  assert.equal((await c('/api/auth/login', { method: 'POST', body: { email: 'casey@example.com', password: 'nope' } })).status, 401);
  const r = await c('/api/auth/login', { method: 'POST', body: { email: 'casey@example.com', password: 'password123' } });
  assert.equal(r.status, 200);
  assert.equal((await c('/api/me')).body.user.role, 'customer');
  await c('/api/auth/logout', { method: 'POST' });
  assert.equal((await c('/api/me')).body.user, null);
});

test('athlete record is validated and shown on the profile', async () => {
  const base = {
    name: 'Tara Trainer', headline: 'Strength & yoga', city: 'Pune', pricePerSession: 1000,
    workoutTypes: ['Strength Training', 'Yoga'], published: true,
  };
  let r = await trainer('/api/me/trainer-profile', { method: 'PUT', body: { ...base, athlete: { pbs: { Marathon: 'fast' } } } });
  assert.equal(r.status, 400);
  r = await trainer('/api/me/trainer-profile', { method: 'PUT', body: { ...base, athlete: { feats: [{ kind: 'distance', value: -5 }] } } });
  assert.equal(r.status, 400);
  r = await trainer('/api/me/trainer-profile', { method: 'PUT', body: { ...base, athlete: { feats: [{ kind: 'teleport', value: 5 }] } } });
  assert.equal(r.status, 400);
  r = await trainer('/api/me/trainer-profile', {
    method: 'PUT',
    body: {
      ...base,
      athlete: {
        stravaUrl: 'https://www.strava.com/athletes/123',
        feats: [
          { kind: 'distance', value: '100', unit: 'mi', style: 'path', label: 'in one week' },
          { kind: 'years', value: 5, activity: 'weights', label: 'lifting' },
          { kind: 'years', value: 3, activity: 'quidditch' },
          { kind: 'elevation', value: 1234.56, unit: 'parsecs' },
        ],
        pbs: { '5K': '21:45', Marathon: '3:42:10', Unknown: '1:00' },
        races: [{ year: 2025, name: 'Pune Half', time: '1:45:00' }, { name: '' }],
        coaching: ['Run club lead', ''],
      },
    },
  });
  assert.equal(r.status, 200, r.body.error);
  const { athlete } = (await client()(`/api/trainers/${trainerId}`)).body.trainer;
  assert.deepEqual(athlete.feats, [
    { kind: 'distance', value: 100, label: 'in one week', unit: 'mi', style: 'path' },
    { kind: 'years', value: 5, label: 'lifting', activity: 'weights' },
    { kind: 'years', value: 3, label: '', activity: 'other' },
    { kind: 'elevation', value: 1234.6, label: '', unit: 'm' },
  ]);
  assert.deepEqual(athlete.pbs, { '5K': '21:45', Marathon: '3:42:10' });
  assert.deepEqual(athlete.races, [{ year: '2025', name: 'Pune Half', time: '1:45:00' }]);
  assert.deepEqual(athlete.coaching, ['Run club lead']);
});

test('featured sort puts featured trainers first', async () => {
  const other = await client()('/api/auth/signup', {
    method: 'POST',
    body: { name: 'Zed Coach', email: 'zed@example.com', password: 'password123', role: 'trainer' },
  });
  const zedId = other.body.user.id;
  app.locals.db
    .prepare(`UPDATE trainers SET published = 1, headline = 'x', city = 'Pune', price_per_session = 1, workout_types = '["Yoga"]' WHERE user_id = ?`)
    .run(zedId);
  // Tara has a review, so she leads by rating until Zed is featured.
  assert.equal((await client()('/api/trainers?sort=featured')).body.trainers[0].id, trainerId);
  app.locals.db.prepare('UPDATE trainers SET featured = 1 WHERE user_id = ?').run(zedId);
  const { trainers } = (await client()('/api/trainers?sort=featured')).body;
  assert.deepEqual(trainers.map((t) => t.id), [zedId, trainerId]);
  assert.equal(trainers[0].featured, true);
});
