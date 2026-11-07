# Debugging Exercise Guide (Task 7)

This document provides a breakdown of the 4 common errors introduced in the faculty handout (`broken-server.js`) and how each bug was diagnosed and resolved in `fixed-server.js`.

---

## 1. Port Conflict (`EADDRINUSE`)

### Symptom & Error Output
```text
Error: listen EADDRINUSE: address already in use :::3000
    at Server.setupListenHandle [as _listen2] (node:net:1872:16)
    at listenInCluster (node:net:1920:12)
    at Server.listen (node:net:2008:7)
    at Function.listen (.../node_modules/express/lib/application.js:635:24)
```

### Root Cause
Another process (e.g., an earlier server instance, Lab 2, or another background service) is already actively listening on port `3000`. In Node.js, only one socket can bind to a given TCP port and host address simultaneously.

### Diagnosis
To find which process is occupying the port:
- **Windows (PowerShell/CMD):**
  ```powershell
  netstat -ano | findstr :3000
  ```
  Note the `PID` (Process ID) at the end of the line.
- **Linux/macOS:**
  ```bash
  lsof -i :3000
  ```

### Resolution
1. **Kill the existing process** (if it is a lingering orphan):
   - Windows: `taskkill /F /PID <PID>`
   - Linux/macOS: `kill -9 <PID>`
2. **Make the application configurable via environment variable and add graceful fallback:**
   ```javascript
   const PORT = process.env.PORT || 3000;
   const server = app.listen(PORT, () => console.log(`Running on port ${PORT}`));

   server.on('error', (err) => {
     if (err.code === 'EADDRINUSE') {
       console.warn(`Port ${PORT} is busy, retrying on ${Number(PORT) + 1}...`);
       app.listen(Number(PORT) + 1);
     }
   });
   ```

---

## 2. Wrong Import Path (`MODULE_NOT_FOUND`)

### Symptom & Error Output
```text
node:internal/modules/cjs/loader:1225
  throw err;
  ^

Error: Cannot find module 'sqllite'
Require stack:
- C:\Users\dines\Desktop\BDF\BDF-LABS\lab-03\debugging\broken-server.js
    at Module._resolveFilename (node:internal/modules/cjs/loader:1222:15)
    at Module._load (node:internal/modules/cjs/loader:1048:27)
    at Module.require (node:internal/modules/cjs/loader:1308:19)
    at require (node:internal/modules/helpers:130:18)
    at Object.<anonymous> (.../broken-server.js:9:19) {
  code: 'MODULE_NOT_FOUND',
  requireStack: [
    '.../broken-server.js'
  ]
}
```

### Root Cause
Typo in the module specifier (`'sqllite'` with two `l`s instead of `'sqlite'`), or specifying an incorrect relative path (such as `./database` instead of `../database`).

### Diagnosis
Inspect the `require(...)` statement and check `package.json` dependencies to confirm package naming.

### Resolution
Change:
```javascript
const { open } = require('sqllite'); // BUG
```
to:
```javascript
const { open } = require('sqlite'); // FIXED
```

---

## 3. Table-Name Typo (`SQLITE_ERROR: no such table`)

### Symptom & Error Output
```text
DB Initialization Error: SQLITE_ERROR: no such table: books
--> Response sent to client: 500 Internal Server Error { "message": "SQLITE_ERROR: no such table: books" }
```

### Root Cause
The database schema created the table as `book` (singular):
```sql
CREATE TABLE IF NOT EXISTS book (...);
```
However, the SQL query in the route handler attempted to query from `books` (plural):
```sql
SELECT * FROM books;
```
Because SQLite is case-sensitive or strictly matches schema identifiers, referencing a non-existent table throws `SQLITE_ERROR`.

### Diagnosis
Inspect table names using SQLite meta-query:
```sql
SELECT name FROM sqlite_master WHERE type='table';
```
Compare the output against the table name in the application queries.

### Resolution
Align the table name in the query to match the table definition:
```javascript
const sql = 'SELECT * FROM book'; // FIXED: singular 'book'
```

---

## 4. Missing `await` Keyword

### Symptom & Response
When calling `GET /books`:
- The client receives an empty JSON object: `{}`
- Or in Node console: UnhandledPromiseRejection or `TypeError`.

### Root Cause
`sqlite`'s `db.all(sql)` is an asynchronous function that returns a `Promise`.
Without `await`:
```javascript
const books = db.all(sql); // Returns Promise { <pending> }
res.json(books);
```
`JSON.stringify(Promise)` converts an unfulfilled `Promise` object into `{}` because promises do not serialize enumerable properties. The response is sent before the database finishes reading the rows.

### Diagnosis
Logging `console.log(books)` outputs:
```text
Promise { <pending> }
```
instead of an array of book objects `[ { id: 1, title: '...' }, ... ]`.

### Resolution
Ensure the route handler is `async` and prepend `await`:
```javascript
const books = await db.all(sql); // FIXED: awaits resolved array of books
res.json(books);
```

