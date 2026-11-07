// test-api.js - Automated test suite for Lab 3 REST API requirements
const { startServer } = require('./index');

const TEST_PORT = 4123;
const BASE_URL = `http://localhost:${TEST_PORT}`;

let serverInstance = null;
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  PASS: ${message}`);
    passed++;
  } else {
    console.error(`  FAIL: ${message}`);
    failed++;
  }
}

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  let body;
  try {
    body = await res.json();
  } catch (e) {
    body = null;
  }
  return { status: res.status, body };
}

async function runTests() {
  console.log(`\n======================================================`);
  console.log(`Starting Lab 3 Automated Test Suite on port ${TEST_PORT}`);
  console.log(`======================================================\n`);

  serverInstance = await startServer(TEST_PORT);

  try {
    // -------------------------------------------------------------
    // Task 1 & 2: GET /books with default query params
    // -------------------------------------------------------------
    console.log('Test Group 1: GET /books defaults (Task 1 & 2)');
    {
      const res = await request('/books');
      assert(res.status === 200, 'GET /books returns 200 OK');
      assert(Array.isArray(res.body), 'Response is an array of books');
      assert(res.body.length <= 10, 'Default limit of 10 respected');
      assert(res.body[0].id <= res.body[res.body.length - 1].id, 'Default sorting order_by=id ASC');
    }

    // -------------------------------------------------------------
    // Task 2: search_q (partial title match with LIKE)
    // -------------------------------------------------------------
    console.log('\nTest Group 2: search_q partial match (Task 2)');
    {
      const res = await request('/books?search_q=Gatsby');
      assert(res.status === 200, 'GET /books?search_q=Gatsby returns 200 OK');
      assert(res.body.length === 1, 'Found exactly 1 match for Gatsby');
      assert(res.body[0].title === 'The Great Gatsby', 'Title matches "The Great Gatsby"');
    }

    // -------------------------------------------------------------
    // Task 2: order_by and order (ASC / DESC), limit, offset
    // -------------------------------------------------------------
    console.log('\nTest Group 3: Sorting & Pagination query params (Task 2)');
    {
      const res = await request('/books?order_by=price&order=DESC&limit=3&offset=0');
      assert(res.status === 200, 'GET with order_by=price & order=DESC returns 200 OK');
      assert(res.body.length === 3, 'Limit of 3 respected');
      assert(res.body[0].price >= res.body[1].price, 'First book price >= Second book price');
      assert(res.body[1].price >= res.body[2].price, 'Second book price >= Third book price');

      // Pagination offset check
      const resOffset = await request('/books?order_by=price&order=DESC&limit=3&offset=3');
      assert(resOffset.status === 200, 'Offset query returns 200 OK');
      assert(resOffset.body[0].id !== res.body[0].id, 'Offset correctly skips previous items');
    }

    // -------------------------------------------------------------
    // Task 3: Price range filter (min_price, max_price)
    // -------------------------------------------------------------
    console.log('\nTest Group 4: Price range filter (Task 3)');
    {
      // min_price and max_price together
      const resBetween = await request('/books?min_price=10&max_price=12');
      assert(resBetween.status === 200, 'GET /books?min_price=10&max_price=12 returns 200');
      const allInRange = resBetween.body.every(b => b.price >= 10 && b.price <= 12);
      assert(allInRange, 'All returned books have price BETWEEN 10 and 12');

      // min_price only
      const resMin = await request('/books?min_price=14');
      assert(resMin.status === 200, 'GET /books?min_price=14 returns 200');
      const allMin = resMin.body.every(b => b.price >= 14);
      assert(allMin, 'All returned books have price >= 14');

      // max_price only
      const resMax = await request('/books?max_price=9');
      assert(resMax.status === 200, 'GET /books?max_price=9 returns 200');
      const allMax = resMax.body.every(b => b.price <= 9);
      assert(allMax, 'All returned books have price <= 9');
    }

    // -------------------------------------------------------------
    // Task 4: Validate POST body (reject missing title, author, non-numeric price)
    // -------------------------------------------------------------
    console.log('\nTest Group 5: POST body validation (Task 4 & 6)');
    {
      // Missing title
      const resNoTitle = await request('/books', {
        method: 'POST',
        body: JSON.stringify({ author: 'Author Name', price: 15, pages: 100 })
      });
      assert(resNoTitle.status === 400, 'Missing title returns 400 Bad Request');
      assert(typeof resNoTitle.body.message === 'string', 'Returns consistent error message format');

      // Missing author
      const resNoAuthor = await request('/books', {
        method: 'POST',
        body: JSON.stringify({ title: 'Sample Book', price: 15, pages: 100 })
      });
      assert(resNoAuthor.status === 400, 'Missing author returns 400 Bad Request');
      assert(typeof resNoAuthor.body.message === 'string', 'Returns consistent error message format');

      // Non-numeric price
      const resBadPrice = await request('/books', {
        method: 'POST',
        body: JSON.stringify({ title: 'Sample Book', author: 'Author Name', price: 'free', pages: 100 })
      });
      assert(resBadPrice.status === 400, 'Non-numeric price returns 400 Bad Request');
      assert(resBadPrice.body.message.includes('Price must be a valid number'), 'Clear price validation message');
    }

    // -------------------------------------------------------------
    // Task 5: Status codes - 201 Created, 200 OK, 404 Not Found
    // -------------------------------------------------------------
    console.log('\nTest Group 6: CRUD status codes & responses (Task 5 & 6)');
    let createdBookId = null;
    {
      // Create new book -> 201 Created
      const createRes = await request('/books', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Clean Code',
          author: 'Robert C. Martin',
          price: 25,
          pages: 464
        })
      });
      assert(createRes.status === 201, 'POST /books returns 201 Created');
      assert(createRes.body.book && createRes.body.book.id, 'Response contains created book ID');
      createdBookId = createRes.body.book.id;

      // GET created book -> 200 OK
      const getSingle = await request(`/books/${createdBookId}`);
      assert(getSingle.status === 200, 'GET /books/:id returns 200 OK');
      assert(getSingle.body.title === 'Clean Code', 'Fetched book title matches');

      // Update book -> 200 OK
      const updateRes = await request(`/books/${createdBookId}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: 'Clean Code: Refactored',
          author: 'Robert C. Martin',
          price: 30,
          pages: 480
        })
      });
      assert(updateRes.status === 200, 'PUT /books/:id returns 200 OK');
      assert(updateRes.body.message === 'Book updated successfully', 'Consistent update message');

      // Delete book -> 200 OK
      const deleteRes = await request(`/books/${createdBookId}`, {
        method: 'DELETE'
      });
      assert(deleteRes.status === 200, 'DELETE /books/:id returns 200 OK');
      assert(deleteRes.body.message === 'Book deleted successfully', 'Consistent delete message');

      // GET deleted book -> 404 Not Found
      const getDeleted = await request(`/books/${createdBookId}`);
      assert(getDeleted.status === 404, 'GET deleted book returns 404 Not Found');
      assert(getDeleted.body.message === 'Book not found', 'Consistent 404 message');

      // PUT non-existent book -> 404 Not Found
      const putNonExistent = await request('/books/999999', {
        method: 'PUT',
        body: JSON.stringify({
          title: 'Non-existent',
          author: 'Ghost',
          price: 20,
          pages: 100
        })
      });
      assert(putNonExistent.status === 404, 'PUT non-existent book returns 404 Not Found');
      assert(putNonExistent.body.message === 'Book not found', 'Consistent 404 message format');

      // DELETE non-existent book -> 404 Not Found
      const delNonExistent = await request('/books/999999', {
        method: 'DELETE'
      });
      assert(delNonExistent.status === 404, 'DELETE non-existent book returns 404 Not Found');
      assert(delNonExistent.body.message === 'Book not found', 'Consistent 404 message format');
    }

    console.log(`\n======================================================`);
    console.log(`Test Summary: ${passed} PASSED, ${failed} FAILED`);
    console.log(`======================================================\n`);

  } finally {
    if (serverInstance) {
      serverInstance.close();
    }
  }

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test Suite Error:', err);
  if (serverInstance) serverInstance.close();
  process.exit(1);
});

