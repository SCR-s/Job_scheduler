const express = require('express');
const { pool } = require('../database/init');
const { getMetrics, getAggregatedMetrics } = require('../utils/metrics');
const logger = require('../utils/logger');

const router = express.Router();

// Get system metrics
router.get('/metrics', async (req, res, next) => {
  try {
    const { metricName, startTime, endTime } = req.query;
    const start = startTime ? new Date(startTime) : new Date(Date.now() - 3600000); // Default: last hour
    const end = endTime ? new Date(endTime) : new Date();

    if (!metricName) {
      return res.status(400).json({ error: 'metricName query parameter is required' });
    }

    const metrics = await getMetrics(metricName, start, end);
    const aggregated = await getAggregatedMetrics(metricName, start, end);

    res.json({
      metricName,
      timeRange: { start, end },
      dataPoints: metrics,
      aggregated
    });
  } catch (error) {
    logger.error('Error fetching metrics:', error);
    next(error);
  }
});

// Get job statistics
router.get('/stats/jobs', async (req, res, next) => {
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_jobs,
        COUNT(*) FILTER (WHERE active = true) as active_jobs,
        COUNT(*) FILTER (WHERE active = false) as inactive_jobs
      FROM jobs
    `);

    res.json(stats.rows[0]);
  } catch (error) {
    logger.error('Error fetching job stats:', error);
    next(error);
  }
});

// Get execution statistics
router.get('/stats/executions', async (req, res, next) => {
  try {
    const { hours = 24 } = req.query;
    const since = new Date(Date.now() - hours * 3600000);

    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_executions,
        COUNT(*) FILTER (WHERE status = 'success') as successful_executions,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_executions,
        AVG(execution_duration) as avg_duration,
        MIN(execution_duration) as min_duration,
        MAX(execution_duration) as max_duration,
        AVG(EXTRACT(EPOCH FROM (execution_timestamp - scheduled_timestamp)) * 1000) as avg_drift_ms
      FROM executions
      WHERE execution_timestamp >= $1
    `, [since]);

    res.json({
      timeRange: { since, hours: parseInt(hours) },
      ...stats.rows[0]
    });
  } catch (error) {
    logger.error('Error fetching execution stats:', error);
    next(error);
  }
});

// Get failed jobs (for alerting)
router.get('/alerts/failures', async (req, res, next) => {
  try {
    const { hours = 1 } = req.query;
    const since = new Date(Date.now() - hours * 3600000);

    const failures = await pool.query(`
      SELECT 
        e.job_id,
        j.api_endpoint,
        COUNT(*) as failure_count,
        MAX(e.execution_timestamp) as last_failure,
        MAX(e.error_message) as latest_error
      FROM executions e
      JOIN jobs j ON e.job_id = j.job_id
      WHERE e.status = 'failed' AND e.execution_timestamp >= $1
      GROUP BY e.job_id, j.api_endpoint
      ORDER BY failure_count DESC, last_failure DESC
    `, [since]);

    res.json({
      timeRange: { since, hours: parseInt(hours) },
      failures: failures.rows
    });
  } catch (error) {
    logger.error('Error fetching failure alerts:', error);
    next(error);
  }
});

// Get job performance metrics
router.get('/stats/job/:jobId', async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const { hours = 24 } = req.query;
    const since = new Date(Date.now() - hours * 3600000);

    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_executions,
        COUNT(*) FILTER (WHERE status = 'success') as successful_executions,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_executions,
        AVG(execution_duration) as avg_duration,
        MIN(execution_duration) as min_duration,
        MAX(execution_duration) as max_duration,
        AVG(EXTRACT(EPOCH FROM (execution_timestamp - scheduled_timestamp)) * 1000) as avg_drift_ms
      FROM executions
      WHERE job_id = $1 AND execution_timestamp >= $2
    `, [jobId, since]);

    if (stats.rows[0].total_executions === '0') {
      return res.status(404).json({ error: 'No executions found for this job in the specified time range' });
    }

    res.json({
      jobId,
      timeRange: { since, hours: parseInt(hours) },
      ...stats.rows[0]
    });
  } catch (error) {
    logger.error('Error fetching job stats:', error);
    next(error);
  }
});

module.exports = router;

