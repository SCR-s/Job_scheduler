require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jobRoutes = require('./routes/jobs');
const executionRoutes = require('./routes/executions');
const observabilityRoutes = require('./routes/observability');
const { initializeDatabase } = require('./database/init');
const { startScheduler } = require('./scheduler/scheduler');
const logger = require('./utils/logger');
require('./utils/alerting'); // Initialize alerting system

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/jobs', jobRoutes);
app.use('/api/executions', executionRoutes);
app.use('/api/observability', observabilityRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files from the React app (only in production)
if (process.env.NODE_ENV === 'production') {
  const path = require('path');
  // Serve static files from the client/dist directory
  app.use(express.static(path.join(__dirname, '../client/dist')));
  
  // Catch-all handler: send back React's index.html file for client-side routing
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// Initialize database and start scheduler
async function startServer() {
  try {
    await initializeDatabase();
    logger.info('Database initialized successfully');
    
    await startScheduler();
    logger.info('Scheduler started successfully');
    
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

