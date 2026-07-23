const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const helmet = require('helmet');          // 👈 नया सिक्योरिटी पैकेज
const rateLimit = require('express-rate-limit'); // 👈 नया रेट लिमिटर पैकेज
const app = express();

// ==========================================
// 🛡️ SECURITY & RATE LIMITING MIDDLEWARE
// ==========================================
app.use(helmet()); // सुरक्षा के लिए HTTP हेडर सेट करना

// रेट लिमिटर (एक आईपी से 15 मिनट में अधिकतम 100 रिक्वेस्ट)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 100, 
    message: {
        success: false,
        message: "Too many requests from this IP, please try again after 15 minutes."
    }
});

// इसे सभी /api/ रूट्स पर लागू करना
app.use('/api/', limiter);

// मिडलवेयर (Middleware)
app.use(express.json());
app.use(cors());
app.use(express.static('public')); // स्टैटिक फोल्डर (डैशबोर्ड)

// मिडलवेयर (Middleware)
app.use(express.json());
// स्टैटिक फाइल्स (Frontend UI) सर्व करने के लिए
app.use(express.static('public'));
app.use(cors());

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// 1. Helmet सिक्योरिटी हेडर जोड़ना
app.use(helmet());

// 2. Rate Limiter सेट करना (ताकि कोई एक आईपी से बार-बार स्पैम रिक्वेस्ट न भेज सके)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 मिनट का समय
    max: 100, // एक आईपी से 15 मिनट में अधिकतम 100 रिक्वेस्ट
    message: {
        success: false,
        message: "Too many requests from this IP, please try again after 15 minutes."
    }
});

// इसे सभी API रूट्स पर लागू करना
app.use('/api/', limiter);

// ==========================================
// 🗄️ DATABASE SETUP (SQLite)
// ==========================================
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        console.error('Database opening error: ' + err.message);
    } else {
        console.log('connected to the SQLite database.');
    }
});

// क्लाइंट्स की टेबल बनाना और एक डिफ़ॉल्ट टेस्ट की (Test API Key) डालना
db.run(`CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_name TEXT,
    api_key TEXT UNIQUE,
    plan TEXT,
    status TEXT
)`, (err) => {
    if (!err) {
        // डिफ़ॉल्ट टेस्ट क्लाइंट जोड़ना (अगर पहले से न हो)
        db.run(`INSERT OR IGNORE INTO clients (client_name, api_key, plan, status) 
                VALUES ('Demo Startup', 'client_secret_xyz123', 'Growth', 'ACTIVE')`);
    }
});

// ==========================================
// 🛡️ DYNAMIC API KEY AUTHENTICATION MIDDLEWARE
// ==========================================
const verifyApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized! Missing API Key in headers ('x-api-key')."
        });
    }

    // डेटाबेस से चेक करना कि क्या यह API Key वैध और एक्टिव है या नहीं
    db.get(`SELECT * FROM clients WHERE api_key = ? AND status = 'ACTIVE'`, [apiKey], (err, client) => {
        if (err) {
            return res.status(500).json({ success: false, message: "Internal server error." });
        }
        if (!client) {
            return res.status(403).json({
                success: false,
                message: "Forbidden! Invalid or inactive API Key."
            });
        }

        // क्लाइंट की जानकारी को रिक्वेस्ट ऑब्जेक्ट में आगे पास करना
        req.client = client;
        next();
    });
};

app.get('/', (req, res) => {
    res.send('B2B Trade Engine API is running successfully! 🚀');
});

// ==========================================
// API 3: नया क्लाइंट रजिस्टर करना (Client Registration)
// ==========================================
app.post('/api/v1/clients/register', (req, res) => {
    const { client_name, plan } = req.body;

    if (!client_name) {
        return res.status(400).json({ 
            success: false, 
            message: "Client name is required." 
        });
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

// ==========================================
// API 1: एसेट्स और कीमतें (Protected)
// ==========================================
app.get('/api/v1/engine/assets', verifyApiKey, (req, res) => {
    res.json({
        success: true,
        client: req.client.client_name,
        timestamp: new Date().toISOString(),
        assets: [
            { id: "smartphone_idx", name: "Smartphone Index", currentPrice: 1420.50, trend: "UP" },
            { id: "sneaker_tok", name: "Sneaker Token", currentPrice: 850.20, trend: "DOWN" },
            { id: "ai_drone", name: "AI Drone Index", currentPrice: 3100.00, trend: "UP" }
        ]
    });
});

// ==========================================
// API 2: पूल सेटलमेंट और कमीशन (Protected)
// ==========================================
app.post('/api/v1/engine/pool/settle', verifyApiKey, (req, res) => {
    const { trades } = req.body;

    if (!trades || !Array.isArray(trades)) {
        return res.status(400).json({ 
            success: false, 
            message: "Invalid or missing trades data in request body." 
        });
    }

    let losersTotalMoney = 0;
    let winnersList = [];

    trades.forEach(trade => {
        if (trade.status === 'LOST') {
            losersTotalMoney += trade.amount;
        } else if (trade.status === 'WON') {
            winnersList.push(trade);
        }
    });

    let platformCommission = losersTotalMoney * 0.02;
    let availablePoolForWinners = losersTotalMoney - platformCommission;
    let totalWinnerStakes = winnersList.reduce((sum, t) => sum + t.amount, 0);

    winnersList.forEach(winner => {
        let profitShare = totalWinnerStakes > 0 ? (winner.amount / totalWinnerStakes) * availablePoolForWinners : 0;
        winner.payout = Number((winner.amount + profitShare).toFixed(2));
    });

    res.json({
        success: true,
        processedForClient: req.client.client_name,
        summary: {
            totalLosersPool: losersTotalMoney,
            platformCommission2Percent: Number(platformCommission.toFixed(2)),
            netPoolForWinners: Number(availablePoolForWinners.toFixed(2)),
            winnersPaidCount: winnersList.length
        },
        settledWinners: winnersList
    });
});

// सर्वर रन करना
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Database-backed B2B Trade Engine SaaS is running on port ${PORT}`);
});
