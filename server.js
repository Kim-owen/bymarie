const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const config = require('./lib/config');
const { autoSeedSupabase } = require('./lib/seed');

const app = express();
const PORT = config.PORT;

process.on('uncaughtException', (err) => {
  console.error('⚠️ Uncaught Exception:', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.warn('⚠️ Unhandled Rejection:', reason ? (reason.message || reason) : 'Unknown reason');
});

// Enable CORS & JSON parsing
app.use(cors());
// Captures the raw request body alongside Express's normal JSON parsing --
// the Paystack webhook needs the exact raw bytes to verify its HMAC-SHA512
// signature (lib/paystack.js#verifyWebhookSignature), which the parsed
// object can't reconstruct byte-for-byte.
app.use(express.json({
  limit: '50mb',
  verify: (req, res, buf) => { req.rawBody = buf; }
}));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Dedicated High-Performance Byte-Range Video Streaming Endpoint
app.get('/uploads/:filename', (req, res) => {
  const fname = req.params.filename;
  const localPath = path.join(__dirname, 'uploads', fname);
  const tmpPath = path.join('/tmp', 'uploads', fname);
  let filePath = null;

  if (fs.existsSync(localPath)) filePath = localPath;
  else if (fs.existsSync(tmpPath)) filePath = tmpPath;

  if (!filePath) {
    return res.status(404).send('File not found');
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;
  const isMov = fname.toLowerCase().endsWith('.mov');
  const contentType = isMov ? 'video/quicktime' : 'video/mp4';

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(filePath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType,
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes'
    };
    res.writeHead(200, head);
    fs.createReadStream(filePath).pipe(res);
  }
});

// Serve static uploaded files & root static assets (index.html, styles.css, app.js)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
if (config.isVercel) {
  app.use('/uploads', express.static('/tmp/uploads'));
}
app.use(express.static(__dirname));

// Root storefront route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ===================================================
// REST API ROUTES
// ===================================================
const apiRouters = [
  require('./routes/misc'),
  require('./routes/products'),
  require('./routes/orders'),
  require('./routes/coupons'),
  require('./routes/users'),
  require('./routes/wholesale'),
  require('./routes/campaigns'),
  require('./routes/settings'),
  require('./routes/payments'),
  require('./routes/upload')
];

apiRouters.forEach(routerModule => {
  app.use('/api', routerModule);
  app.use('/', routerModule);
});

app.use('/api/auth', require('./routes/auth'));
app.use('/auth', require('./routes/auth'));

// Global Centralized Error Handler (Catches all runtime errors -- including
// DbError from lib/store.js when a Supabase read/write fails -- and returns
// clean JSON instead of leaking a stack trace or silently succeeding)
app.use((err, req, res, next) => {
  console.error('Server Runtime Error:', err.message);
  if (res.headersSent) {
    return next(err);
  }
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    code: err.code || 'INTERNAL_ERROR'
  });
});

// Start Server & Run Auto-Seed (Only when executed directly)
if (require.main === module) {
  app.listen(PORT, async () => {
    console.log(`===================================================`);
    console.log(`BYMARIE REST API SERVER IS RUNNING ON PORT ${PORT}`);
    console.log(`API Base: http://localhost:${PORT}/api`);
    console.log(`Health Check: http://localhost:${PORT}/api/health`);
    console.log(`Paystack Gateway: Active ⚡`);
    console.log(`===================================================`);

    await autoSeedSupabase();
  });
}

module.exports = app;
