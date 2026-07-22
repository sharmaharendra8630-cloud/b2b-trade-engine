const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const app = express();

// मिडलवेयर (Middleware)
app.use(express.json());
app.use(cors());



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
