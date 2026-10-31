// index.js - Express server with SQLite CRUD operations
const express = require('express');
const sqlite3 = require('sqlite3').verbose();

const app = express();
app.use(express.json()); // for parsing application/json

// Initialize DB and start server
async function initializeDBAndServer() {
  // Open (or create) the SQLite database file
  const db = new sqlite3.Database('books.db', (err) => {
    if (err) {
      console.error('Failed to open database:', err.message);
      process.exit(1);
    }
    console.log('Connected to the SQLite database.');
  });

  // Create table if it doesn't exist
  const createTableSql = `
    CREATE TABLE IF NOT EXISTS book (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      price INTEGER NOT NULL,
      pages INTEGER NOT NULL
    );
  `;

  db.run(createTableSql, (err) => {
    if (err) {
      console.error('Error creating table:', err.message);
      process.exit(1);
    }
    console.log('Table "book" ensured.');
    // Insert sample rows if table is empty
    db.get('SELECT COUNT(*) as count FROM book', (err, row) => {
      if (err) {
        console.error('Error counting rows:', err.message);
        process.exit(1);
      }
      if (row.count === 0) {
        const sampleBooks = [
          ['The Great Gatsby', 'F. Scott Fitzgerald', 10, 180],
          ['1984', 'George Orwell', 12, 328],
          ['To Kill a Mockingbird', 'Harper Lee', 9, 281],
          ['Pride and Prejudice', 'Jane Austen', 8, 279],
          ['Moby-Dick', 'Herman Melville', 11, 635],
          ['War and Peace', 'Leo Tolstoy', 15, 1225],
          ['The Hobbit', 'J.R.R. Tolkien', 10, 310],
          ['Crime and Punishment', 'Fyodor Dostoevsky', 13, 671],
          ['The Catcher in the Rye', 'J.D. Salinger', 9, 214],
          ['Brave New World', 'Aldous Huxley', 11, 268]
        ];
        const insertSql = 'INSERT INTO book (title, author, price, pages) VALUES (?, ?, ?, ?)';
        const stmt = db.prepare(insertSql);
        for (const book of sampleBooks) {
          stmt.run(book, (err) => {
            if (err) console.error('Error inserting sample data:', err.message);
          });
        }
        stmt.finalize(() => {
          console.log('Sample data inserted.');
        });
      } else {
        console.log('Table already has data, skipping sample insertion.');
      }
    });
  });

  // Define routes
  // GET /books/ - get all books
  app.get('/books', (req, res) => {
    db.all('SELECT * FROM book', [], (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    });
  });

  // GET /books/:bookId/ - get a single book by id
  app.get('/books/:bookId', (req, res) => {
    const sql = 'SELECT * FROM book WHERE id = ?';
    const params = [req.params.bookId];
    db.get(sql, params, (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (!row) {
        res.status(404).json({ error: 'Book not found' });
        return;
      }
      res.json(row);
    });
  });

  // POST /books/ - add a new book
  app.post('/books', (req, res) => {
    const { title, author, price, pages } = req.body;
    const sql = 'INSERT INTO book (title, author, price, pages) VALUES (?, ?, ?, ?)';
    const params = [title, author, price, pages];
    db.run(sql, params, function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.status(201).json({ id: this.lastID, title, author, price, pages });
    });
  });

  // PUT /books/:bookId/ - update an existing book
  app.put('/books/:bookId', (req, res) => {
    const { title, author, price, pages } = req.body;
    const sql = 'UPDATE book SET title = ?, author = ?, price = ?, pages = ? WHERE id = ?';
    const params = [title, author, price, pages, req.params.bookId];
    db.run(sql, params, function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Book not found' });
        return;
      }
      res.json({ message: 'Book updated successfully' });
    });
  });

  // DELETE /books/:bookId/ - remove a book
  app.delete('/books/:bookId', (req, res) => {
    const sql = 'DELETE FROM book WHERE id = ?';
    const params = [req.params.bookId];
    db.run(sql, params, function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Book not found' });
        return;
      }
      res.json({ message: 'Book deleted successfully' });
    });
  });

  // Start server after DB is ready
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

initializeDBAndServer();
