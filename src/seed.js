// Resets the database and fills it with sample trainers, customers, bookings and reviews.
const fs = require('node:fs');
const path = require('node:path');
const { openDb } = require('./db');
const { hashPassword, localDateString } = require('./app');
const kumar = require('./profiles/kumar');

const dbFile = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'fitdirect.db');
for (const suffix of ['', '-wal', '-shm']) fs.rmSync(dbFile + suffix, { force: true });
const db = openDb(dbFile);

const PASSWORD = hashPassword('password123');

const trainers = [
  { ...kumar, featured: true },
  {
    name: 'Arjun Mehta', email: 'arjun@example.com', headline: 'Strength coach — build muscle the right way',
    bio: 'Former state-level powerlifter. I help beginners and intermediates get strong with clean technique, progressive overload and simple nutrition habits. Every session is planned around your goal for the day.',
    city: 'Bengaluru', area: 'Indiranagar', price: 1200, years: 8, certifications: 'ACE CPT, NSCA-CSCS',
    instagram: 'arjun.lifts', phone: '+91 98450 00001', modes: ['In person', 'At your home'],
    workouts: ['Strength Training', 'Weight Loss', 'Calisthenics'],
    photo: 'https://images.unsplash.com/photo-1567013127542-490d757e51fc?w=600&q=80',
  },
  {
    name: 'Priya Nair', email: 'priya@example.com', headline: 'Yoga & mobility for busy professionals',
    bio: 'RYT-500 certified yoga teacher. Gentle hatha mornings, power vinyasa evenings, and targeted mobility work for desk-bound backs and hips.',
    city: 'Bengaluru', area: 'HSR Layout', price: 900, years: 6, certifications: 'RYT-500 (Yoga Alliance)',
    instagram: 'priya.moves', phone: '+91 98450 00002', modes: ['In person', 'Outdoors / park', 'Online'],
    workouts: ['Yoga', 'Mobility & Stretching', 'Pre/Post Natal'],
    photo: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600&q=80',
  },
  {
    name: 'Rahul Verma', email: 'rahul@example.com', headline: 'HIIT & fat-loss specialist',
    bio: 'High-energy, no-equipment-needed sessions that torch calories. Great for people short on time who want results.',
    city: 'Mumbai', area: 'Bandra West', price: 1500, years: 5, certifications: 'ACSM-CPT',
    instagram: 'rahul.hiit', phone: '+91 98200 00003', modes: ['In person', 'Outdoors / park', 'Online'],
    workouts: ['HIIT', 'Weight Loss', 'CrossFit'],
    photo: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=600&q=80',
  },
  {
    name: 'Sneha Kapoor', email: 'sneha@example.com', headline: 'Pilates & core — move better, feel better',
    bio: 'Mat and reformer-inspired Pilates focusing on posture, core strength and injury prevention. Pre and post-natal friendly.',
    city: 'Mumbai', area: 'Powai', price: 1300, years: 7, certifications: 'STOTT Pilates Mat',
    instagram: 'sneha.pilates', phone: '+91 98200 00004', modes: ['In person', 'At your home'],
    workouts: ['Pilates', 'Pre/Post Natal', 'Mobility & Stretching'],
    photo: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=600&q=80',
  },
  {
    name: 'Vikram Singh', email: 'vikram@example.com', headline: 'Boxing fitness & conditioning',
    bio: 'Pad work, footwork and conditioning circuits. Learn real boxing fundamentals while getting the best cardio of your life.',
    city: 'Delhi', area: 'Hauz Khas', price: 1100, years: 10, certifications: 'Boxing Federation Level 2 Coach',
    instagram: 'vikram.boxes', phone: '+91 98110 00005', modes: ['In person', 'Outdoors / park'],
    workouts: ['Boxing', 'HIIT', 'Running & Endurance'],
    photo: 'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=600&q=80',
  },
  {
    name: 'Meera Iyer', email: 'meera@example.com', headline: 'Safe, joyful fitness for 50+',
    bio: 'Physiotherapy background. Balance, strength and mobility programmes for seniors and anyone returning from injury.',
    city: 'Delhi', area: 'Vasant Kunj', price: 1000, years: 12, certifications: 'BPT, ACE Senior Fitness Specialist',
    instagram: '', phone: '+91 98110 00006', modes: ['At your home', 'Online'],
    workouts: ['Senior Fitness', 'Mobility & Stretching', 'Strength Training'],
    photo: 'https://images.unsplash.com/photo-1594381898411-846e7d193883?w=600&q=80',
  },
];

const insUser = db.prepare('INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)');
const insTrainer = db.prepare(`INSERT INTO trainers (user_id, headline, bio, city, area, price_per_session, years_experience,
  photo_url, phone, instagram, certifications, session_modes, workout_types, athlete, featured, published)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`);
const insAvail = db.prepare('INSERT INTO availability (trainer_id, weekday, start_time, end_time) VALUES (?, ?, ?, ?)');

const trainerIds = trainers.map((t, i) => {
  const id = Number(insUser.run(t.email, PASSWORD, t.name, 'trainer').lastInsertRowid);
  insTrainer.run(id, t.headline, t.bio, t.city, t.area, t.price, t.years, t.photo, t.phone, t.instagram,
    t.certifications, JSON.stringify(t.modes), JSON.stringify(t.workouts), JSON.stringify(t.athlete || {}),
    t.featured ? 1 : 0);
  for (let day = 1; day <= 6; day++) {
    insAvail.run(id, day, i % 2 ? '07:00' : '06:00', i % 2 ? '10:00' : '09:00');
    if (day <= 5) insAvail.run(id, day, '17:00', '20:00');
  }
  return id;
});

const customers = ['Ananya Rao', 'Karan Malhotra', 'Divya Shah', 'Rohan Gupta'].map((name) =>
  Number(insUser.run(`${name.split(' ')[0].toLowerCase()}@example.com`, PASSWORD, name, 'customer').lastInsertRowid),
);

const comments = [
  [5, 'Fantastic session — explained every movement and adjusted for my knee.'],
  [5, 'Punctual, motivating and genuinely cares about progress. Booking again!'],
  [4, 'Really good workout. Would love a little more variety but highly recommend.'],
  [5, 'Best trainer I have worked with, and so much cheaper than going through a gym.'],
  [4, 'Great energy and very professional.'],
];
const insBooking = db.prepare(`INSERT INTO bookings (trainer_id, customer_id, workout_type, date, start_time, status, price)
  VALUES (?, ?, ?, ?, ?, 'completed', ?)`);
const insReview = db.prepare('INSERT INTO reviews (booking_id, trainer_id, customer_id, rating, comment) VALUES (?, ?, ?, ?, ?)');

trainerIds.forEach((tid, i) => {
  // Kumar is a real trainer, so he gets no invented reviews.
  if (trainers[i].featured) return;
  const count = 2 + (i % 3);
  for (let k = 0; k < count; k++) {
    const d = new Date();
    d.setDate(d.getDate() - (k + 1) * 3 - i);
    const cust = customers[(i + k) % customers.length];
    const bid = Number(insBooking.run(tid, cust, trainers[i].workouts[k % trainers[i].workouts.length],
      localDateString(d), '07:00', trainers[i].price).lastInsertRowid);
    const [rating, comment] = comments[(i + k) % comments.length];
    insReview.run(bid, tid, cust, rating, comment);
  }
});

console.log(`Seeded ${trainers.length} trainers and ${customers.length} customers into ${dbFile}`);
console.log('Log in with e.g. kumar@example.com or arjun@example.com (trainer) or ananya@example.com (customer); password: password123');
