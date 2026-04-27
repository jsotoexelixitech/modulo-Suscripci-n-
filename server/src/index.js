try {
  require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
} catch (_) {
  // dotenv is optional; environment variables can also be injected by the host
}

const express = require('express');
const cors = require('cors');
const path = require('path');
const uploadRoutes = require('./routes/upload');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

const defaultOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
];
const corsOrigins = (process.env.CORS_ORIGINS || defaultOrigins.join(','))
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({ origin: corsOrigins }));
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '1mb' }));

app.use('/files', express.static(path.join(__dirname, '../uploads')));

app.use('/api', uploadRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    env: NODE_ENV,
    time: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`\nRCV Server [${NODE_ENV}] running at http://localhost:${PORT}\n`);
});
