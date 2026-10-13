const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

const WORKOUT_TYPES = [
  'Strength Training',
  'Weight Loss',
  'HIIT',
  'Yoga',
  'Pilates',
  'CrossFit',
  'Calisthenics',
  'Boxing',
  'Running & Endurance',
  'Mobility & Stretching',
  'Pre/Post Natal',
  'Senior Fitness',
];

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('trainer', 'customer')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS trainers (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  headline TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  area TEXT NOT NULL DEFAULT '',
  price_per_session INTEGER NOT NULL DEFAULT 0,
  years_experience INTEGER NOT NULL DEFAULT 0,
  photo_url TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  instagram TEXT NOT NULL DEFAULT '',
  certifications TEXT NOT NULL DEFAULT '',
  session_modes TEXT NOT NULL DEFAULT '["In person"]',
  workout_types TEXT NOT NULL DEFAULT '[]',
  published INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS availability (
  id INTEGER PRIMARY KEY,
  trainer_id INTEGER NOT NULL REFERENCES trainers(user_id) ON DELETE CASCADE,
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY,
  trainer_id INTEGER NOT NULL REFERENCES trainers(user_id) ON DELETE CASCADE,
  customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workout_type TEXT NOT NULL,
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  notes TEXT NOT NULL DEFAULT '',
  price INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- A slot can only be held by one active booking.
CREATE UNIQUE INDEX IF NOT EXISTS bookings_active_slot
  ON bookings (trainer_id, date, start_time) WHERE status != 'cancelled';

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY,
  booking_id INTEGER NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  trainer_id INTEGER NOT NULL REFERENCES trainers(user_id) ON DELETE CASCADE,
  customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

function openDb(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);
  return db;
}

module.exports = { openDb, WORKOUT_TYPES };
