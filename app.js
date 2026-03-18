'use strict';

const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const db = new Database('posts.db');

// Init DB
db.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    scheduled_at TEXT NOT NULL,
    status TEXT DEFAULT 'scheduled',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  )
`);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// GET all posts
app.get('/api/posts', (req, res) => {
  const posts = db.prepare('SELECT * FROM posts ORDER BY scheduled_at ASC').all();
  res.json(posts);
});

// GET posts by month (YYYY-MM)
app.get('/api/posts/month/:month', (req, res) => {
  const { month } = req.params;
  const posts = db.prepare(
    "SELECT * FROM posts WHERE strftime('%Y-%m', scheduled_at) = ? ORDER BY scheduled_at ASC"
  ).all(month);
  res.json(posts);
});

// POST create
app.post('/api/posts', (req, res) => {
  const { content, scheduled_at, status } = req.body;
  if (!content || !scheduled_at) {
    return res.status(400).json({ error: 'content and scheduled_at are required' });
  }
  const result = db.prepare(
    'INSERT INTO posts (content, scheduled_at, status) VALUES (?, ?, ?)'
  ).run(content, scheduled_at, status || 'scheduled');
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(post);
});

// PUT update
app.put('/api/posts/:id', (req, res) => {
  const { id } = req.params;
  const { content, scheduled_at, status } = req.body;
  const existing = db.prepare('SELECT * FROM posts WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  db.prepare(
    "UPDATE posts SET content = ?, scheduled_at = ?, status = ?, updated_at = datetime('now','localtime') WHERE id = ?"
  ).run(
    content ?? existing.content,
    scheduled_at ?? existing.scheduled_at,
    status ?? existing.status,
    id
  );
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(id);
  res.json(post);
});

// DELETE
app.delete('/api/posts/:id', (req, res) => {
  const { id } = req.params;
  const result = db.prepare('DELETE FROM posts WHERE id = ?').run(id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`X Post Scheduler running on http://localhost:${PORT}`));
