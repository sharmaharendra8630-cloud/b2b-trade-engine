const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;
// server.js में राउट को इम्पोर्ट करना
const tradeRoutes = './routes/trade'; // (मान लीजिए आपकी फाइल का नाम trade.js है)
app.use('/api/v1/engine', require(tradeRoutes));
// Security & Rate Limiting
app.use(helmet());
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        success: false,
        message: "Too many requests from this IP, please try again after 15 minutes."
    }
});
app.use('/api/', limiter);

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// Database Setup
const db = new sqlite3.Database('./trade_engine.db', (err) => {
    if (err) console.error('Database connection error:', err.message);
    else console.log('Connected to SQLite database.');
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_name TEXT,
        api_key TEXT UNIQUE,
        plan TEXT,
        status TEXT
    )`);
});

// Middleware to verify API Key
const verifyApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
        return res.status(401).json({ success: false, message: "API Key missing in headers." });
    }
    db.get(`SELECT * FROM clients WHERE api_key = ? AND status = 'ACTIVE'`, [apiKey], (err, client) => {
        if (err || !client) {
            return res.status(403).json({ success: false, message: "Invalid or inactive API Key." });
        }
        req.client = client;
        next();
    });
};

// API 3: Register New Client
app.post('/api/v1/clients/register', (req, res) => {
    const { client_name, plan } = req.body;
    if (!client_name) {
        return res.status(400).json({ success: false, message: "Client name is required." });
    }
    const apiKey = 'client_secret_' + Math.random().toString(36).substring(2, 10) + Date.now();
    const clientPlan = plan || 'Basic';
    const status = 'ACTIVE';

    db.run(`INSERT INTO clients (client_name, api_key, plan, status) VALUES (?, ?, ?, ?)`, 
        [client_name, apiKey, clientPlan, status], function(err) {
        if (err) {
            return res.status(500).json({ success: false, message: "Database error: " + err.message });
        }
        res.json({
            success: true,
            message: "Client registered successfully! Copy your API Key.",
            clientDetails: {
                id: this.lastID,
                client_name: client_name,
                api_key: apiKey,
                plan: clientPlan,
                status: status
            }
        });
    });
});

// API 1: Protected Assets
app.get('/api/v1/engine/assets', verifyApiKey, (req, res) => {
    const assets = [
        { id: 1, name: "Smartphone Index", currentPrice: 1420.5, trend: "UP" },
        { id: 2, name: "Sneaker Token", currentPrice: 850.2, trend: "DOWN" },
        { id: 3, name: "AI Drone Index", currentPrice: 3100.0, trend: "UP" }
    ];
    res.json({ success: true, client: req.client.client_name, assets });
});

// API 2: Pool Settlement Simulator
app.post('/api/v1/engine/pool/settle', verifyApiKey, (req, res) => {
    const { trades } = req.body;
    if (!trades || !Array.isArray(trades)) {
        return res.status(400).json({ success: false, message: "Invalid trades data provided." });
    }

    let totalLosersPool = 0;
    let winnersList = [];

    trades.forEach(trade => {
        if (trade.status === 'LOST') {
            totalLosersPool += trade.amount;
        } else if (trade.status === 'WON') {
            winnersList.push(trade);
        }
    });

    const platformCommission = totalLosersPool * 0.02;
    const distributablePool = totalLosersPool - platformCommission;

    res.json({
        success: true,
        processedForClient: req.client.client_name,
        summary: {
            totalLosersPool,
            platformCommission2Percent: platformCommission,
            netPoolForWinners: distributablePool,
            winnersPaidCount: winnersList.length
        },
        distributedWinners: winnersList
    });
});


app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
