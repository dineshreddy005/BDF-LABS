// debugging/broken-server.js
// BROKEN VERSION HANDED OUT BY FACULTY (Contains 4 common bugs)

const express = require('express');
const path = require('path');

// =======================================================================
// BUG 1: Wrong import path (MODULE_NOT_FOUND)
// 'sqllite' is a typo (extra 'l') instead of 'sqlite'
// =======================================================================
const { open } = require('sqllite'); // BUG: Cannot find module 'sqllite'
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

    // Database creates table named "book" (singular)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS book (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        price INTEGER NOT NULL,
        pages INTEGER NOT NULL
      );
    `);

    // ===================================================================
    // BUG 2: Hardcoded port causing EADDRINUSE conflict
    // Hardcoded to 3000 without fallback or process.env.PORT check
    // If another app (e.g., Lab 2) is already running on 3000, this crashes!
    // ===================================================================
    app.listen(3000, () => {
      console.log('Server is running at http://localhost:3000/');
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
    // BUG 3: Table-name typo ("no such table: books")
    // Query uses 'books' (plural), but the table created above is 'book' (singular)
    // ===================================================================
    const sql = 'SELECT * FROM books'; // BUG: Table typo!

    // ===================================================================
    // BUG 4: Missing await
    // db.all() returns a Promise. Without `await`, booksPromise is a pending Promise.
    // Express res.json() serializes the pending Promise to `{}` instead of the array!
    // ===================================================================
    const books = db.all(sql); // BUG: Missing `await`!

    res.json(books); // Sends empty object `{}` instead of book records
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

initializeDBAndServer();

