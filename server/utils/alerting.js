const { pool } = require('../database/init');
const logger = require('../utils/logger');

/**
 * Check for job failures and alert
 * This can be extended to send emails, Slack notifications, etc.
 */
async function checkAndAlertFailures() {
  try {
    // Check for failures in the last hour
    const since = new Date(Date.now() - 3600000);
    
    const failures = await pool.query(`
      SELECT 
        e.job_id,
        j.api_endpoint,
        COUNT(*) as failure_count,
        MAX(e.execution_timestamp) as last_failure,
        MAX(e.error_message) as latest_error
      FROM executions e
      JOIN jobs j ON e.job_id = j.job_id
      WHERE e.status = 'failed' 
        AND e.execution_timestamp >= $1
        AND j.active = true
      GROUP BY e.job_id, j.api_endpoint
      HAVING COUNT(*) >= 1
    `, [since]);

    if (failures.rows.length > 0) {
      for (const failure of failures.rows) {
        logger.error(`ALERT: Job ${failure.job_id} has failed ${failure.failure_count} time(s). Last failure: ${failure.last_failure}. Error: ${failure.latest_error}`);
        
        // TODO: Extend this to send actual alerts (email, Slack, etc.)
        // Example:
        // await sendEmail({
        //   to: 'admin@example.com',
        //   subject: `Job Failure Alert: ${failure.job_id}`,
        //   body: `Job ${failure.job_id} has failed ${failure.failure_count} time(s)...`
        // });
      }
    }
  } catch (error) {
    logger.error('Error checking for failures:', error);
  }
}

// Run alert check every 5 minutes
setInterval(checkAndAlertFailures, 5 * 60 * 1000);

module.exports = {
  checkAndAlertFailures
};

