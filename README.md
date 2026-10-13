# FitDirect

A website where independent personal trainers advertise themselves directly, without going through third-party platforms or gyms. Customers find a trainer, book a session for the workout they want that day, and review the trainer after the session.

## Home page: run the marathon

The home page (`/`) is a scrolling story inspired by neal.fun's *The Deep Sea*. Scrolling runs you from **0 to 42.195 km**. A meter in the corner tracks the distance, the race clock (starting at 5:00 AM) and your race stage, and the sky moves from pre-dawn to sunrise. On the way you see:

1. **What FitDirect offers:** book the person rather than the platform, choose today's workout, zero commission, verified reviews.
2. **The coaches:** each trainer appears at a km marker. The featured coach, Kumar K, comes first with an illustrated athlete record (see below).
3. **How a session works**, then the **finish line**.

The searchable directory is at `/trainers`.

## Illustrated athlete record

Trainers' achievements are drawn as pictures, with the number as a caption underneath ([`public/js/feats.js`](public/js/feats.js)):

| Achievement | Drawing |
|---|---|
| Distance (km or miles) | a winding road that draws itself, with markers along it, or a 400 m running track with a lap counter |
| Years lifting weights | a barbell and kettlebell on the floor, plus a stack of plates, one plate per year |
| Years in another sport | a staircase with one step per year and the sport's gear on top (running, cricket, football, yoga, boxing, swimming, cycling) |
| Elevation | a mountain with the route to the summit, plus the total in Everests |
| People coached | a crowd with one figure per person |
| Personal bests | lines as long as each race (5K, 10K, half, full) |
| Races | finisher medals with the year and time |

Trainers add these under **My business → Athlete record**, with a live preview.

## Kumar K's profile

Kumar's profile data is in [`src/profiles/kumar.js`](src/profiles/kumar.js). **The achievements, PBs and races in that file are placeholders.** Replace them with real numbers and run `npm run seed` again. You can also log in as `kumar@example.com` and edit everything under **My business → Athlete record**.

## Features

**For customers**
- Browse and search trainers by workout type, city, name or neighbourhood. Sort by rating, number of reviews, price or experience.
- Trainer profile pages show the bio, certifications, where the trainer works (in person, at your home, outdoors, online), weekly hours and reviews with a rating breakdown.
- Book a 60-minute session: pick **today's workout** (from what that trainer offers), a date and an open time slot, and optionally add notes.
- "My bookings" lists upcoming and past sessions. You can cancel a session, and you see the trainer's phone number once they confirm.
- **Verified reviews:** you can review a trainer only after a session with them has taken place, with one review per booking.

**For trainers**
- Free profile: headline, bio, city and area, price, experience, certifications, photo, Instagram, workout types and where you train.
- Optional **athlete record**: Strava link and all-time stats, PBs (5K / 10K / half / full), marathons and races, coaching experience and sports.
- The profile stays hidden until you tick "Publish". You must fill in the key fields before it can be published.
- Weekly availability windows, which the site turns into bookable 1-hour slots.
- Business dashboard: confirm or decline requests, mark sessions completed, and see your rating, upcoming sessions and earnings.
- There is no commission and no payment step. The trainer and client settle payment directly.

## Run it

Requires Node.js 22.13 or later. The app uses Node's built-in SQLite, so you don't need a database server.

```bash
npm install
npm run seed    # optional: resets the DB and adds Kumar K plus 6 sample trainers, customers and reviews
npm start       # http://localhost:3000
npm test
```

Sample logins after seeding (password `password123`):
- Trainer: `kumar@example.com`, `arjun@example.com`, `priya@example.com`, …
- Customer: `ananya@example.com`, `karan@example.com`, …

Set `PORT` and `DB_FILE` to change the port or the database location (default `data/fitdirect.db`). Set `NODE_ENV=production` behind HTTPS so session cookies are marked `Secure`.

## Structure

```
src/app.js      Express app: REST API (auth, trainers, availability, bookings, reviews)
src/db.js       SQLite schema and list of workout types
src/server.js   Entry point
src/seed.js     Sample data
src/profiles/   Featured trainer profiles used by the seed script
public/         Frontend (plain HTML/CSS/JS): index (scroll story), trainers (search), trainer, login, dashboard
test/           API tests (node:test)
```

## Ideas for next steps
- Connect Strava through its API (OAuth) so stats update automatically instead of being typed in
- Carry the dark, premium look of the home page through to the profile and booking pages
- Online payments and deposits (e.g. Razorpay or Stripe), plus cancellation policies
- Email and SMS notifications for booking requests and confirmations
- Photo upload instead of a photo URL, and a gallery of before/after results
- Trainer verification badge (ID or certificate check)
- Packages, group sessions and custom session lengths
- A map view and distance-based search
