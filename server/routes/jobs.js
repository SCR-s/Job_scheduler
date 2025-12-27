const express = require('express');
const { pool } = require('../database/init');
const { scheduler } = require('../scheduler/scheduler');
const cronParser = require('../utils/cronParser');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { recordMetric } = require('../utils/metrics');

const router = express.Router();

// Create a new job
router.post('/', async (req, res, next) => {
  const startTime = Date.now();
  try {
    const { schedule, api, type = 'ATLEAST_ONCE' } = req.body;

    if (!schedule || !api) {
      return res.status(400).json({
        error: 'Missing required fields: schedule and api are required'
      });
    }

    // Validate CRON expression
    try {
      cronParser.parse(schedule);
    } catch (error) {
      return res.status(400).json({
        error: `Invalid schedule format: ${error.message}`
      });
    }

    // Validate API endpoint
    try {
      new URL(api);
    } catch (error) {
      return res.status(400).json({
        error: 'Invalid API endpoint URL'
      });
    }

    const jobId = uuidv4();

    // Insert job into database
    const result = await pool.query(
      `INSERT INTO jobs (job_id, schedule, api_endpoint, type, active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [jobId, schedule, api, type, true]
    );

    const job = result.rows[0];

    // Add to scheduler
    await scheduler.addJob(job);

    recordMetric('api_latency', Date.now() - startTime, { endpoint: 'create_job' });
    recordMetric('job_created', 1);

    logger.info(`Job created: ${jobId}`);

    res.status(201).json({
      jobId: job.job_id,
      schedule: job.schedule,
      api: job.api_endpoint,
      type: job.type,
      createdAt: job.created_at
    });
  } catch (error) {
    logger.error('Error creating job:', error);
    next(error);
  }
});

// Get all jobs
router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT job_id, schedule, api_endpoint, type, active, created_at, updated_at FROM jobs ORDER BY created_at DESC'
    );

    res.json({
      jobs: result.rows
    });
  } catch (error) {
    logger.error('Error fetching jobs:', error);
    next(error);
  }
});

// Get a specific job
router.get('/:jobId', async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const result = await pool.query(
      'SELECT * FROM jobs WHERE job_id = $1',
      [jobId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error fetching job:', error);
    next(error);
  }
});

// Update a job
router.put('/:jobId', async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const { schedule, api, type, active } = req.body;

    // Check if job exists
    const existingJob = await pool.query(
      'SELECT * FROM jobs WHERE job_id = $1',
      [jobId]
    );

    if (existingJob.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;

    if (schedule !== undefined) {
      // Validate CRON expression
      try {
        cronParser.parse(schedule);
      } catch (error) {
        return res.status(400).json({
          error: `Invalid schedule format: ${error.message}`
        });
      }
      updateFields.push(`schedule = $${paramCount++}`);
      updateValues.push(schedule);
    }

    if (api !== undefined) {
      try {
        new URL(api);
      } catch (error) {
        return res.status(400).json({
          error: 'Invalid API endpoint URL'
        });
      }
      updateFields.push(`api_endpoint = $${paramCount++}`);
      updateValues.push(api);
    }

    if (type !== undefined) {
      updateFields.push(`type = $${paramCount++}`);
      updateValues.push(type);
    }

    if (active !== undefined) {
      updateFields.push(`active = $${paramCount++}`);
      updateValues.push(active);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    updateValues.push(jobId);

    const query = `
      UPDATE jobs 
      SET ${updateFields.join(', ')}
      WHERE job_id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, updateValues);
    const updatedJob = result.rows[0];

    // Update scheduler
    await scheduler.updateJob(updatedJob);

    recordMetric('job_updated', 1);
    logger.info(`Job updated: ${jobId}`);

    res.json(updatedJob);
  } catch (error) {
    logger.error('Error updating job:', error);
    next(error);
  }
});

// Delete a job
router.delete('/:jobId', async (req, res, next) => {
  try {
    const { jobId } = req.params;

    const result = await pool.query(
      'DELETE FROM jobs WHERE job_id = $1 RETURNING *',
      [jobId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Remove from scheduler
    await scheduler.removeJob(jobId);

    recordMetric('job_deleted', 1);
    logger.info(`Job deleted: ${jobId}`);

    res.json({ message: 'Job deleted successfully', jobId });
  } catch (error) {
    logger.error('Error deleting job:', error);
    next(error);
  }
});

module.exports = router;

