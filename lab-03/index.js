// lab-03/index.js - Clean REST API with search, sorting, pagination, validation & error handling
const express = require('express');
const path = require('path');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, 'books.db');
let db = null;

// Initial sample dataset
const initialBooks = [
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

// Initialize database schema and seed sample data
async function initializeDB() {
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

  const countRow = await db.get('SELECT COUNT(*) as count FROM book');
  if (countRow.count === 0) {
    for (const book of initialBooks) {
      await db.run(
        'INSERT INTO book (title, author, price, pages) VALUES (?, ?, ?, ?)',
        book
      );
    }
    console.log('Sample books seeded into database.');
  }
}

// Validation helper for book payload (POST & PUT)
function validateBookPayload(req, res, next) {
  const { title, author, price, pages } = req.body;

  if (title === undefined || typeof title !== 'string' || title.trim() === '') {
    return res.status(400).json({ message: 'Title is required and must be a non-empty string' });
  }

  if (author === undefined || typeof author !== 'string' || author.trim() === '') {
    return res.status(400).json({ message: 'Author is required and must be a non-empty string' });
  }

  if (
    price === undefined ||
    price === null ||
    price === '' ||
    typeof price === 'boolean' ||
    isNaN(Number(price))
  ) {
    return res.status(400).json({ message: 'Price must be a valid number' });
  }

  if (pages !== undefined && pages !== null && pages !== '') {
    if (typeof pages === 'boolean' || isNaN(Number(pages)) || Number(pages) < 0) {
      return res.status(400).json({ message: 'Pages must be a non-negative number' });
    }
  }

  next();
}

// -------------------------------------------------------------
// REST API Endpoints (Task 1: Resource nouns & standard HTTP methods)
// -------------------------------------------------------------

// GET /books - Search, filter by price range, sort, and paginate (Tasks 2 & 3)
app.get('/books', async (req, res, next) => {
  try {
    const {
      search_q = '',
      order_by = 'id',
      order = 'ASC',
      limit = 10,
      offset = 0,
      min_price,
      max_price
    } = req.query;

    const conditions = [];
    const params = [];

    // Task 2: search_q (partial title match with LIKE)
    conditions.push('title LIKE ?');
    params.push(`%${search_q}%`);

    // Task 3: Price range filter (min_price, max_price using BETWEEN or conditions)
    const min = min_price !== undefined && min_price !== '' ? Number(min_price) : null;
    const max = max_price !== undefined && max_price !== '' ? Number(max_price) : null;

    if (min !== null && !isNaN(min) && max !== null && !isNaN(max)) {
      conditions.push('price BETWEEN ? AND ?');
      params.push(min, max);
    } else if (min !== null && !isNaN(min)) {
      conditions.push('price >= ?');
      params.push(min);
    } else if (max !== null && !isNaN(max)) {
      conditions.push('price <= ?');
      params.push(max);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Sanitize order_by to whitelist to prevent SQL injection
    const allowedColumns = ['id', 'title', 'author', 'price', 'pages'];
    const safeOrderBy = allowedColumns.includes(String(order_by).toLowerCase())
      ? String(order_by).toLowerCase()
      : 'id';

    // Sanitize order direction
    const safeOrder = String(order).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    // Parse limit and offset with robust defaults
    const parsedLimit = Math.max(1, parseInt(limit, 10) || 10);
    const parsedOffset = Math.max(0, parseInt(offset, 10) || 0);

    const sql = `
      SELECT * FROM book
      ${whereClause}
      ORDER BY ${safeOrderBy} ${safeOrder}
      LIMIT ? OFFSET ?
    `;
    params.push(parsedLimit, parsedOffset);

    const books = await db.all(sql, params);
    res.status(200).json(books);
  } catch (err) {
    next(err);
  }
});

// GET /books/:bookId - Retrieve a single book by ID
app.get('/books/:bookId', async (req, res, next) => {
  try {
    const { bookId } = req.params;
    const book = await db.get('SELECT * FROM book WHERE id = ?', [bookId]);

    // Task 5 & 6: 404 when ID does not exist with consistent error format
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    res.status(200).json(book);
  } catch (err) {
    next(err);
  }
});

// POST /books - Add a new book (Tasks 4 & 5: Validation & 201 Created)
app.post('/books', validateBookPayload, async (req, res, next) => {
  try {
    const { title, author, price, pages = 0 } = req.body;

    const result = await db.run(
      'INSERT INTO book (title, author, price, pages) VALUES (?, ?, ?, ?)',
      [title.trim(), author.trim(), Number(price), Number(pages) || 0]
    );

    res.status(201).json({
      message: 'Book created successfully',
      book: {
        id: result.lastID,
        title: title.trim(),
        author: author.trim(),
        price: Number(price),
        pages: Number(pages) || 0
      }
    });
  } catch (err) {
    next(err);
  }
});

// PUT /books/:bookId - Update an existing book (Tasks 5 & 6: 200 on update, 404 if missing)
app.put('/books/:bookId', validateBookPayload, async (req, res, next) => {
  try {
    const { bookId } = req.params;
    const { title, author, price, pages = 0 } = req.body;

    const result = await db.run(
      'UPDATE book SET title = ?, author = ?, price = ?, pages = ? WHERE id = ?',
      [title.trim(), author.trim(), Number(price), Number(pages) || 0, bookId]
    );

    if (result.changes === 0) {
      return res.status(404).json({ message: 'Book not found' });
    }

    res.status(200).json({ message: 'Book updated successfully' });
  } catch (err) {
    next(err);
  }
});

// DELETE /books/:bookId - Remove a book (Tasks 5 & 6: 200 on delete, 404 if missing)
app.delete('/books/:bookId', async (req, res, next) => {
  try {
    const { bookId } = req.params;
    const result = await db.run('DELETE FROM book WHERE id = ?', [bookId]);

    if (result.changes === 0) {
      return res.status(404).json({ message: 'Book not found' });
    }

    res.status(200).json({ message: 'Book deleted successfully' });
  } catch (err) {
    next(err);
  }
});

// 404 handler for undefined endpoints
app.use((req, res) => {
  res.status(404).json({ message: 'Endpoint not found' });
});

// Centralized error handler for consistent 500 responses
app.use((err, req, res, next) => {
  console.error('Internal Server Error:', err.message);
  res.status(500).json({ message: 'Internal server error: ' + err.message });
});

// Initialize server with dynamic port fallback to prevent EADDRINUSE
let server = null;

async function startServer(port = process.env.PORT || 3000) {
  await initializeDB();
  return new Promise((resolve, reject) => {
    server = app.listen(port, () => {
      console.log(`Server is running at http://localhost:${port}/`);
      resolve(server);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use (EADDRINUSE). Trying fallback port ${Number(port) + 1}...`);
        server = app.listen(Number(port) + 1, () => {
          console.log(`Server started on fallback port http://localhost:${Number(port) + 1}/`);
          resolve(server);
        });
      } else {
        reject(err);
      }
    });
  });
}

// Auto-start when executed directly
if (require.main === module) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

module.exports = { app, startServer, initializeDB, getDb: () => db };

