const express = require('express');
const path = require('node:path');
const crypto = require('node:crypto');
const { openDb, WORKOUT_TYPES } = require('./db');

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_MINUTES = 60;
const BOOKING_WINDOW_DAYS = 60;
const SESSION_MODES = ['In person', 'At your home', 'Outdoors / park', 'Online'];

// ---------- helpers ----------

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const candidate = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(candidate, Buffer.from(hash, 'hex'));
}

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function str(value, max, field) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new HttpError(400, `${field} must be text`);
  const v = value.trim();
  if (v.length > max) throw new HttpError(400, `${field} must be at most ${max} characters`);
  return v;
}

function int(value, min, max, field) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new HttpError(400, `${field} must be a whole number between ${min} and ${max}`);
  }
  return n;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function fromMinutes(m) {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

function localDateString(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) throw new HttpError(400, 'date must be YYYY-MM-DD');
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime()) || localDateString(d) !== value) throw new HttpError(400, 'Invalid date');
  return d;
}

function safeUrl(value, field) {
  const v = str(value, 500, field);
  if (!v) return '';
  let u;
  try {
    u = new URL(v);
  } catch {
    throw new HttpError(400, `${field} must be a valid URL`);
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new HttpError(400, `${field} must be an http(s) URL`);
  return u.toString();
}

// ---------- app ----------

function createApp({ dbFile = ':memory:', now = () => new Date() } = {}) {
  const db = typeof dbFile === 'string' ? openDb(dbFile) : dbFile;
  const app = express();
  app.locals.db = db;

  app.use(express.json({ limit: '100kb' }));

  // Attach the logged-in user (if any).
  app.use((req, _res, next) => {
    const token = parseCookies(req.headers.cookie).sid;
    req.user = null;
    if (token) {
      const row = db
        .prepare(
          `SELECT u.id, u.email, u.name, u.role FROM sessions s JOIN users u ON u.id = s.user_id
           WHERE s.token = ? AND s.expires_at > ?`,
        )
        .get(token, Date.now());
      if (row) req.user = { ...row };
    }
    next();
  });

  const requireUser = (role) => (req, _res, next) => {
    if (!req.user) return next(new HttpError(401, 'Please log in'));
    if (role && req.user.role !== role) return next(new HttpError(403, `Only ${role}s can do that`));
    next();
  };

  function startSession(res, userId) {
    const token = crypto.randomBytes(32).toString('hex');
    db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(
      token,
      userId,
      Date.now() + SESSION_TTL_MS,
    );
    res.cookie('sid', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: SESSION_TTL_MS,
    });
  }

  // ----- trainer data helpers -----

  const ratingSql = `
    SELECT t.*, u.name, u.email,
      COALESCE(r.avg_rating, 0) AS avg_rating, COALESCE(r.review_count, 0) AS review_count
    FROM trainers t
    JOIN users u ON u.id = t.user_id
    LEFT JOIN (
      SELECT trainer_id, ROUND(AVG(rating), 1) AS avg_rating, COUNT(*) AS review_count
      FROM reviews GROUP BY trainer_id
    ) r ON r.trainer_id = t.user_id`;

  function shapeTrainer(row, { includeContact = false } = {}) {
    const t = {
      id: row.user_id,
      name: row.name,
      headline: row.headline,
      bio: row.bio,
      city: row.city,
      area: row.area,
      pricePerSession: row.price_per_session,
      yearsExperience: row.years_experience,
      photoUrl: row.photo_url,
      instagram: row.instagram,
      certifications: row.certifications,
      sessionModes: JSON.parse(row.session_modes),
      workoutTypes: JSON.parse(row.workout_types),
      published: !!row.published,
      avgRating: row.avg_rating,
      reviewCount: row.review_count,
    };
    if (includeContact) t.phone = row.phone;
    return t;
  }

  function getTrainerRow(id) {
    return db.prepare(`${ratingSql} WHERE t.user_id = ?`).get(id);
  }

  function getAvailability(trainerId) {
    return db
      .prepare('SELECT weekday, start_time, end_time FROM availability WHERE trainer_id = ? ORDER BY weekday, start_time')
      .all(trainerId)
      .map((a) => ({ weekday: a.weekday, start: a.start_time, end: a.end_time }));
  }

  function openSlots(trainerId, dateStr) {
    const date = parseDate(dateStr);
    const today = localDateString(now());
    if (dateStr < today) return [];
    const windows = db
      .prepare('SELECT start_time, end_time FROM availability WHERE trainer_id = ? AND weekday = ?')
      .all(trainerId, date.getDay());
    const taken = new Set(
      db
        .prepare(`SELECT start_time FROM bookings WHERE trainer_id = ? AND date = ? AND status != 'cancelled'`)
        .all(trainerId, dateStr)
        .map((b) => b.start_time),
    );
    const n = now();
    const nowMinutes = dateStr === today ? n.getHours() * 60 + n.getMinutes() : -1;
    const slots = new Set();
    for (const w of windows) {
      for (let m = toMinutes(w.start_time); m + SESSION_MINUTES <= toMinutes(w.end_time); m += SESSION_MINUTES) {
        const t = fromMinutes(m);
        if (m > nowMinutes && !taken.has(t)) slots.add(t);
      }
    }
    return [...slots].sort();
  }

  // ----- auth -----

  app.post('/api/auth/signup', (req, res) => {
    const name = str(req.body.name, 80, 'name');
    const email = str(req.body.email, 200, 'email').toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const role = req.body.role;
    if (!name) throw new HttpError(400, 'Name is required');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'A valid email is required');
    if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters');
    if (role !== 'trainer' && role !== 'customer') throw new HttpError(400, 'Choose trainer or customer');
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
      throw new HttpError(409, 'An account with that email already exists');
    }
    const { lastInsertRowid } = db
      .prepare('INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)')
      .run(email, hashPassword(password), name, role);
    const id = Number(lastInsertRowid);
    if (role === 'trainer') db.prepare('INSERT INTO trainers (user_id) VALUES (?)').run(id);
    startSession(res, id);
    res.status(201).json({ user: { id, name, email, role } });
  });

  app.post('/api/auth/login', (req, res) => {
    const email = str(req.body.email, 200, 'email').toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || !verifyPassword(password, user.password_hash)) {
      throw new HttpError(401, 'Incorrect email or password');
    }
    startSession(res, user.id);
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  });

  app.post('/api/auth/logout', (req, res) => {
    const token = parseCookies(req.headers.cookie).sid;
    if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    res.clearCookie('sid');
    res.json({ ok: true });
  });

  app.get('/api/me', (req, res) => {
    res.json({ user: req.user });
  });

  // ----- public directory -----

  app.get('/api/meta', (_req, res) => {
    const cities = db
      .prepare(`SELECT DISTINCT city FROM trainers WHERE published = 1 AND city != '' ORDER BY city`)
      .all()
      .map((r) => r.city);
    res.json({ workoutTypes: WORKOUT_TYPES, sessionModes: SESSION_MODES, cities });
  });

  app.get('/api/trainers', (req, res) => {
    const where = ['t.published = 1'];
    const params = [];
    const q = str(req.query.q, 100, 'q');
    if (q) {
      where.push('(u.name LIKE ? OR t.headline LIKE ? OR t.bio LIKE ? OR t.area LIKE ?)');
      const like = `%${q}%`;
      params.push(like, like, like, like);
    }
    const city = str(req.query.city, 100, 'city');
    if (city) {
      where.push('t.city = ? COLLATE NOCASE');
      params.push(city);
    }
    const workout = str(req.query.workout, 100, 'workout');
    if (workout) {
      where.push('EXISTS (SELECT 1 FROM json_each(t.workout_types) WHERE value = ?)');
      params.push(workout);
    }
    if (req.query.maxPrice) {
      where.push('t.price_per_session <= ?');
      params.push(int(req.query.maxPrice, 0, 1_000_000, 'maxPrice'));
    }
    const order =
      {
        price_asc: 't.price_per_session ASC',
        price_desc: 't.price_per_session DESC',
        experience: 't.years_experience DESC',
        reviews: 'review_count DESC',
      }[req.query.sort] || 'avg_rating DESC, review_count DESC';
    const rows = db.prepare(`${ratingSql} WHERE ${where.join(' AND ')} ORDER BY ${order}, u.name`).all(...params);
    res.json({ trainers: rows.map((r) => shapeTrainer(r)) });
  });

  app.get('/api/trainers/:id', (req, res) => {
    const id = int(req.params.id, 1, Number.MAX_SAFE_INTEGER, 'id');
    const row = getTrainerRow(id);
    const isOwner = req.user?.id === id;
    if (!row || (!row.published && !isOwner)) throw new HttpError(404, 'Trainer not found');
    const reviews = db
      .prepare(
        `SELECT r.id, r.rating, r.comment, r.created_at, u.name AS customer_name, b.workout_type
         FROM reviews r JOIN users u ON u.id = r.customer_id JOIN bookings b ON b.id = r.booking_id
         WHERE r.trainer_id = ? ORDER BY r.created_at DESC, r.id DESC`,
      )
      .all(id)
      .map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.created_at,
        // Show first name + initial only, to protect customer privacy.
        customerName: r.customer_name.split(' ')[0] + (r.customer_name.includes(' ') ? ` ${r.customer_name.split(' ').pop()[0]}.` : ''),
        workoutType: r.workout_type,
      }));
    const breakdown = [5, 4, 3, 2, 1].map((stars) => ({
      stars,
      count: reviews.filter((r) => r.rating === stars).length,
    }));
    const completed = db
      .prepare(`SELECT COUNT(*) AS n FROM bookings WHERE trainer_id = ? AND status = 'completed'`)
      .get(id).n;
    res.json({
      trainer: { ...shapeTrainer(row), completedSessions: completed },
      availability: getAvailability(id),
      reviews,
      breakdown,
    });
  });

  app.get('/api/trainers/:id/slots', (req, res) => {
    const id = int(req.params.id, 1, Number.MAX_SAFE_INTEGER, 'id');
    const row = getTrainerRow(id);
    if (!row || !row.published) throw new HttpError(404, 'Trainer not found');
    res.json({ date: req.query.date, slots: openSlots(id, req.query.date) });
  });

  // ----- trainer self-management -----

  app.get('/api/me/trainer-profile', requireUser('trainer'), (req, res) => {
    const row = getTrainerRow(req.user.id);
    res.json({
      trainer: shapeTrainer(row, { includeContact: true }),
      availability: getAvailability(req.user.id),
    });
  });

  app.put('/api/me/trainer-profile', requireUser('trainer'), (req, res) => {
    const b = req.body;
    const workoutTypes = Array.isArray(b.workoutTypes) ? [...new Set(b.workoutTypes)] : [];
    if (workoutTypes.some((w) => !WORKOUT_TYPES.includes(w))) throw new HttpError(400, 'Unknown workout type');
    const sessionModes = Array.isArray(b.sessionModes) ? [...new Set(b.sessionModes)] : [];
    if (sessionModes.some((m) => !SESSION_MODES.includes(m))) throw new HttpError(400, 'Unknown session mode');
    const profile = {
      name: str(b.name, 80, 'name'),
      headline: str(b.headline, 120, 'headline'),
      bio: str(b.bio, 3000, 'bio'),
      city: str(b.city, 80, 'city'),
      area: str(b.area, 120, 'area'),
      price: int(b.pricePerSession ?? 0, 0, 1_000_000, 'pricePerSession'),
      years: int(b.yearsExperience ?? 0, 0, 70, 'yearsExperience'),
      photo: safeUrl(b.photoUrl, 'photoUrl'),
      phone: str(b.phone, 30, 'phone'),
      instagram: str(b.instagram, 60, 'instagram').replace(/^@/, ''),
      certifications: str(b.certifications, 500, 'certifications'),
      published: !!b.published,
    };
    if (!profile.name) throw new HttpError(400, 'Name is required');
    if (profile.published) {
      const missing = [];
      if (!profile.headline) missing.push('headline');
      if (!profile.city) missing.push('city');
      if (!workoutTypes.length) missing.push('at least one workout type');
      if (!profile.price) missing.push('price per session');
      if (missing.length) throw new HttpError(400, `To publish your profile, add: ${missing.join(', ')}`);
    }
    db.prepare('UPDATE users SET name = ? WHERE id = ?').run(profile.name, req.user.id);
    db.prepare(
      `UPDATE trainers SET headline = ?, bio = ?, city = ?, area = ?, price_per_session = ?, years_experience = ?,
         photo_url = ?, phone = ?, instagram = ?, certifications = ?, session_modes = ?, workout_types = ?, published = ?
       WHERE user_id = ?`,
    ).run(
      profile.headline,
      profile.bio,
      profile.city,
      profile.area,
      profile.price,
      profile.years,
      profile.photo,
      profile.phone,
      profile.instagram,
      profile.certifications,
      JSON.stringify(sessionModes.length ? sessionModes : ['In person']),
      JSON.stringify(workoutTypes),
      profile.published ? 1 : 0,
      req.user.id,
    );
    res.json({ trainer: shapeTrainer(getTrainerRow(req.user.id), { includeContact: true }) });
  });

  app.put('/api/me/availability', requireUser('trainer'), (req, res) => {
    if (!Array.isArray(req.body.availability)) throw new HttpError(400, 'availability must be a list');
    if (req.body.availability.length > 50) throw new HttpError(400, 'Too many availability windows');
    const windows = req.body.availability.map((w) => {
      const weekday = int(w.weekday, 0, 6, 'weekday');
      if (!TIME_RE.test(w.start) || !TIME_RE.test(w.end)) throw new HttpError(400, 'Times must be HH:MM');
      if (toMinutes(w.end) - toMinutes(w.start) < SESSION_MINUTES) {
        throw new HttpError(400, 'Each window must be at least one hour long');
      }
      return { weekday, start: w.start, end: w.end };
    });
    db.exec('BEGIN');
    try {
      db.prepare('DELETE FROM availability WHERE trainer_id = ?').run(req.user.id);
      const ins = db.prepare('INSERT INTO availability (trainer_id, weekday, start_time, end_time) VALUES (?, ?, ?, ?)');
      for (const w of windows) ins.run(req.user.id, w.weekday, w.start, w.end);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    res.json({ availability: getAvailability(req.user.id) });
  });

  // ----- bookings -----

  app.post('/api/bookings', requireUser('customer'), (req, res) => {
    const trainerId = int(req.body.trainerId, 1, Number.MAX_SAFE_INTEGER, 'trainerId');
    const row = getTrainerRow(trainerId);
    if (!row || !row.published) throw new HttpError(404, 'Trainer not found');
    const workoutType = req.body.workoutType;
    if (!JSON.parse(row.workout_types).includes(workoutType)) {
      throw new HttpError(400, 'This trainer does not offer that workout');
    }
    const date = req.body.date;
    parseDate(date);
    const maxDate = new Date(now());
    maxDate.setDate(maxDate.getDate() + BOOKING_WINDOW_DAYS);
    if (date > localDateString(maxDate)) {
      throw new HttpError(400, `Bookings open up to ${BOOKING_WINDOW_DAYS} days ahead`);
    }
    const time = req.body.time;
    if (!openSlots(trainerId, date).includes(time)) {
      throw new HttpError(409, 'That slot is no longer available — please pick another');
    }
    const notes = str(req.body.notes, 500, 'notes');
    let result;
    try {
      result = db
        .prepare(
          `INSERT INTO bookings (trainer_id, customer_id, workout_type, date, start_time, notes, price)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(trainerId, req.user.id, workoutType, date, time, notes, row.price_per_session);
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) throw new HttpError(409, 'That slot was just taken — please pick another');
      throw e;
    }
    res.status(201).json({ booking: getBooking(Number(result.lastInsertRowid), req.user) });
  });

  const bookingSql = `
    SELECT b.*, tu.name AS trainer_name, cu.name AS customer_name, cu.email AS customer_email,
      t.phone AS trainer_phone, t.city AS trainer_city, t.area AS trainer_area,
      r.rating AS review_rating, r.comment AS review_comment
    FROM bookings b
    JOIN users tu ON tu.id = b.trainer_id
    JOIN users cu ON cu.id = b.customer_id
    JOIN trainers t ON t.user_id = b.trainer_id
    LEFT JOIN reviews r ON r.booking_id = b.id`;

  function shapeBooking(b, viewer) {
    const today = localDateString(now());
    const isPast = b.date < today;
    const active = b.status === 'pending' || b.status === 'confirmed';
    const out = {
      id: b.id,
      trainerId: b.trainer_id,
      trainerName: b.trainer_name,
      customerName: b.customer_name,
      workoutType: b.workout_type,
      date: b.date,
      time: b.start_time,
      status: b.status,
      notes: b.notes,
      price: b.price,
      location: [b.trainer_area, b.trainer_city].filter(Boolean).join(', '),
      review: b.review_rating ? { rating: b.review_rating, comment: b.review_comment } : null,
    };
    if (viewer.role === 'trainer') {
      out.customerEmail = b.customer_email;
      out.canConfirm = b.status === 'pending' && !isPast;
      out.canComplete = active && b.date <= today;
      out.canCancel = active && !isPast;
    } else {
      // Contact details are shared once the trainer confirms.
      if (b.status === 'confirmed' || b.status === 'completed') out.trainerPhone = b.trainer_phone;
      out.canCancel = active && !isPast;
      out.canReview = !out.review && (b.status === 'completed' || (b.status === 'confirmed' && isPast));
    }
    return out;
  }

  function getBooking(id, viewer) {
    const b = db.prepare(`${bookingSql} WHERE b.id = ?`).get(id);
    if (!b) return null;
    if (b.trainer_id !== viewer.id && b.customer_id !== viewer.id) return null;
    return shapeBooking(b, viewer);
  }

  app.get('/api/me/bookings', requireUser(), (req, res) => {
    const col = req.user.role === 'trainer' ? 'b.trainer_id' : 'b.customer_id';
    const rows = db.prepare(`${bookingSql} WHERE ${col} = ? ORDER BY b.date DESC, b.start_time DESC`).all(req.user.id);
    res.json({ bookings: rows.map((b) => shapeBooking(b, req.user)) });
  });

  app.patch('/api/bookings/:id', requireUser(), (req, res) => {
    const id = int(req.params.id, 1, Number.MAX_SAFE_INTEGER, 'id');
    const booking = getBooking(id, req.user);
    if (!booking) throw new HttpError(404, 'Booking not found');
    const status = req.body.status;
    const allowed =
      (status === 'cancelled' && booking.canCancel) ||
      (req.user.role === 'trainer' && status === 'confirmed' && booking.canConfirm) ||
      (req.user.role === 'trainer' && status === 'completed' && booking.canComplete);
    if (!allowed) throw new HttpError(400, `Can't change this booking to "${status}"`);
    db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run(status, id);
    res.json({ booking: getBooking(id, req.user) });
  });

  // ----- reviews -----

  app.post('/api/reviews', requireUser('customer'), (req, res) => {
    const bookingId = int(req.body.bookingId, 1, Number.MAX_SAFE_INTEGER, 'bookingId');
    const booking = getBooking(bookingId, req.user);
    if (!booking) throw new HttpError(404, 'Booking not found');
    if (!booking.canReview) {
      throw new HttpError(400, 'You can review a trainer once your session with them has taken place');
    }
    const rating = int(req.body.rating, 1, 5, 'rating');
    const comment = str(req.body.comment, 2000, 'comment');
    db.prepare('INSERT INTO reviews (booking_id, trainer_id, customer_id, rating, comment) VALUES (?, ?, ?, ?, ?)').run(
      bookingId,
      booking.trainerId,
      req.user.id,
      rating,
      comment,
    );
    res.status(201).json({ booking: getBooking(bookingId, req.user) });
  });

  // ----- static site -----

  app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'] }));

  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Not found')));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const status = err.status || (err.type === 'entity.parse.failed' ? 400 : 500);
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? 'Something went wrong' : err.message });
  });

  return app;
}

module.exports = { createApp, hashPassword, localDateString };
