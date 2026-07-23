const express = require('express');
const router = express.Router();

// आपके सभी ट्रेड इंजन से जुड़े रूट्स यहाँ आ सकते हैं
router.get('/assets', (req, res) => {
    res.json({ success: true, message: "Assets from modular file" });
});

module.exports = router;
