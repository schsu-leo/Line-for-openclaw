const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  batchCreate,
  list,
  addReturn,
  lockInvoice,
  voidInvoice,
} = require('../controllers/shipments.controller');

router.use(auth);

router.get('/', list);
router.post('/batch', batchCreate);
router.post('/:id/returns', addReturn);
router.post('/:id/invoice', lockInvoice);
router.post('/:id/void-invoice', voidInvoice);

module.exports = router;
