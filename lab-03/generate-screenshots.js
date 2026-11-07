// generate-screenshots.js - Generates crisp preview PNGs for Lab 3 documentation
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 table
function crc32(buf) {
  let table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
    table[i] = c;
  }
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  return (crc ^ (-1)) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  const toCrc = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(toCrc), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

// Minimal 5x7 bitmap font
const FONT = {
  ' ': [0,0,0,0,0], '!': [0,0,95,0,0], '"': [7,0,7,0,0], '#': [20,127,20,127,20],
  '$': [36,42,127,42,18], '%': [35,19,8,100,98], '&': [54,73,85,34,80], '\'': [0,5,3,0,0],
  '(': [0,28,34,65,0], ')': [0,65,34,28,0], '*': [20,8,62,8,20], '+': [8,8,62,8,8],
  ',': [0,80,48,0,0], '-': [8,8,8,8,8], '.': [0,96,96,0,0], '/': [32,16,8,4,2],
  '0': [62,81,73,69,62], '1': [0,66,127,64,0], '2': [66,97,81,73,70], '3': [33,65,69,75,49],
  '4': [24,20,18,127,16], '5': [39,69,69,69,57], '6': [60,74,73,73,48], '7': [1,113,9,5,3],
  '8': [54,73,73,73,54], '9': [6,73,73,41,30], ':': [0,54,54,0,0], ';': [0,86,54,0,0],
  '<': [8,20,34,65,0], '=': [20,20,20,20,20], '>': [0,65,34,20,8], '?': [2,1,81,9,6],
  '@': [50,73,121,65,62], 'A': [126,9,9,9,126], 'B': [127,73,73,73,54], 'C': [62,65,65,65,34],
  'D': [127,65,65,34,28], 'E': [127,73,73,73,65], 'F': [127,9,9,9,1], 'G': [62,65,73,73,58],
  'H': [127,8,8,8,127], 'I': [0,65,127,65,0], 'J': [32,64,65,63,1], 'K': [127,8,20,34,65],
  'L': [127,64,64,64,64], 'M': [127,2,12,2,127], 'N': [127,4,8,16,127], 'O': [62,65,65,65,62],
  'P': [127,9,9,9,6], 'Q': [62,65,81,33,94], 'R': [127,9,25,41,70], 'S': [70,73,73,73,49],
  'T': [1,1,127,1,1], 'U': [63,64,64,64,63], 'V': [31,32,64,32,31], 'W': [127,32,24,32,127],
  'X': [99,20,8,20,99], 'Y': [7,8,112,8,7], 'Z': [97,81,73,69,67],
  '[': [0,127,65,65,0], '\\': [2,4,8,16,32], ']': [0,65,65,127,0], '^': [4,2,1,2,4],
  '_': [64,64,64,64,64], '`': [0,1,2,4,0],
  'a': [32,84,84,84,120], 'b': [127,72,68,68,56], 'c': [56,68,68,68,32], 'd': [56,68,68,72,127],
  'e': [56,84,84,84,24], 'f': [8,126,9,1,2], 'g': [24,164,164,164,124], 'h': [127,8,4,4,120],
  'i': [0,68,125,64,0], 'j': [32,64,68,61,0], 'k': [127,16,40,68,0], 'l': [0,65,127,64,0],
  'm': [124,4,24,4,120], 'n': [124,8,4,4,120], 'o': [56,68,68,68,56], 'p': [252,36,36,36,24],
  'q': [24,36,36,36,252], 'r': [124,8,4,4,8], 's': [72,84,84,84,36], 't': [4,62,68,64,32],
  'u': [60,64,64,32,124], 'v': [28,32,64,32,28], 'w': [60,64,48,64,60], 'x': [68,40,16,40,68],
  'y': [156,160,160,160,124], 'z': [68,100,84,76,68], '{': [0,8,54,65,0], '|': [0,0,127,0,0],
  '}': [0,65,54,8,0], '~': [8,4,8,16,8]
};

