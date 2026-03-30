import Database from 'better-sqlite3'
import { createHash } from 'crypto'
import { config } from './config.js'

let db

export function getDb() {
  if (!db) {
    db = new Database(config.db.path)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initSchema()
  }
  return db
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS panel_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      last_login TEXT
    );

    CREATE TABLE IF NOT EXISTS vpn_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      traffic_limit_gb REAL DEFAULT 0,
      traffic_used_gb REAL DEFAULT 0,
      expires_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      last_seen TEXT,
      note TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS client_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vpn_user_id INTEGER REFERENCES vpn_users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      format TEXT DEFAULT 'deeplink',
      config_data TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `)

  ensureDefaultAdmin()
}

function ensureDefaultAdmin() {
  const existing = db.prepare('SELECT id FROM panel_users WHERE username = ?').get('admin')
  if (!existing) {
    const hash = createHash('sha256').update('admin').digest('hex')
    db.prepare(
      'INSERT INTO panel_users (username, password_hash) VALUES (?, ?)'
    ).run('admin', hash)
  }
}
