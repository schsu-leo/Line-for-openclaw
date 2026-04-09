const express = require('express');
const router = express.Router();
const { status, initialize } = require('../controllers/setup.controller');
const auth = require('../middleware/auth');

// No auth — must be accessible before first login
router.get('/status', status);

// P1-1: 只有 admin 可執行初始化
router.post('/initialize', auth, auth.requireAdmin, initialize);

module.exports = router;
