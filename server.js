const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middleware (Tailwind CSS CDN के लिए CSP को लूज़ रखा गया है)
app.use(helmet({
  contentSecurityPolicy: false,
}));

// Rate Limiting (Brute-force/DDoS सुरक्षा के लिए)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 मिनट
  max: 100, // एक IP से अधिकतम 100 अनुरोध
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// SQLite Database Setup
const dbFile = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbFile, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    db.run(`CREATE TABLE IF NOT EXISTS trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      buyer TEXT NOT NULL,
      seller TEXT NOT NULL,
      product TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT DEFAULT 'Pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) {
        console.error('Error creating table', err.message);
      }
    });
  }
});

// API Routes
// GET: सभी ट्रेड्स फेच करें
app.get('/api/trades', (req, res) => {
  const query = `SELECT * FROM trades ORDER BY created_at DESC`;
  db.all(query, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({
      message: 'success',
      data: rows
    });
  });
});

// POST: नया ट्रेड जोड़ें
app.post('/api/trades', (req, res) => {
  const { buyer, seller, product, amount, status } = req.body;
  if (!buyer || !seller || !product || !amount) {
    return res.status(400).json({ error: 'Please provide buyer, seller, product, and amount.' });
  }

  const query = `INSERT INTO trades (buyer, seller, product, amount, status) VALUES (?, ?, ?, ?, ?)`;
  const params = [buyer, seller, product, amount, status || 'Pending'];

  db.run(query, params, function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({
      message: 'success',
      data: {
        id: this.lastID,
        buyer,
        seller,
        product,
        amount,
        status: status || 'Pending'
      }
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
