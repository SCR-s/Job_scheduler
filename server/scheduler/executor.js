const axios = require('axios');
const https = require('https');
const logger = require('../utils/logger');

/**
 * Execute a job by making an HTTP POST request
 */
async function executeJob(jobData, scheduledTime) {
  const startTime = Date.now();
  
  try {
    // Create axios instance with timeout and error handling
    const config = {
      timeout: 30000, // 30 second timeout
    };

    // Only use HTTPS agent for HTTPS URLs
    if (jobData.api_endpoint.startsWith('https://')) {
      config.httpsAgent = new https.Agent({
        rejectUnauthorized: false // Allow self-signed certificates for localhost
      });
    }

    const axiosInstance = axios.create(config);

    logger.info(`Executing job ${jobData.job_id} - POST ${jobData.api_endpoint}`);

    const response = await axiosInstance.post(jobData.api_endpoint, {
      jobId: jobData.job_id,
      scheduledTime: scheduledTime.toISOString(),
      executionTime: new Date().toISOString()
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const duration = Date.now() - startTime;

    return {
      status: response.status >= 200 && response.status < 300 ? 'success' : 'failed',
      httpStatus: response.status,
      responseBody: JSON.stringify(response.data).substring(0, 1000), // Limit response size
      duration
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    
    let httpStatus = null;
    let errorMessage = error.message;

    if (error.response) {
      // Server responded with error status
      httpStatus = error.response.status;
      errorMessage = `HTTP ${error.response.status}: ${error.response.statusText}`;
    } else if (error.request) {
      // Request made but no response
      errorMessage = 'No response from server';
    }

    logger.error(`Job ${jobData.job_id} execution failed:`, errorMessage);

    return {
      status: 'failed',
      httpStatus,
      error: errorMessage,
      duration
    };
  }
}

module.exports = {
  executeJob
};

