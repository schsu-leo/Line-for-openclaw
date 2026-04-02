const express = require('express');
const router = express.Router();
const { processDeliveryPdf, getDropdownOptions } = require('../services/deliveryPdf.service');

// 記憶體 job queue（重啟後清空，足夠日常使用）
const jobs = {};

// GET /api/delivery-pdf/options
// 回傳可選日期和車次（供 GAS 下拉選單使用）
router.get('/options', async (req, res) => {
  try {
    const date = req.query.date || null;
    const options = await getDropdownOptions(date);
    res.json(options);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/delivery-pdf/start
// 啟動 PDF 生成任務，立即回傳 jobId
router.post('/start', async (req, res) => {
  const { date, vehicles, customers } = req.body;
  const hasVehicles  = Array.isArray(vehicles)  && vehicles.length > 0;
  const hasCustomers = Array.isArray(customers) && customers.length > 0;
  if (!date || (!hasVehicles && !hasCustomers)) {
    return res.status(400).json({ error: '需要 date 以及 vehicles 或 customers 參數' });
  }

  const jobId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  jobs[jobId] = { status: 'queued', date, vehicles, customers, startedAt: new Date().toISOString() };

  res.json({ jobId });

  // 非同步背景執行
  processDeliveryPdf(jobId, date, vehicles || [], jobs, customers || []);
});

// GET /api/delivery-pdf/status/:jobId
// 查詢任務狀態
router.get('/status/:jobId', (req, res) => {
  const job = jobs[req.params.jobId];
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

module.exports = router;
