const { pool } = require('../database/init');
const cronParser = require('../utils/cronParser');
const { executeJob } = require('./executor');
const logger = require('../utils/logger');
const { recordMetric } = require('../utils/metrics');

class JobScheduler {
  constructor() {
    this.jobs = new Map(); // jobId -> { parsed, jobData, nextExecution, intervalId }
    this.checkInterval = 100; // Check every 100ms for high precision
    this.isRunning = false;
    this.intervalId = null;
  }

  async loadJobs() {
    try {
      const result = await pool.query(
        'SELECT * FROM jobs WHERE active = true'
      );
      
      for (const job of result.rows) {
        await this.addJob(job);
      }
      
      logger.info(`Loaded ${result.rows.length} active jobs`);
    } catch (error) {
      logger.error('Error loading jobs:', error);
    }
  }

  async addJob(jobData) {
    try {
      const parsed = cronParser.parse(jobData.schedule);
      const now = new Date();
      
      let nextExecution;
      try {
        nextExecution = cronParser.getNextExecution(now, parsed);
      } catch (error) {
        // Job has no future executions
        logger.warn(`Job ${jobData.job_id} has no future executions. Marking as inactive.`);
        await this.markJobInactive(jobData.job_id);
        return; // Don't add to memory
      }

      // Double-check: if next execution is in the past, mark as inactive
      if (nextExecution <= now) {
        logger.warn(`Job ${jobData.job_id} next execution is in the past. Marking as inactive.`);
        await this.markJobInactive(jobData.job_id);
        return; // Don't add to memory
      }

      const jobEntry = {
        parsed,
        jobData,
        nextExecution,
        lastExecution: null
      };

      this.jobs.set(jobData.job_id, jobEntry);
      logger.info(`Job ${jobData.job_id} scheduled. Next execution: ${nextExecution.toISOString()}`);
    } catch (error) {
      logger.error(`Error adding job ${jobData.job_id}:`, error);
      throw error;
    }
  }

  async removeJob(jobId) {
    if (this.jobs.has(jobId)) {
      this.jobs.delete(jobId);
      logger.info(`Job ${jobId} removed from scheduler`);
    }
  }

  async updateJob(jobData) {
    await this.removeJob(jobData.job_id);
    if (jobData.active) {
      await this.addJob(jobData);
    }
  }

  start() {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    logger.info('Scheduler started');

    this.intervalId = setInterval(() => {
      this.checkAndExecute();
    }, this.checkInterval);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info('Scheduler stopped');
  }

  async checkAndExecute() {
    const now = new Date();
    const jobsToExecute = [];
    const expiredJobs = [];

    for (const [jobId, jobEntry] of this.jobs.entries()) {
      // Check if job has expired (nextExecution is in the past by more than tolerance)
      // This handles edge cases where nextExecution might be stale
      if (jobEntry.nextExecution < now - this.checkInterval) {
        expiredJobs.push({ jobId, jobEntry });
        continue;
      }

      // Check if it's time to execute (with 100ms tolerance)
      const timeDiff = Math.abs(now - jobEntry.nextExecution);
      if (timeDiff <= this.checkInterval) {
        jobsToExecute.push(jobEntry);
      }
    }

    // Handle expired jobs (mark as inactive and remove from memory)
    if (expiredJobs.length > 0) {
      await this.handleExpiredJobs(expiredJobs);
    }

    // Execute all due jobs in parallel
    if (jobsToExecute.length > 0) {
      const executions = jobsToExecute.map(jobEntry => this.executeAndReschedule(jobEntry));
      await Promise.allSettled(executions);
      recordMetric('jobs_executed', jobsToExecute.length);
    }
  }

