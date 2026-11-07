// debugging/fixed-server.js
// FIXED VERSION AFTER SOLVING ALL 4 FACULTY BUGS

const express = require('express');
const path = require('path');

// =======================================================================
// FIX 1: Fixed import path
// Changed 'sqllite' to 'sqlite'
// =======================================================================
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, 'faculty_books.db');
let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    await db.exec(`
      CREATE TABLE IF NOT EXISTS book (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        price INTEGER NOT NULL,
        pages INTEGER NOT NULL
      );
    `);

    // Seed sample row if table is empty
    const count = await db.get('SELECT COUNT(*) as count FROM book');
    if (count.count === 0) {
      await db.run(
        'INSERT INTO book (title, author, price, pages) VALUES (?, ?, ?, ?)',
        ['The Great Gatsby', 'F. Scott Fitzgerald', 10, 180]
      );
    }

    // ===================================================================
    // FIX 2: Resolved port conflict (EADDRINUSE)
    // Check process.env.PORT, and handle EADDRINUSE with fallback port logic
    // ===================================================================
    const PORT = process.env.PORT || 3000;
    const server = app.listen(PORT, () => {
      console.log(`Server is running at http://localhost:${PORT}/`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        const fallbackPort = Number(PORT) + 1;
        console.warn(`Port ${PORT} in use (EADDRINUSE). Starting on port ${fallbackPort}...`);
        app.listen(fallbackPort, () => {
          console.log(`Server successfully started on fallback port http://localhost:${fallbackPort}/`);
        });
      } else {
        console.error('Server error:', err);
      }
    });

  } catch (e) {
    console.error(`DB Initialization Error: ${e.message}`);
    process.exit(1);
  }
};

// Route: Get all books
app.get('/books', async (req, res) => {
  try {
    // ===================================================================
    // FIX 3: Fixed table-name typo
    // Changed 'books' to 'book' to match the CREATE TABLE definition
    // ===================================================================
    const sql = 'SELECT * FROM book';

    // ===================================================================
    // FIX 4: Added missing `await`
    // Pauses execution until the SQLite Promise resolves to the rows array
    // ===================================================================
    const books = await db.all(sql);

    res.status(200).json(books);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

initializeDBAndServer();

