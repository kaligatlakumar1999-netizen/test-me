# FitDirect

A website where independent personal trainers advertise themselves directly, without going through third-party platforms or gyms. Customers find a trainer, book a session for the workout they want that day, and review the trainer after the session.

## Features

**For customers**
- Browse and search trainers by workout type, city, name or neighbourhood. Sort by rating, number of reviews, price or experience.
- Trainer profile pages show the bio, certifications, where the trainer works (in person, at your home, outdoors, online), weekly hours and reviews with a rating breakdown.
- Book a 60-minute session: pick **today's workout** (from what that trainer offers), a date and an open time slot, and optionally add notes.
- "My bookings" lists upcoming and past sessions. You can cancel a session, and you see the trainer's phone number once they confirm.
- **Verified reviews:** you can review a trainer only after a session with them has taken place, with one review per booking.

**For trainers**
- Free profile: headline, bio, city and area, price, experience, certifications, photo, Instagram, workout types and where you train.
- The profile stays hidden until you tick "Publish". You must fill in the key fields before it can be published.
- Weekly availability windows, which the site turns into bookable 1-hour slots.
- Business dashboard: confirm or decline requests, mark sessions completed, and see your rating, upcoming sessions and earnings.
- There is no commission and no payment step. The trainer and client settle payment directly.

## Run it

Requires Node.js 22.13 or later. The app uses Node's built-in SQLite, so you don't need a database server.

```bash
npm install
npm run seed    # optional: resets the DB and adds 6 sample trainers, customers and reviews
npm start       # http://localhost:3000
npm test
```

Sample logins after seeding (password `password123`):
- Trainer: `arjun@example.com`, `priya@example.com`, …
- Customer: `ananya@example.com`, `karan@example.com`, …

Set `PORT` and `DB_FILE` to change the port or the database location (default `data/fitdirect.db`). Set `NODE_ENV=production` behind HTTPS so session cookies are marked `Secure`.

## Structure

```
src/app.js      Express app: REST API (auth, trainers, availability, bookings, reviews)
src/db.js       SQLite schema and list of workout types
src/server.js   Entry point
src/seed.js     Sample data
public/         Frontend (plain HTML/CSS/JS): index, trainer, login, dashboard
test/           API tests (node:test)
```

## Ideas for next steps
- Online payments and deposits (e.g. Razorpay or Stripe), plus cancellation policies
- Email and SMS notifications for booking requests and confirmations
- Photo upload instead of a photo URL, and a gallery of before/after results
- Trainer verification badge (ID or certificate check)
- Packages, group sessions and custom session lengths
- A map view and distance-based search