  async executeAndReschedule(jobEntry) {
    const { jobData, parsed } = jobEntry;
    const scheduledTime = new Date(jobEntry.nextExecution);
    
    try {
      // Execute the job
      const startTime = Date.now();
      const result = await executeJob(jobData, scheduledTime);
      const duration = Date.now() - startTime;

      // Record execution
      await this.recordExecution(jobData.job_id, scheduledTime, result, duration);

      // Handle at-least-once semantics - reschedule immediately if needed
      if (jobData.type === 'ATLEAST_ONCE' && result.status === 'failed') {
        // For at-least-once, we might want to retry, but for now we just log
        logger.warn(`Job ${jobData.job_id} failed, but continuing with schedule`);
      }

      recordMetric('job_execution_duration', duration, { job_id: jobData.job_id });
      if (result.status === 'success') {
        recordMetric('job_success', 1, { job_id: jobData.job_id });
      } else {
        recordMetric('job_failure', 1, { job_id: jobData.job_id });
      }

    } catch (error) {
      logger.error(`Error executing job ${jobData.job_id}:`, error);
      await this.recordExecution(
        jobData.job_id,
        scheduledTime,
        { status: 'failed', error: error.message },
        Date.now() - scheduledTime.getTime()
      );
      recordMetric('job_failure', 1, { job_id: jobData.job_id });
    }

    // Reschedule for next execution
    try {
      const nextExecution = cronParser.getNextExecution(jobEntry.nextExecution, parsed);
      
      // Check if next execution is in the future
      const now = new Date();
      if (nextExecution <= now) {
        // Next execution is in the past or now - job has no more future executions
        logger.warn(`Job ${jobData.job_id} has no more future executions. Marking as inactive.`);
        await this.markJobInactive(jobData.job_id);
        this.jobs.delete(jobData.job_id);
        return;
      }
      
      jobEntry.nextExecution = nextExecution;
      jobEntry.lastExecution = scheduledTime;
    } catch (error) {
      logger.error(`Error rescheduling job ${jobData.job_id}: ${error.message}`);
      // Job has no future executions - mark as inactive and remove from memory
      logger.info(`Job ${jobData.job_id} cannot be rescheduled. Marking as inactive.`);
      await this.markJobInactive(jobData.job_id);
      this.jobs.delete(jobData.job_id);
    }
  }

  /**
   * Handle expired jobs (jobs with nextExecution in the past)
   */
  async handleExpiredJobs(expiredJobs) {
    for (const { jobId, jobEntry } of expiredJobs) {
      try {
        // Try to find next execution from current time
        const now = new Date();
        const nextExecution = cronParser.getNextExecution(now, jobEntry.parsed);
        
        // If next execution is in the future, update it
        if (nextExecution > now) {
          jobEntry.nextExecution = nextExecution;
          logger.info(`Job ${jobId} rescheduled. New execution: ${nextExecution.toISOString()}`);
        } else {
          // No future executions - mark as inactive
          logger.warn(`Job ${jobId} has no future executions. Marking as inactive.`);
          await this.markJobInactive(jobId);
          this.jobs.delete(jobId);
        }
      } catch (error) {
        // Cannot find next execution - mark as inactive
        logger.warn(`Job ${jobId} cannot be rescheduled: ${error.message}. Marking as inactive.`);
        await this.markJobInactive(jobId);
        this.jobs.delete(jobId);
      }
    }
  }

  /**
   * Mark a job as inactive in the database
   */
  async markJobInactive(jobId) {
    try {
      await pool.query(
        'UPDATE jobs SET active = false, updated_at = CURRENT_TIMESTAMP WHERE job_id = $1',
        [jobId]
      );
      logger.info(`Job ${jobId} marked as inactive in database`);
      recordMetric('job_auto_inactivated', 1, { job_id: jobId });
    } catch (error) {
      logger.error(`Error marking job ${jobId} as inactive:`, error);
    }
  }

  async recordExecution(jobId, scheduledTime, result, duration) {
    try {
      await pool.query(
        `INSERT INTO executions 
         (job_id, execution_timestamp, scheduled_timestamp, http_status, execution_duration, response_body, error_message, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          jobId,
          new Date(),
          scheduledTime,
          result.httpStatus || null,
          duration,
          result.responseBody || null,
          result.error || null,
          result.status
        ]
      );
    } catch (error) {
      logger.error(`Error recording execution for job ${jobId}:`, error);
    }
  }
}

const scheduler = new JobScheduler();

async function startScheduler() {
  await scheduler.loadJobs();
  scheduler.start();
}

module.exports = {
  scheduler,
  startScheduler
};

