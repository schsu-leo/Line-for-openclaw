const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { create, list } = require('../controllers/creditNotes.controller');

router.get('/', auth, list);
router.post('/', auth, create);

module.exports = router;
