const mongoose = require('mongoose');

const state = {
  status: 'disconnected',
  host: null,
  name: null,
  readyState: 0,
  lastConnected: null,
  lastError: null,
  connectionAttempts: 0,
};

function getReadyStateLabel(readyState) {
  const labels = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return labels[readyState] || 'unknown';
}

function updateState() {
  const conn = mongoose.connection;
  state.readyState = conn.readyState;
  state.status = getReadyStateLabel(conn.readyState);
  state.host = conn.host || null;
  state.name = conn.name || null;
  if (conn.readyState === 1) {
    state.lastConnected = new Date().toISOString();
    state.lastError = null;
  }
}

mongoose.connection.on('connected', updateState);
mongoose.connection.on('disconnected', () => {
  updateState();
  state.status = 'disconnected';
});
mongoose.connection.on('error', (err) => {
  state.lastError = err.message;
  updateState();
});

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    state.lastError = 'MONGODB_URI is not set';
    state.status = 'misconfigured';
    console.error('[DB] MONGODB_URI environment variable is missing');
    return false;
  }

  state.connectionAttempts += 1;
  state.status = 'connecting';

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
    });
    updateState();
    console.log(`[DB] MongoDB connected → ${mongoose.connection.host}/${mongoose.connection.name}`);
    return true;
  } catch (err) {
    state.lastError = err.message;
    state.status = 'error';
    console.error('[DB] Connection failed:', err.message);
    return false;
  }
}

function getConnectionInfo() {
  updateState();
  return { ...state };
}

function isConnected() {
  return mongoose.connection.readyState === 1;
}

module.exports = { connectDB, getConnectionInfo, isConnected };
