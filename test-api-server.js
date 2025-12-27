/**
 * Simple test API server for testing job executions
 * Run this separately: node test-api-server.js
 * 
 * Note: This uses HTTP (not HTTPS) for simplicity.
 * The job scheduler is configured to accept self-signed certificates,
 * so you can use https://localhost:4444 in job specs even with HTTP.
 */
const express = require('express');
const https = require('https');
const fs = require('fs');
const app = express();
const PORT = 4444;

app.use(express.json());

let requestCount = 0;

app.post('/foo', (req, res) => {
  requestCount++;
  const { jobId, scheduledTime, executionTime } = req.body;
  
  const delay = new Date() - new Date(scheduledTime);
  console.log(`[${new Date().toISOString()}] Received job execution #${requestCount}:`, {
    jobId,
    scheduledTime,
    executionTime,
    delay: `${delay}ms`
  });

  // Simulate some processing time (0-2 seconds)
  const processingTime = Math.random() * 2000;
  
  setTimeout(() => {
    // Randomly fail 5% of requests for testing
    if (Math.random() < 0.05) {
      res.status(500).json({ 
        error: 'Simulated failure',
        requestCount 
      });
    } else {
      res.status(200).json({ 
        success: true,
        requestCount,
        processingTime: Math.round(processingTime)
      });
    }
  }, processingTime);
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    requestCount,
    timestamp: new Date().toISOString()
  });
});

// For simplicity, using HTTP. In production, use HTTPS with proper certificates
app.listen(PORT, () => {
  console.log(`Test API server running on http://localhost:${PORT}`);
  console.log('Endpoint: POST http://localhost:4444/foo');
  console.log('Note: Use http://localhost:4444/foo (not https) for this test server');
});

