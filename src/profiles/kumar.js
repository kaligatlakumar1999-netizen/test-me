// Kumar K's trainer profile, used by `npm run seed`.
//
// ⚠️ PLACEHOLDER VALUES: every feat, PB, race and line below is a sample so the page
// can be designed. Replace them with Kumar's real Strava stats and history, then
// run `npm run seed` again. Once the site is live, Kumar can also edit all of this
// from the dashboard ("Athlete record" section).

module.exports = {
  name: 'Kumar K',
  email: 'kumar@example.com',
  headline: 'Marathoner & running coach',
  bio:
    'I coach runners from their first 5K to their first marathon. Every session is built around what you want to work on that day: easy aerobic miles, tempo, intervals, hills or strength for runners. Expect honest feedback, smart progression and a plan you can actually stick to.',
  city: 'Bengaluru',
  area: 'Cubbon Park',
  price: 1500,
  years: 6,
  certifications: 'Running coach certification (add yours)',
  instagram: '',
  phone: '+91 00000 00000',
  modes: ['In person', 'Outdoors / park', 'Online'],
  workouts: ['Running & Endurance', 'Strength Training', 'Mobility & Stretching', 'HIIT'],
  photo: '',
  athlete: {
    stravaUrl: 'https://www.strava.com/athletes/',
    // Each feat is drawn as a picture on the site:
    //   distance → a winding road ("path") or a 400 m running track ("track")
    //   years    → gear for the activity (weights: barbell + one plate per year)
    //   elevation → a mountain, counted in Everests
    //   people   → a crowd, one figure per person
    feats: [
      { kind: 'distance', value: 100, unit: 'mi', style: 'path', label: 'run in a single week of training' },
      { kind: 'years', value: 5, activity: 'weights', label: 'lifting weights' },
      { kind: 'distance', value: 12480, unit: 'km', style: 'track', label: 'logged on Strava' },
      { kind: 'elevation', value: 98500, unit: 'm', label: 'climbed on foot' },
      { kind: 'years', value: 10, activity: 'cricket', label: 'playing club cricket' },
      { kind: 'people', value: 120, label: 'runners coached to their first race' },
    ],
    pbs: { '5K': '19:52', '10K': '41:30', 'Half marathon': '1:32:45', Marathon: '3:19:08' },
    races: [
      { year: '2025', name: 'Tata Mumbai Marathon', time: '3:19:08' },
      { year: '2024', name: 'TCS World 10K Bengaluru', time: '41:30' },
      { year: '2024', name: 'Vedanta Delhi Half Marathon', time: '1:32:45' },
      { year: '2023', name: 'Tata Mumbai Marathon', time: '3:34:51' },
      { year: '2022', name: 'Bengaluru Marathon', time: '3:52:17' },
    ],
    coaching: [
      'Run club lead: Sunday long runs at Cubbon Park',
      'Couch-to-5K programmes for beginners',
      'Marathon build-ups: 16-week plans with weekly check-ins',
    ],
  },
};