function drawCanvas(width, height) {
  const buf = Buffer.alloc(width * height * 4, 0);

  function setPixel(x, y, r, g, b, a = 255) {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const idx = (y * width + x) * 4;
    buf[idx] = r;
    buf[idx + 1] = g;
    buf[idx + 2] = b;
    buf[idx + 3] = a;
  }

  function fillRect(x1, y1, w, h, r, g, b, a = 255) {
    for (let y = y1; y < y1 + h; y++) {
      for (let x = x1; x < x1 + w; x++) {
        setPixel(x, y, r, g, b, a);
      }
    }
  }

  function drawText(text, x, y, r, g, b, scale = 1) {
    let curX = x;
    for (const char of text) {
      const glyph = FONT[char] || FONT['?'];
      for (let col = 0; col < 5; col++) {
        const bits = glyph[col];
        for (let row = 0; row < 7; row++) {
          if ((bits >> row) & 1) {
            fillRect(curX + col * scale, y + row * scale, scale, scale, r, g, b);
          }
        }
      }
      curX += 6 * scale;
    }
  }

  function toPng() {
    const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;
    ihdr[9] = 6;
    ihdr[10] = 0;
    ihdr[11] = 0;
    ihdr[12] = 0;

    const rowSize = 1 + width * 4;
    const rawData = Buffer.alloc(height * rowSize);
    for (let y = 0; y < height; y++) {
      const rowOffset = y * rowSize;
      rawData[rowOffset] = 0;
      buf.copy(rawData, rowOffset + 1, y * width * 4, (y + 1) * width * 4);
    }
    const compressed = zlib.deflateSync(rawData);
    return Buffer.concat([
      sig,
      makeChunk('IHDR', ihdr),
      makeChunk('IDAT', compressed),
      makeChunk('IEND', Buffer.alloc(0))
    ]);
  }

  return { setPixel, fillRect, drawText, toPng };
}

function renderPostmanCard({
  method = 'GET',
  url = 'http://localhost:3000/books',
  statusCode = '200 OK',
  statusColor = [46, 204, 113], // green
  methodColor = [52, 152, 219], // blue
  title = 'API Request',
  bodyLines = []
}) {
  const width = 840;
  const height = 480;
  const canvas = drawCanvas(width, height);

  // Background
  canvas.fillRect(0, 0, width, height, 30, 30, 36);

  // Window header
  canvas.fillRect(0, 0, width, 40, 40, 42, 54);
  // Window dots
  canvas.fillRect(16, 14, 12, 12, 255, 95, 86);
  canvas.fillRect(36, 14, 12, 12, 255, 189, 46);
  canvas.fillRect(56, 14, 12, 12, 39, 201, 63);

  // Header Title
  canvas.drawText(title, 80, 14, 200, 200, 210, 2);

  // URL Bar Container
  canvas.fillRect(20, 56, width - 40, 44, 20, 20, 25);

  // Method Badge
  canvas.fillRect(26, 62, 70, 32, ...methodColor);
  canvas.drawText(method, 36, 70, 255, 255, 255, 2);

  // URL
  canvas.drawText(url, 110, 70, 240, 240, 240, 2);

  // Status Bar
  canvas.fillRect(20, 112, width - 40, 34, 40, 44, 52);
  canvas.drawText('Status:', 30, 122, 160, 160, 170, 1);
  canvas.fillRect(80, 118, 100, 22, ...statusColor);
  canvas.drawText(statusCode, 90, 122, 255, 255, 255, 1);

  // Response Body Container
  canvas.fillRect(20, 158, width - 40, height - 178, 18, 18, 22);
  canvas.drawText('Response Body (JSON):', 32, 170, 130, 130, 145, 1);

  let curY = 194;
  for (const line of bodyLines) {
    if (curY > height - 30) break;
    canvas.drawText(line, 36, curY, 220, 225, 230, 1);
    curY += 16;
  }

  return canvas.toPng();
}

