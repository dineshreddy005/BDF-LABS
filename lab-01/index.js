const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Route 1: GET / (welcome text)
app.get('/', (req, res) => {
  res.status(200).send('Welcome to the Node.js & Express Server!');
});

// Route 2: GET /about (JSON with name and section)
app.get('/about', (req, res) => {
  res.status(200).json({
    name: 'Dinesh',
    section: 'BDF Lab 1'
  });
});

// Route 3: GET /time (current date and time using new Date())
app.get('/time', (req, res) => {
  const currentTime = new Date();
  res.status(200).send(`Current Date and Time: ${currentTime.toString()}`);
});

// 404 handler for any unknown path
app.use((req, res) => {
  res.status(404).send('404 Not Found - The requested route does not exist.');
});

// Start the server on port 3000
app.listen(PORT, () => {
  console.log(`Express server running on http://localhost:${PORT}`);
});
