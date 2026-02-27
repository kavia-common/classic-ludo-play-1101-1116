/**
 * Database Connection Module
 * 
 * Connects to the SQLite database and initializes game-related tables.
 * Uses the SQLITE_DB environment variable for the database path,
 * falling back to the database container's default location.
 */

const Database = require('better-sqlite3');
const path = require('path');

// Resolve database file path from environment or default location
const DB_PATH = process.env.SQLITE_DB || 
  path.resolve(__dirname, '../../../../classic-ludo-play-1101-1117/database/myapp.db');

let db;

// PUBLIC_INTERFACE
/**
 * Get the database connection singleton.
 * Creates the connection and initializes tables on first call.
 * @returns {Database} The better-sqlite3 database instance
 */
function getDb() {
  if (!db) {
    try {
      db = new Database(DB_PATH);
      // Enable WAL mode for better concurrent read performance
      db.pragma('journal_mode = WAL');
      db.pragma('foreign_keys = ON');
      console.log(`Connected to SQLite database at: ${DB_PATH}`);
      initializeTables();
    } catch (error) {
      console.error(`Failed to connect to SQLite database at ${DB_PATH}:`, error.message);
      throw error;
    }
  }
  return db;
}

/**
 * Initialize the game-related tables if they don't exist.
 * Creates games, players, and tokens tables.
 */
function initializeTables() {
  const database = db;

  database.exec(`
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      current_player_index INTEGER NOT NULL DEFAULT 0,
      dice_value INTEGER,
      dice_rolled INTEGER NOT NULL DEFAULT 0,
      has_extra_turn INTEGER NOT NULL DEFAULT 0,
      consecutive_sixes INTEGER NOT NULL DEFAULT 0,
      winner INTEGER,
      game_over INTEGER NOT NULL DEFAULT 0,
      turn_phase TEXT NOT NULL DEFAULT 'roll',
      message TEXT NOT NULL DEFAULT '',
      finish_order TEXT NOT NULL DEFAULT '[]',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id TEXT NOT NULL,
      player_index INTEGER NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      start_pos INTEGER NOT NULL,
      home_entry_pos INTEGER NOT NULL,
      has_finished INTEGER NOT NULL DEFAULT 0,
      finish_order INTEGER NOT NULL DEFAULT -1,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
      UNIQUE(game_id, player_index)
    );
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id TEXT NOT NULL,
      player_index INTEGER NOT NULL,
      token_index INTEGER NOT NULL,
      token_id TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'base',
      position INTEGER NOT NULL DEFAULT -1,
      home_stretch_pos INTEGER NOT NULL DEFAULT -1,
      steps_from_start INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
      UNIQUE(game_id, player_index, token_index)
    );
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS move_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id TEXT NOT NULL,
      player_index INTEGER NOT NULL,
      token_id TEXT NOT NULL,
      dice_value INTEGER NOT NULL,
      move_order INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
    );
  `);

  console.log('Game database tables initialized successfully.');
}

// PUBLIC_INTERFACE
/**
 * Close the database connection gracefully.
 */
function closeDb() {
  if (db) {
    db.close();
    db = null;
    console.log('Database connection closed.');
  }
}

module.exports = { getDb, closeDb };
