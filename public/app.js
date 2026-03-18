'use strict';

// State
let allPosts = [];
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth(); // 0-indexed
let editingId = null;
let deletingId = null;

// DOM refs
const calendarGrid = document.getElementById('calendar-grid');
const calendarTitle = document.getElementById('calendar-title');
const postList = document.getElementById('post-list');
const modalOverlay = document.getElementById('modal-overlay');
const confirmOverlay = document.getElementById('confirm-overlay');
const postForm = document.getElementById('post-form');
const postContent = document.getElementById('post-content');
const postDate = document.getElementById('post-date');
const postStatus = document.getElementById('post-status');
const charCounter = document.getElementById('char-counter');
const dayPanel = document.getElementById('day-panel');
const dayPanelTitle = document.getElementById('day-panel-title');
const dayPanelContent = document.getElementById('day-panel-content');

// --- API ---
async function fetchPosts() {
  const res = await fetch('/api/posts');
  allPosts = await res.json();
}

async function createPost(data) {
  const res = await fetch('/api/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

async function updatePost(id, data) {
  const res = await fetch(`/api/posts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

async function deletePost(id) {
  await fetch(`/api/posts/${id}`, { method: 'DELETE' });
}

// --- Navigation ---
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`view-${btn.dataset.view}`).classList.add('active');
    closeDayPanel();
    if (btn.dataset.view === 'list') renderList();
  });
});

// --- Calendar ---
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
const MONTHS_JP = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

function renderCalendar() {
  const year = currentYear;
  const month = currentMonth;
  calendarTitle.textContent = `${year}年 ${MONTHS_JP[month]}`;

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();

  // Group posts by date string
  const postsByDate = {};
  allPosts.forEach(p => {
    const d = p.scheduled_at.slice(0, 10);
    if (!postsByDate[d]) postsByDate[d] = [];
    postsByDate[d].push(p);
  });

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  let html = `<div class="calendar-weekdays">${WEEKDAYS.map(d => `<div class="calendar-weekday">${d}</div>`).join('')}</div><div class="calendar-days">`;

  // Prev month fill
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = daysInPrev - i;
    const m = month === 0 ? 12 : month;
    const y = month === 0 ? year - 1 : year;
    html += buildDayCell(`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`, d, true, false, postsByDate);
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    html += buildDayCell(dateStr, d, false, dateStr === todayStr, postsByDate);
  }

  // Next month fill
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
  const remaining = totalCells - firstDay - daysInMonth;
  for (let d = 1; d <= remaining; d++) {
    const m = month === 11 ? 1 : month + 2;
    const y = month === 11 ? year + 1 : year;
    html += buildDayCell(`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`, d, true, false, postsByDate);
  }

  html += '</div>';
  calendarGrid.innerHTML = html;

  // Click on day
  calendarGrid.querySelectorAll('.calendar-day').forEach(cell => {
    cell.addEventListener('click', (e) => {
      if (e.target.closest('.cal-post-item')) {
        const id = e.target.closest('.cal-post-item').dataset.id;
        openEditModal(parseInt(id));
        return;
      }
      const dateStr = cell.dataset.date;
      openDayPanel(dateStr, postsByDate[dateStr] || []);
    });
  });
}

function buildDayCell(dateStr, dayNum, otherMonth, isToday, postsByDate) {
  const posts = postsByDate[dateStr] || [];
  const MAX_VISIBLE = 3;
  let postsHtml = '';
  posts.slice(0, MAX_VISIBLE).forEach(p => {
    const time = p.scheduled_at.slice(11, 16);
    postsHtml += `<div class="cal-post-item ${p.status}" data-id="${p.id}" title="${escHtml(p.content)}">${time} ${escHtml(p.content.slice(0, 15))}${p.content.length > 15 ? '…' : ''}</div>`;
  });
  if (posts.length > MAX_VISIBLE) {
    postsHtml += `<div class="more-posts">+${posts.length - MAX_VISIBLE}件</div>`;
  }

  return `<div class="calendar-day${otherMonth ? ' other-month' : ''}${isToday ? ' today' : ''}" data-date="${dateStr}">
    <div class="day-number">${dayNum}</div>
    ${postsHtml}
  </div>`;
}

document.getElementById('prev-month').addEventListener('click', () => {
  currentMonth--;
  if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  renderCalendar();
});

document.getElementById('next-month').addEventListener('click', () => {
  currentMonth++;
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  renderCalendar();
});

// --- Day Panel ---
function openDayPanel(dateStr, posts) {
  const [y, m, d] = dateStr.split('-');
  dayPanelTitle.textContent = `${y}年${parseInt(m)}月${parseInt(d)}日`;

  if (posts.length === 0) {
    dayPanelContent.innerHTML = `<div class="empty-state"><div class="icon">📅</div>この日の投稿はありません</div>`;
  } else {
    dayPanelContent.innerHTML = posts.map(p => {
      const time = p.scheduled_at.slice(11, 16);
      return `<div class="day-post-card">
        <div class="day-post-time">
          <span>🕐 ${time}</span>
          <span class="status-badge ${p.status}">${statusLabel(p.status)}</span>
        </div>
        <div class="day-post-text">${escHtml(p.content)}</div>
        <div class="day-post-actions">
          <button class="btn-icon" onclick="openEditModal(${p.id})">✏️</button>
          <button class="btn-icon delete" onclick="confirmDelete(${p.id})">🗑️</button>
        </div>
      </div>`;
    }).join('');
  }

  dayPanel.classList.remove('hidden');
}

function closeDayPanel() {
  dayPanel.classList.add('hidden');
}

document.getElementById('day-panel-close').addEventListener('click', closeDayPanel);

// --- List ---
function renderList() {
  if (allPosts.length === 0) {
    postList.innerHTML = `<div class="empty-state"><div class="icon">📭</div>投稿がありません</div>`;
    return;
  }
  postList.innerHTML = allPosts.map(p => {
    const dt = formatDateTime(p.scheduled_at);
    return `<div class="post-card">
      <div class="post-card-header">
        <span class="status-badge ${p.status}">${statusLabel(p.status)}</span>
        <span class="post-datetime">📅 ${dt}</span>
        <div class="post-actions">
          <button class="btn-icon" title="編集" onclick="openEditModal(${p.id})">✏️</button>
          <button class="btn-icon delete" title="削除" onclick="confirmDelete(${p.id})">🗑️</button>
        </div>
      </div>
      <div class="post-content">${escHtml(p.content)}</div>
    </div>`;
  }).join('');
}

// --- Modal ---
function openNewModal(prefillDate) {
  editingId = null;
  document.getElementById('modal-title').textContent = '新規投稿';
  postForm.reset();
  if (prefillDate) postDate.value = prefillDate + 'T09:00';
  charCounter.textContent = '0 / 280';
  charCounter.className = 'counter';
  modalOverlay.classList.remove('hidden');
  postContent.focus();
}

function openEditModal(id) {
  const post = allPosts.find(p => p.id === id);
  if (!post) return;
  editingId = id;
  document.getElementById('modal-title').textContent = '投稿を編集';
  postContent.value = post.content;
  postDate.value = post.scheduled_at.slice(0, 16);
  postStatus.value = post.status;
  updateCharCounter();
  modalOverlay.classList.remove('hidden');
  postContent.focus();
}

function closeModal() {
  modalOverlay.classList.add('hidden');
  editingId = null;
}

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-cancel').addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });

document.getElementById('new-post-btn-cal').addEventListener('click', () => openNewModal());
document.getElementById('new-post-btn-list').addEventListener('click', () => openNewModal());

// Char counter
function updateCharCounter() {
  const len = postContent.value.length;
  charCounter.textContent = `${len} / 280`;
  charCounter.className = 'counter' + (len > 260 ? (len >= 280 ? ' full' : ' near') : '');
}

postContent.addEventListener('input', updateCharCounter);

// Form submit
postForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = {
    content: postContent.value.trim(),
    scheduled_at: postDate.value + ':00',
    status: postStatus.value,
  };
  if (editingId) {
    await updatePost(editingId, data);
  } else {
    await createPost(data);
  }
  closeModal();
  await fetchPosts();
  renderCalendar();
  renderList();
  closeDayPanel();
});

// --- Delete ---
function confirmDelete(id) {
  deletingId = id;
  confirmOverlay.classList.remove('hidden');
}

document.getElementById('confirm-cancel').addEventListener('click', () => {
  confirmOverlay.classList.add('hidden');
  deletingId = null;
});

document.getElementById('confirm-delete').addEventListener('click', async () => {
  if (deletingId) {
    await deletePost(deletingId);
    deletingId = null;
    confirmOverlay.classList.add('hidden');
    await fetchPosts();
    renderCalendar();
    renderList();
    closeDayPanel();
  }
});

confirmOverlay.addEventListener('click', e => {
  if (e.target === confirmOverlay) {
    confirmOverlay.classList.add('hidden');
    deletingId = null;
  }
});

// --- Helpers ---
function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function statusLabel(status) {
  return { scheduled: '予定', posted: '投稿済', draft: '下書き' }[status] || status;
}

function formatDateTime(str) {
  const d = new Date(str);
  return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日 ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

// --- Init ---
(async () => {
  await fetchPosts();
  renderCalendar();
})();
