require('dotenv').config();
const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');

const tripRoutes  = require('./routes/trips');
const statsRoutes = require('./routes/stats');
const userRoutes  = require('./routes/users');

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/trips', tripRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/users', userRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Travel Tracker API is running' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

const PORT        = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

// MongoDB Keepalive function (prevents Atlas free-tier pause)
const keepalivePing = async () => {
  try {
    const adminDb = mongoose.connection.db || (await mongoose.connection);
    await adminDb.admin().ping();
    console.log('🔄 Atlas keepalive ping sent');
  } catch (err) {
    console.warn('⚠️ Keepalive ping failed (normal if local DB):', err.message);
  }
};

// Start periodic pings (every 12 hours = 43,200,000 ms)
const startKeepalive = () => {
  keepalivePing(); // Initial ping
  setInterval(keepalivePing, 12 * 60 * 60 * 1000); // Every 12 hours
  console.log('⏰ Atlas keepalive started (pings every 12h)');
};

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    startKeepalive(); // Start pings after connection
    app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Shutting down gracefully');
  mongoose.connection.close(() => process.exit(0));
});