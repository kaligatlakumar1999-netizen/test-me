// Draws a trainer's athlete record as illustrations rather than bare numbers:
// a road or track for distance, gear on the floor for years in a sport, a mountain
// for elevation, a crowd for people coached, distance lines for PBs and medals for races.
// Needs esc() from common.js. Colours come from the --f-* CSS variables in feats.css.

const FitFeats = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const EVEREST = { m: 8849, ft: 29032 };
  const PB_KM = { '5K': 5, '10K': 10, 'Half marathon': 21.0975, Marathon: 42.195 };
  const PB_SHORT = { '5K': '5K', '10K': '10K', 'Half marathon': 'Half', Marathon: 'Full' };
  const ACTIVITY_NAMES = {
    weights: 'Lifting weights', running: 'Running', cricket: 'Cricket', football: 'Football', yoga: 'Yoga',
    boxing: 'Boxing', swimming: 'Swimming', cycling: 'Cycling', other: 'Training',
  };
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const num = (n) => Number(n).toLocaleString('en-IN', { maximumFractionDigits: 1 });
  const unitWord = (v, u) => (u === 'mi' ? (Number(v) === 1 ? 'mile' : 'miles') : u);
  const ease = (t) => 1 - Math.pow(1 - t, 3);

  function figure(svg, big, label, { wide = false, extra = '' } = {}) {
    return `
      <figure class="feat${wide ? ' wide' : ''}">
        <div class="feat-art">${svg}</div>
        <figcaption>
          <div class="feat-big">${big}</div>
          ${label ? `<div class="feat-label">${esc(label)}</div>` : ''}
          ${extra}
        </figcaption>
      </figure>`;
  }

  // ---------- distance: a winding road ----------
  function road(f) {
    const d = 'M30,180 C110,180 120,64 210,72 S330,196 420,146 S530,52 578,62';
    const big = `${num(f.value)} ${unitWord(f.value, f.unit)}`;
    const svg = `
      <svg class="feat-svg" viewBox="0 0 600 220" role="img" aria-label="A road covering ${big}">
        <path class="f-road" d="${d}"/>
        <path class="f-road-line" d="${d}"/>
        <path class="f-trail" d="${d}" data-draw data-ticks="${f.value}" data-unit="${f.unit}"/>
        <g class="f-ticks"></g>
        <g transform="translate(30,180)"><line class="f-pole" x1="0" y1="0" x2="0" y2="-34"/><path class="f-flag-soft" d="M0,-34 L18,-28 L0,-22 Z"/></g>
        <g transform="translate(578,62)"><line class="f-pole" x1="0" y1="0" x2="0" y2="-34"/><path class="f-flag" d="M0,-34 L18,-28 L0,-22 Z"/></g>
        <circle class="f-runner" r="7" cx="30" cy="180"/>
      </svg>`;
    return figure(svg, big, f.label, { wide: true });
  }

  // ---------- distance: laps of a 400 m track ----------
  function track(f) {
    const metres = f.value * (f.unit === 'mi' ? 1609.344 : 1000);
    const laps = Math.round(metres / 400);
    const big = `${num(f.value)} ${unitWord(f.value, f.unit)}`;
    const stadium = (x, y, w, h) => {
      const r = h / 2;
      return `M${x + r},${y} H${x + w - r} A${r},${r} 0 0 1 ${x + w - r},${y + h} H${x + r} A${r},${r} 0 0 1 ${x + r},${y} Z`;
    };
    const lanes = [0, 1, 2, 3, 4].map((i) => `<path class="f-lane" d="${stadium(40 + i * 9, 20 + i * 9, 520 - i * 18, 190 - i * 18)}"/>`).join('');
    const svg = `
      <svg class="feat-svg" viewBox="0 0 600 230" role="img" aria-label="${big}, ${num(laps)} laps of a running track">
        <path class="f-track" d="${stadium(40, 20, 520, 190)}"/>
        ${lanes}
        <path class="f-infield" d="${stadium(85, 65, 430, 100)}"/>
        <path class="f-lap" d="${stadium(62, 42, 476, 146)}" data-lap data-laps="${laps}"/>
        <text class="f-lapcount" x="300" y="118" text-anchor="middle">0</text>
        <text class="f-lapunit" x="300" y="142" text-anchor="middle">laps of a 400 m track</text>
        <circle class="f-runner" r="7" cx="300" cy="42"/>
      </svg>`;
    return figure(svg, big, f.label, { extra: `<div class="feat-note">That's ${num(laps)} laps of a 400 m track.</div>` });
  }

  // ---------- years of lifting: weights on the floor, one plate per year ----------
  function weights(f) {
    const years = Math.round(f.value);
    const shown = Math.min(years, 14);
    const plates = Array.from({ length: shown }, (_, i) =>
      `<rect class="f-plate-flat pop" style="--i:${i}" x="${40 - (i % 2) * 3}" y="${211 - (i + 1) * 11}" width="${96 + (i % 2) * 6}" height="10" rx="3"/>`).join('');
    const svg = `
      <svg class="feat-svg" viewBox="0 ${Math.min(90, 200 - shown * 11 - 40)} 600 ${240 - Math.min(90, 200 - shown * 11 - 40)}" role="img" aria-label="A barbell and ${years} weight plates, one for each year">
        <line class="f-floor" x1="10" y1="211" x2="590" y2="211"/>
        ${plates}
        <text class="f-small" x="${88}" y="${211 - shown * 11 - 12}" text-anchor="middle">${years > 14 ? `${years} plates` : '1 plate = 1 year'}</text>
        <g class="rise">
          <rect class="f-bar" x="186" y="164" width="270" height="7" rx="3"/>
          <rect class="f-sleeve" x="166" y="160" width="26" height="15" rx="3"/>
          <rect class="f-sleeve" x="450" y="160" width="26" height="15" rx="3"/>
          <rect class="f-plate" x="196" y="119" width="22" height="92" rx="5"/>
          <rect class="f-plate-2" x="220" y="131" width="18" height="70" rx="5"/>
          <rect class="f-plate-3" x="240" y="143" width="12" height="46" rx="4"/>
          <rect class="f-plate" x="424" y="119" width="22" height="92" rx="5"/>
          <rect class="f-plate-2" x="404" y="131" width="18" height="70" rx="5"/>
          <rect class="f-plate-3" x="390" y="143" width="12" height="46" rx="4"/>
        </g>
        <g class="rise" style="--i:3">
          <path class="f-handle" d="M484,180 C482,146 518,146 516,180"/>
          <circle class="f-bell" cx="500" cy="189" r="22"/>
        </g>
        <g transform="translate(534,196)"><g class="rise" style="--i:5">
          <rect class="f-plate-2" x="0" y="0" width="10" height="15" rx="2"/>
          <rect class="f-bar" x="10" y="5" width="34" height="5" rx="2"/>
          <rect class="f-plate-2" x="44" y="0" width="10" height="15" rx="2"/>
        </g></g>
      </svg>`;
    return figure(svg, `${num(f.value)} ${Number(f.value) === 1 ? 'year' : 'years'}`, f.label || ACTIVITY_NAMES.weights);
  }

  // ---------- years of another sport: a staircase, one step per year, gear at the top ----------
  const ICONS = {
    running: '<path class="f-gear" d="M4,40 L20,37 L30,22 L39,26 L43,35 L56,39 Q60,48 51,50 L8,50 Q1,48 4,40 Z"/><path class="f-gear-line" d="M6,46 H54 M30,22 L34,32 M36,24 L39,32"/>',
    cricket: '<g transform="rotate(-32 30 30)"><rect class="f-gear" x="24" y="2" width="12" height="38" rx="4"/><rect class="f-gear-dark" x="28" y="38" width="4" height="18" rx="2"/></g><circle class="f-ball" cx="49" cy="48" r="7"/><path class="f-gear-line" d="M44,45 Q49,48 54,51"/>',
    football: '<circle class="f-gear" cx="30" cy="32" r="22"/><path class="f-gear-dark" d="M30,22 L39,29 L36,40 L24,40 L21,29 Z"/><path class="f-gear-line" d="M30,22 V11 M39,29 L50,25 M36,40 L43,50 M24,40 L17,50 M21,29 L10,25"/>',
    yoga: '<rect class="f-gear" x="2" y="34" width="46" height="18" rx="9"/><circle class="f-gear-dark" cx="48" cy="43" r="10"/><circle class="f-ball" cx="48" cy="43" r="4"/>',
    boxing: '<path class="f-gear" d="M14,34 C8,14 26,4 40,10 C54,16 52,36 44,40 L44,44 L18,44 Z"/><rect class="f-gear-dark" x="16" y="42" width="30" height="14" rx="3"/><path class="f-gear-line" d="M22,30 Q30,24 34,30"/>',
    swimming: '<path class="f-gear-line thick" d="M2,22 q7,-8 14,0 t14,0 t14,0 t14,0 M2,36 q7,-8 14,0 t14,0 t14,0 t14,0 M2,50 q7,-8 14,0 t14,0 t14,0 t14,0"/>',
    cycling: '<circle class="f-gear-line thick" cx="13" cy="42" r="11"/><circle class="f-gear-line thick" cx="48" cy="42" r="11"/><path class="f-gear-line thick" d="M13,42 L25,24 L42,24 L48,42 M25,24 L31,42 L13,42 M42,24 L40,15 L46,15 M23,20 H30"/>',
    other: '<path class="f-gear" d="M30,4 L37,22 L56,22 L41,34 L47,53 L30,42 L13,53 L19,34 L4,22 L23,22 Z"/>',
  };
  function stairs(f) {
    const years = Math.max(1, Math.round(f.value));
    const shown = Math.min(years, 20);
    const stepW = Math.min(44, 440 / shown);
    const stepH = Math.min(22, 150 / shown);
    const x0 = 40;
    const steps = Array.from({ length: shown }, (_, i) => {
      const x = x0 + i * stepW, h = (i + 1) * stepH;
      const lab = shown <= 12 || i === 0 || i === shown - 1 ? `<text class="f-tiny" x="${x + stepW / 2}" y="226" text-anchor="middle">${i + 1}</text>` : '';
      return `<rect class="f-step pop" style="--i:${i}" x="${x}" y="${211 - h}" width="${stepW + 0.5}" height="${h}"/>${lab}`;
    }).join('');
    const topX = x0 + shown * stepW - stepW / 2;
    const topY = 211 - shown * stepH;
    const name = ACTIVITY_NAMES[f.activity] || 'Training';
    const svg = `
      <svg class="feat-svg" viewBox="0 0 600 240" role="img" aria-label="${years} steps, one for each year of ${esc(name)}">
        <line class="f-floor" x1="10" y1="211" x2="590" y2="211"/>
        ${steps}
        <path class="f-stair-edge" d="M${x0},211 ${Array.from({ length: shown }, (_, i) => `V${211 - (i + 1) * stepH} H${x0 + (i + 1) * stepW}`).join(' ')} V211"/>
        <g transform="translate(${Math.min(topX - 42, 510)},${Math.max(0, topY - 90)}) scale(1.4)"><g class="rise" style="--i:${shown}">${ICONS[f.activity] || ICONS.other}</g></g>
        <text class="f-small" ${shown <= 12 ? 'x="590" y="200" text-anchor="end"' : `x="${x0}" y="24"`}>${years > 20 ? `each step = 1 year (${years})` : 'each step = 1 year'}</text>
      </svg>`;
    return figure(svg, `${num(f.value)} ${Number(f.value) === 1 ? 'year' : 'years'}`, f.label || name);
  }

  // ---------- elevation: a mountain, counted in Everests ----------
  function mountain(f) {
    const everests = f.value / EVEREST[f.unit || 'm'];
    const shownPeaks = Math.min(Math.max(1, Math.round(everests)), 30);
    const peaks = Array.from({ length: shownPeaks }, (_, i) =>
      `<path class="f-mini pop" style="--i:${i}" d="M${i * 18},14 L${i * 18 + 8},0 L${i * 18 + 16},14 Z"/>`).join('');
    const svg = `
      <svg class="feat-svg" viewBox="0 0 600 230" role="img" aria-label="A mountain: ${num(f.value)} ${f.unit} climbed">
        <path class="f-range" d="M0,211 L90,120 L150,170 L230,90 L300,30 L380,110 L440,70 L520,150 L600,100 L600,211 Z"/>
        <path class="f-peak" d="M150,211 L300,30 L450,211 Z"/>
        <path class="f-snow" d="M272,64 L300,30 L328,64 L314,58 L300,72 L287,58 Z"/>
        <path class="f-trail" data-draw d="M178,211 L250,176 L222,150 L282,122 L262,98 L300,34"/>
        <g transform="translate(300,34)"><line class="f-pole" x1="0" y1="0" x2="0" y2="-26"/><path class="f-flag" d="M0,-26 L16,-21 L0,-16 Z"/></g>
        <line class="f-floor" x1="0" y1="211" x2="600" y2="211"/>
        <circle class="f-runner" r="6" cx="178" cy="211"/>
      </svg>`;
    const extra = `
      <div class="feat-note">${everests >= 1 ? `About ${num(Math.round(everests * 10) / 10)} × Mount Everest` : `${Math.round(everests * 100)}% of Mount Everest`}</div>
      <svg class="f-peaks" viewBox="0 0 ${shownPeaks * 18} 14" aria-hidden="true">${peaks}</svg>`;
    return figure(svg, `${num(f.value)} ${f.unit || 'm'}`, f.label || 'climbed', { extra });
  }

  // ---------- people: a crowd, one figure per person ----------
  function crowd(f) {
    const n = Math.round(f.value);
    const per = Math.max(1, Math.ceil(n / 160));
    const count = Math.ceil(n / per);
    const cols = Math.min(count, 20);
    const rows = Math.ceil(count / cols);
    const people = Array.from({ length: count }, (_, i) => {
      const x = (i % cols) * 28 + 14, y = Math.floor(i / cols) * 34 + 10;
      return `<g transform="translate(${x},${y})"><g class="pop" style="--i:${Math.min(i, 80)}"><circle class="f-head" cx="0" cy="0" r="5"/><path class="f-body" d="M-8,22 Q-8,8 0,8 Q8,8 8,22 Z"/></g></g>`;
    }).join('');
    const svg = `<svg class="feat-svg" viewBox="0 0 ${cols * 28} ${rows * 34}" role="img" aria-label="${n} figures">${people}</svg>`;
    return figure(svg, `${num(n)}`, f.label || 'people coached', {
      extra: per > 1 ? `<div class="feat-note">Each figure = ${per} people</div>` : '',
    });
  }

  // ---------- PBs: lines as long as the race ----------
  function pbLadder(pbs) {
    const rows = Object.entries(pbs || {}).filter(([d]) => PB_KM[d]);
    if (!rows.length) return '';
    const full = 350, x0 = 80;
    const svg = `
      <svg class="feat-svg" viewBox="0 0 600 ${rows.length * 62 + 4}" role="img" aria-label="Personal bests">
        ${rows.map(([d, t], i) => {
          const y = i * 62 + 26, w = Math.max(14, (PB_KM[d] / 42.195) * full);
          return `
            <text class="f-pbname" x="0" y="${y + 5}">${PB_SHORT[d]}</text>
            <line class="f-lane-line" x1="${x0}" y1="${y}" x2="${x0 + full}" y2="${y}"/>
            <line class="f-pbline" data-draw x1="${x0}" y1="${y}" x2="${x0 + w}" y2="${y}"/>
            <circle class="f-dot" cx="${x0 + w}" cy="${y}" r="5"/>
            <text class="f-pbtime" x="${x0 + w + 14}" y="${y + 9}">${esc(t)}</text>
            <text class="f-tiny" x="${x0 + w}" y="${y + 24}" text-anchor="middle">${num(PB_KM[d])} km</text>`;
        }).join('')}
      </svg>`;
    return `<figure class="feat wide"><div class="feat-art">${svg}</div><figcaption><div class="feat-label">Personal bests. Each line is as long as the race.</div></figcaption></figure>`;
  }

  // ---------- races: finisher medals ----------
  function medals(races) {
    if (!races?.length) return '';
    return `
      <div class="medals">${races.map((r, i) => `
        <figure class="medal" style="--i:${i}">
          <svg viewBox="0 0 120 176" aria-hidden="true">
            <path class="f-ribbon-a" d="M28,0 H54 L72,78 L58,86 Z"/>
            <path class="f-ribbon-b" d="M92,0 H66 L48,78 L62,86 Z"/>
            <circle class="f-medal" cx="60" cy="124" r="44"/>
            <circle class="f-medal-ring" cx="60" cy="124" r="35"/>
            <text class="f-medal-year" x="60" y="112" text-anchor="middle">${esc(r.year)}</text>
            <text class="f-medal-time" x="60" y="138" text-anchor="middle">${esc(r.time || 'Finisher')}</text>
          </svg>
          <figcaption>${esc(r.name)}</figcaption>
        </figure>`).join('')}
      </div>`;
  }

  function render(a = {}) {
    const feats = (a.feats || []).map((f) => {
      if (f.kind === 'distance') return f.style === 'track' ? track(f) : road(f);
      if (f.kind === 'years') return f.activity === 'weights' ? weights(f) : stairs(f);
      if (f.kind === 'elevation') return mountain(f);
      if (f.kind === 'people') return crowd(f);
      return '';
    }).join('');
    const parts = [];
    if (feats || a.stravaUrl) {
      parts.push(`
        <section class="feat-group">
          <header class="feat-head"><h4>On the record</h4>${a.stravaUrl ? `<a class="strava-tag" href="${esc(a.stravaUrl)}" target="_blank" rel="noopener noreferrer">Follow on Strava ↗</a>` : ''}</header>
          <div class="feats">${feats}</div>
        </section>`);
    }
    const pb = pbLadder(a.pbs);
    if (pb) parts.push(`<section class="feat-group"><header class="feat-head"><h4>Personal bests</h4></header><div class="feats">${pb}</div></section>`);
    const md = medals(a.races);
    if (md) parts.push(`<section class="feat-group"><header class="feat-head"><h4>Medals</h4></header>${md}</section>`);
    if (a.coaching?.length) {
      parts.push(`<section class="feat-group"><header class="feat-head"><h4>Coaching</h4></header><ul class="feat-list">${a.coaching.map((c) => `<li>${esc(c)}</li>`).join('')}</ul></section>`);
    }
    return parts.length ? `<div class="athlete">${parts.join('')}</div>` : '';
  }

  // ---------- animation ----------

  function el(tag, attrs) {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    return n;
  }

  // Put distance markers along a road, e.g. 0 · 25 · 50 · 75 · 100 mi.
  function addTicks(path) {
    const total = Number(path.dataset.ticks);
    const unit = path.dataset.unit;
    const len = path.getTotalLength();
    const g = path.parentNode.querySelector('.f-ticks');
    [0, 0.25, 0.5, 0.75, 1].forEach((p) => {
      const pt = path.getPointAtLength(len * p);
      g.appendChild(el('circle', { class: 'f-tick', cx: pt.x, cy: pt.y, r: 3.5 }));
      if (p === 0) return;
      const t = el('text', { class: 'f-tiny', x: pt.x, y: pt.y + (p === 1 ? 24 : -14), 'text-anchor': p === 1 ? 'end' : 'middle' });
      t.textContent = `${num(Math.round(total * p * 10) / 10)} ${unit}`;
      g.appendChild(t);
    });
  }

  function prepare(fig) {
    fig.querySelectorAll('[data-ticks]').forEach(addTicks);
    fig.querySelectorAll('[data-draw]').forEach((p) => {
      const len = p.getTotalLength ? p.getTotalLength() : 0;
      p.style.strokeDasharray = len;
      p.style.strokeDashoffset = reduceMotion ? 0 : len;
    });
    if (reduceMotion) {
      fig.classList.add('go');
      finishRunner(fig);
      fig.querySelectorAll('[data-lap]').forEach((p) => {
        p.parentNode.querySelector('.f-lapcount').textContent = num(Number(p.dataset.laps));
      });
    }
  }

  function finishRunner(fig) {
    const path = fig.querySelector('[data-draw]');
    const runner = fig.querySelector('.f-runner');
    if (!path || !runner || !path.getPointAtLength) return;
    const pt = path.getPointAtLength(path.getTotalLength());
    runner.setAttribute('cx', pt.x);
    runner.setAttribute('cy', pt.y);
  }

  function play(fig) {
    fig.classList.add('go');
    if (reduceMotion) return;
    const draws = [...fig.querySelectorAll('[data-draw]')];
    const runner = fig.querySelector('.f-runner');
    const lap = fig.querySelector('[data-lap]');
    const counter = lap?.parentNode.querySelector('.f-lapcount');
    const laps = lap ? Number(lap.dataset.laps) : 0;
    const lapLen = lap ? lap.getTotalLength() : 0;
    const dur = 2200, t0 = performance.now();
    const frame = (now) => {
      const t = Math.min(1, (now - t0) / dur), e = ease(t);
      draws.forEach((p, i) => {
        const len = parseFloat(p.style.strokeDasharray);
        const local = ease(Math.min(1, Math.max(0, (now - t0 - i * 120) / dur)));
        p.style.strokeDashoffset = len * (1 - local);
      });
      const main = draws[0];
      if (runner && main && main.tagName === 'path') {
        const pt = main.getPointAtLength(main.getTotalLength() * e);
        runner.setAttribute('cx', pt.x);
        runner.setAttribute('cy', pt.y);
      }
      if (lap && runner) {
        const pt = lap.getPointAtLength(((e * 3) % 1) * lapLen);
        runner.setAttribute('cx', pt.x);
        runner.setAttribute('cy', pt.y);
        counter.textContent = num(Math.round(laps * e));
      }
      if (t < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  function activate(root = document) {
    const figs = [...root.querySelectorAll('.feat, .medals')].filter((f) => !f.dataset.ready);
    if (!figs.length) return;
    figs.forEach((f) => { f.dataset.ready = '1'; prepare(f); });
    if (reduceMotion) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        play(e.target);
        io.unobserve(e.target);
      }
    }, { threshold: 0.35 });
    figs.forEach((f) => io.observe(f));
  }

  return { render, activate };
})();
