const { pool } = require('../database/init');
const logger = require('./logger');

/**
 * Record a metric for observability
 */
async function recordMetric(name, value, tags = {}) {
  try {
    await pool.query(
      'INSERT INTO metrics (metric_name, metric_value, tags) VALUES ($1, $2, $3)',
      [name, value, JSON.stringify(tags)]
    );
  } catch (error) {
    // Don't log metrics errors to avoid infinite loops
    // logger.error('Error recording metric:', error);
  }
}

/**
 * Get metrics for a time range
 */
async function getMetrics(metricName, startTime, endTime) {
  try {
    const result = await pool.query(
      `SELECT metric_name, metric_value, tags, timestamp 
       FROM metrics 
       WHERE metric_name = $1 AND timestamp BETWEEN $2 AND $3 
       ORDER BY timestamp DESC 
       LIMIT 1000`,
      [metricName, startTime, endTime]
    );
    return result.rows;
  } catch (error) {
    logger.error('Error getting metrics:', error);
    throw error;
  }
}

/**
 * Get aggregated metrics
 */
async function getAggregatedMetrics(metricName, startTime, endTime) {
  try {
    const result = await pool.query(
      `SELECT 
         COUNT(*) as count,
         AVG(metric_value) as avg_value,
         MIN(metric_value) as min_value,
         MAX(metric_value) as max_value,
         SUM(CASE WHEN tags->>'job_id' IS NOT NULL THEN 1 ELSE 0 END) as job_specific_count
       FROM metrics 
       WHERE metric_name = $1 AND timestamp BETWEEN $2 AND $3`,
      [metricName, startTime, endTime]
    );
    return result.rows[0];
  } catch (error) {
    logger.error('Error getting aggregated metrics:', error);
    throw error;
  }
}

module.exports = {
  recordMetric,
  getMetrics,
  getAggregatedMetrics
};

