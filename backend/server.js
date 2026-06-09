require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

require('./config/validateEnv').validateEnv();
require('./config/db');

const { PORT, NODE_ENV } = require('./config/env');
const { getLanIPv4 } = require('./utils/network.utils');

const app = express();

app.disable('x-powered-by');

app.use((req, res, next) => {
  const reqId = req.headers['x-request-id'] || crypto.randomUUID();
  const startedAt = process.hrtime.bigint();
  req.requestId = reqId;
  res.setHeader('x-request-id', reqId);
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('x-frame-options', 'SAMEORIGIN');
  res.setHeader('referrer-policy', 'strict-origin-when-cross-origin');
  res.setHeader('permissions-policy', 'geolocation=(), microphone=(), camera=()');
  res.on('finish', () => {
    const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    if (req.path.startsWith('/api')) {
      console.log(`[API] ${req.method} ${req.path} ${res.statusCode} ${elapsedMs.toFixed(1)}ms rid=${reqId}`);
    }
  });
  next();
});

app.use(cors({
  origin: NODE_ENV === 'production' ? false : '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use(express.static(path.join(__dirname, '../views')));

const apiRouter = require('./routes/index');
app.use('/api', apiRouter);

setImmediate(() => {
  try {
    const labAi = require('./ai/labAi');
    if (!labAi.isModelReady()) {
      const r = labAi.ensureTrained();
      console.log(`[AI] Model sẵn sàng (${r.source || 'cache'})`);
    }
  } catch (err) {
    console.warn('[AI] Không preload model:', err.message);
  }
});

app.get('/api/health', (req, res) => {
  return res.json({
    success: true,
    data: {
      status: 'ok',
      uptime_seconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      env: NODE_ENV
    }
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/index.html'));
});

app.get('/pages/*', (req, res) => {
  const requestedPath = req.params[0];
  res.sendFile(path.join(__dirname, '../views/pages', requestedPath), (err) => {
    if (err) res.status(404).json({ success: false, message: 'Page not found' });
  });
});

app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
  }
  res.sendFile(path.join(__dirname, '../views/index.html'));
});

app.use((err, req, res, next) => {
  console.error(`❌ [${new Date().toISOString()}] ${err.stack}`);

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, message: 'File quá lớn. Giới hạn 5MB.' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ success: false, message: 'Request body quá lớn.' });
  }

  res.status(err.status || 500).json({
    success: false,
    message: NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

app.listen(PORT, () => {
  const lan = getLanIPv4();
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📱 LAN (điện thoại cùng WiFi): http://${lan}:${PORT}`);
  console.log(`🌐 Landing page: http://localhost:${PORT}/`);
  console.log(`📡 API base:     http://localhost:${PORT}/api`);
  console.log(`📁 Uploads:      http://localhost:${PORT}/uploads`);
  console.log(`🔧 Environment:  ${NODE_ENV}`);
});

module.exports = app;