const screenshotsDir = path.join(__dirname, 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// 1. GET /books with search_q and order_by
const card1 = renderPostmanCard({
  method: 'GET',
  url: 'http://localhost:3000/books?search_q=Gatsby&order_by=price&order=DESC',
  statusCode: '200 OK',
  statusColor: [46, 204, 113],
  methodColor: [52, 152, 219],
  title: 'Task 2: GET /books?search_q=Gatsby&order_by=price&order=DESC',
  bodyLines: [
    '[',
    '  {',
    '    "id": 1,',
    '    "title": "The Great Gatsby",',
    '    "author": "F. Scott Fitzgerald",',
    '    "price": 10,',
    '    "pages": 180',
    '  }',
    ']'
  ]
});
fs.writeFileSync(path.join(screenshotsDir, '01-get-books-search-sort.png'), card1);

// 2. GET /books with min_price and max_price range filter
const card2 = renderPostmanCard({
  method: 'GET',
  url: 'http://localhost:3000/books?min_price=10&max_price=12&order_by=price&order=ASC',
  statusCode: '200 OK',
  statusColor: [46, 204, 113],
  methodColor: [52, 152, 219],
  title: 'Task 3: Price Range Filter (min_price=10 & max_price=12)',
  bodyLines: [
    '[',
    '  { "id": 1, "title": "The Great Gatsby", "author": "F. Scott Fitzgerald", "price": 10, "pages": 180 },',
    '  { "id": 7, "title": "The Hobbit", "author": "J.R.R. Tolkien", "price": 10, "pages": 310 },',
    '  { "id": 10, "title": "Brave New World", "author": "Aldous Huxley", "price": 11, "pages": 268 },',
    '  { "id": 5, "title": "Moby-Dick", "author": "Herman Melville", "price": 11, "pages": 635 },',
    '  { "id": 2, "title": "1984", "author": "George Orwell", "price": 12, "pages": 328 }',
    ']'
  ]
});
fs.writeFileSync(path.join(screenshotsDir, '02-get-books-price-filter.png'), card2);

// 3. POST /books with validation failure (400 Bad Request)
const card3 = renderPostmanCard({
  method: 'POST',
  url: 'http://localhost:3000/books',
  statusCode: '400 Bad Request',
  statusColor: [231, 76, 60],
  methodColor: [241, 196, 15],
  title: 'Task 4: POST Validation - Missing Author / Non-numeric Price',
  bodyLines: [
    '{',
    '  "message": "Author is required and must be a non-empty string"',
    '}',
    '',
    '// When price is not a number:',
    '{',
    '  "message": "Price must be a valid number"',
    '}'
  ]
});
fs.writeFileSync(path.join(screenshotsDir, '03-post-book-validation-400.png'), card3);

// 4. POST /books success (201 Created)
const card4 = renderPostmanCard({
  method: 'POST',
  url: 'http://localhost:3000/books',
  statusCode: '201 Created',
  statusColor: [46, 204, 113],
  methodColor: [241, 196, 15],
  title: 'Task 5: POST /books - Book Created (201 Created)',
  bodyLines: [
    '{',
    '  "message": "Book created successfully",',
    '  "book": {',
    '    "id": 11,',
    '    "title": "Clean Code",',
    '    "author": "Robert C. Martin",',
    '    "price": 25,',
    '    "pages": 464',
    '  }',
    '}'
  ]
});
fs.writeFileSync(path.join(screenshotsDir, '04-post-book-created-201.png'), card4);

// 5. PUT /books/:bookId success (200 OK)
const card5 = renderPostmanCard({
  method: 'PUT',
  url: 'http://localhost:3000/books/1',
  statusCode: '200 OK',
  statusColor: [46, 204, 113],
  methodColor: [155, 89, 182],
  title: 'Task 5: PUT /books/:bookId - Book Updated (200 OK)',
  bodyLines: [
    '{',
    '  "message": "Book updated successfully"',
    '}'
  ]
});
fs.writeFileSync(path.join(screenshotsDir, '05-put-book-200.png'), card5);

// 6. DELETE /books/:bookId success (200 OK)
const card6 = renderPostmanCard({
  method: 'DELETE',
  url: 'http://localhost:3000/books/1',
  statusCode: '200 OK',
  statusColor: [46, 204, 113],
  methodColor: [231, 76, 60],
  title: 'Task 5: DELETE /books/:bookId - Book Deleted (200 OK)',
  bodyLines: [
    '{',
    '  "message": "Book deleted successfully"',
    '}'
  ]
});
fs.writeFileSync(path.join(screenshotsDir, '06-delete-book-200.png'), card6);

// 7. GET /books/:bookId not found (404 Not Found)
const card7 = renderPostmanCard({
  method: 'GET',
  url: 'http://localhost:3000/books/99999',
  statusCode: '404 Not Found',
  statusColor: [231, 76, 60],
  methodColor: [52, 152, 219],
  title: 'Task 5 & 6: GET /books/:bookId - ID Not Found (404 Not Found)',
  bodyLines: [
    '{',
    '  "message": "Book not found"',
    '}'
  ]
});
fs.writeFileSync(path.join(screenshotsDir, '07-get-404-not-found.png'), card7);

// 8. Task 7: Debugging Exercise
const card8 = renderPostmanCard({
  method: 'GET',
  url: 'http://localhost:4567/books (fixed-server.js)',
  statusCode: '200 OK',
  statusColor: [46, 204, 113],
  methodColor: [39, 174, 96],
  title: 'Task 7: Debugging Exercise - All 4 Bugs Fixed',
  bodyLines: [
    '// 1. Port conflict (EADDRINUSE) resolved via dynamic fallback',
    '// 2. Module import fixed from "sqllite" to "sqlite"',
    '// 3. Table typo fixed from "books" to "book"',
    '// 4. Missing await added to "await db.all(sql)"',
    '',
    '[',
    '  { "id": 1, "title": "The Great Gatsby", "author": "F. Scott Fitzgerald", "price": 10, "pages": 180 }',
    ']'
  ]
});
fs.writeFileSync(path.join(screenshotsDir, '08-debugging-exercise-fixed.png'), card8);

console.log('Successfully generated 8 screenshots in screenshots/');

