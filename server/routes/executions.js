const express = require('express');
const { pool } = require('../database/init');
const logger = require('../utils/logger');
const { recordMetric } = require('../utils/metrics');

const router = express.Router();

// Get executions for a job (last 5 by default)
router.get('/:jobId', async (req, res, next) => {
  const startTime = Date.now();
  try {
    const { jobId } = req.params;
    const limit = parseInt(req.query.limit) || 5;

    // Verify job exists
    const jobCheck = await pool.query(
      'SELECT job_id FROM jobs WHERE job_id = $1',
      [jobId]
    );

    if (jobCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const result = await pool.query(
      `SELECT 
         execution_timestamp,
         scheduled_timestamp,
         http_status,
         execution_duration,
         status,
         error_message,
         response_body
       FROM executions 
       WHERE job_id = $1 
       ORDER BY execution_timestamp DESC 
       LIMIT $2`,
      [jobId, limit]
    );

    const executions = result.rows.map(row => ({
      executionTimestamp: row.execution_timestamp,
      scheduledTimestamp: row.scheduled_timestamp,
      httpStatus: row.http_status,
      executionDuration: row.execution_duration,
      status: row.status,
      errorMessage: row.error_message,
      responseBody: row.response_body ? JSON.parse(row.response_body) : null
    }));

    recordMetric('api_latency', Date.now() - startTime, { endpoint: 'get_executions' });

    res.json({
      jobId,
      executions,
      count: executions.length
    });
  } catch (error) {
    logger.error('Error fetching executions:', error);
    next(error);
  }
});

// Get all executions with pagination
router.get('/', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const jobId = req.query.jobId;

    let query = `
      SELECT 
        e.job_id,
        e.execution_timestamp,
        e.scheduled_timestamp,
        e.http_status,
        e.execution_duration,
        e.status,
        e.error_message
      FROM executions e
    `;
    const params = [];
    let paramCount = 1;

    if (jobId) {
      query += ` WHERE e.job_id = $${paramCount++}`;
      params.push(jobId);
    }

    query += ` ORDER BY e.execution_timestamp DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    res.json({
      executions: result.rows,
      limit,
      offset,
      count: result.rows.length
    });
  } catch (error) {
    logger.error('Error fetching executions:', error);
    next(error);
  }
});

module.exports = router;

