const list = document.getElementById('stations');
const form = document.getElementById('add-form');

const ITEM_CLASSES =
  'flex items-center gap-3 rounded border border-[#CCC] dark:border-[#3D3A3B] px-4 py-3 bg-white dark:bg-[#2D292A]';
const EMPTY_CLASSES =
  'py-3 text-charcoal/50 dark:text-cream/50 text-sm';
const DEL_BTN_CLASSES =
  'ml-auto font-heading font-semibold text-xs uppercase tracking-wider rounded border-2 border-forest dark:border-mint text-forest dark:text-mint px-3 py-1.5 hover:bg-forest dark:hover:bg-mint hover:text-white dark:hover:text-forest transition-colors cursor-pointer shrink-0';

async function load() {
  const res = await fetch('/api/stations');
  const stations = await res.json();
  list.innerHTML = '';
  if (stations.length === 0) {
    const li = document.createElement('li');
    li.className   = EMPTY_CLASSES;
    li.textContent = 'no stations yet';
    list.appendChild(li);
    return;
  }
  for (const s of stations) {
    const li = document.createElement('li');
    li.className = ITEM_CLASSES;
    li.innerHTML = `
      <span class="font-heading font-semibold text-forest dark:text-mint"></span>
      <span class="text-xs text-charcoal/60 dark:text-cream/60 uppercase tracking-wide"></span>
      <button class="${DEL_BTN_CLASSES}" type="button">Delete</button>
    `;
    li.querySelector('span.font-heading').textContent = s.name;
    li.querySelector('span.text-xs').textContent      = s.genre ?? '';
    li.querySelector('button').addEventListener('click', () => del(s.id));
    list.appendChild(li);
  }
}

async function del(id) {
  await fetch(`/api/stations/${id}`, { method: 'DELETE' });
  load();
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  const res = await fetch('/api/stations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (res.ok) {
    form.reset();
    load();
  } else {
    const err = await res.json().catch(() => ({}));
    alert(err.error ?? 'failed to add station');
  }
});

load();
