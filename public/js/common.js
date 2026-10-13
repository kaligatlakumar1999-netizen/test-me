// Shared helpers used by every page.

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function stars(rating) {
  const full = Math.round(rating);
  return `<span class="stars" aria-label="${rating} out of 5">${'★'.repeat(full)}${'☆'.repeat(5 - full)}</span>`;
}

function money(n) {
  return `₹${Number(n).toLocaleString('en-IN')}`;
}

function initials(name) {
  return esc(name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase());
}

function photo(t, cls) {
  return t.photoUrl
    ? `<img class="${cls}" src="${esc(t.photoUrl)}" alt="${esc(t.name)}" loading="lazy" data-initials="${initials(t.name)}" onerror="photoFallback(this)">`
    : `<div class="${cls} avatar-fallback" aria-hidden="true">${initials(t.name)}</div>`;
}

// Swap a broken photo link for an initials avatar.
function photoFallback(img) {
  const div = document.createElement('div');
  div.className = `${img.className} avatar-fallback`;
  div.textContent = img.dataset.initials;
  img.replaceWith(div);
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function fmtDate(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function todayIso(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function showAlert(el, message, kind = 'error') {
  el.className = `alert alert-${kind}`;
  el.textContent = message;
  el.classList.remove('hidden');
}

let currentUser = null;

async function loadUser() {
  try {
    currentUser = (await api('/api/me')).user;
  } catch {
    currentUser = null;
  }
  renderNav();
  return currentUser;
}

function renderNav() {
  const el = document.getElementById('nav-links');
  if (!el) return;
  if (currentUser) {
    el.innerHTML = `
      <a class="hide-sm" href="/trainers">Find trainers</a>
      <a href="/dashboard">${currentUser.role === 'trainer' ? 'My business' : 'My bookings'}</a>
      <button class="btn btn-sm" id="logout">Log out</button>`;
    document.getElementById('logout').onclick = async () => {
      await api('/api/auth/logout', { method: 'POST' });
      location.href = '/';
    };
  } else {
    el.innerHTML = `
      <a class="hide-sm" href="/trainers">Find trainers</a>
      <a href="/login">Log in</a>
      <a class="btn btn-primary btn-sm" href="/login?mode=signup&role=trainer">I'm a trainer</a>`;
  }
}
