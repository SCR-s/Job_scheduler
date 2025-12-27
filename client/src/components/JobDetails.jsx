import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { jobsAPI, executionsAPI, observabilityAPI } from '../services/api'

function JobDetails() {
  const { jobId } = useParams()
  const navigate = useNavigate()
  const [job, setJob] = useState(null)
  const [executions, setExecutions] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [formData, setFormData] = useState({})

  useEffect(() => {
    loadJobData()
  }, [jobId])

  const loadJobData = async () => {
    try {
      setLoading(true)
      const [jobResponse, executionsResponse, statsResponse] = await Promise.all([
        jobsAPI.getById(jobId),
        executionsAPI.getByJobId(jobId, 5),
        observabilityAPI.getJobPerformance(jobId, 24).catch(() => null)
      ])

      setJob(jobResponse.data)
      setExecutions(executionsResponse.data.executions)
      setStats(statsResponse?.data)
      setFormData({
        schedule: jobResponse.data.schedule,
        api: jobResponse.data.api_endpoint,
        type: jobResponse.data.type,
        active: jobResponse.data.active
      })
      setError(null)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load job data')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    try {
      await jobsAPI.update(jobId, formData)
      setEditMode(false)
      loadJobData()
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update job')
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this job?')) {
      return
    }

    try {
      await jobsAPI.delete(jobId)
      navigate('/')
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete job')
    }
  }

  if (loading) {
    return <div className="loading">Loading job details...</div>
  }

  if (error || !job) {
    return (
      <div>
        <div className="alert alert-error">{error || 'Job not found'}</div>
        <Link to="/" className="btn btn-secondary">Back to Jobs</Link>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <Link to="/" className="btn btn-secondary">← Back to Jobs</Link>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2>Job Details</h2>
          <div>
            <button
              className="btn btn-secondary"
              onClick={() => setEditMode(!editMode)}
              style={{ marginRight: '10px' }}
            >
              {editMode ? 'Cancel Edit' : 'Edit'}
            </button>
            <button className="btn btn-danger" onClick={handleDelete}>
              Delete
            </button>
          </div>
        </div>

        {editMode ? (
          <form onSubmit={handleUpdate}>
            <div className="form-group">
              <label>Schedule</label>
              <input
                type="text"
                value={formData.schedule}
                onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>API Endpoint</label>
              <input
                type="url"
                value={formData.api}
                onChange={(e) => setFormData({ ...formData, api: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              >
                <option value="ATLEAST_ONCE">At Least Once</option>
              </select>
            </div>
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                />
                Active
              </label>
            </div>
            <button type="submit" className="btn btn-primary">Update Job</button>
          </form>
        ) : (
          <div>
            <table className="table" style={{ marginBottom: '20px' }}>
              <tbody>
                <tr>
                  <td><strong>Job ID</strong></td>
                  <td>{job.job_id}</td>
                </tr>
                <tr>
                  <td><strong>Schedule</strong></td>
                  <td><code>{job.schedule}</code></td>
                </tr>
                <tr>
                  <td><strong>API Endpoint</strong></td>
                  <td>{job.api_endpoint}</td>
                </tr>
                <tr>
                  <td><strong>Type</strong></td>
                  <td>{job.type}</td>
                </tr>
                <tr>
                  <td><strong>Status</strong></td>
                  <td>
                    <span className={`badge ${job.active ? 'badge-success' : 'badge-warning'}`}>
                      {job.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td><strong>Created</strong></td>
                  <td>{new Date(job.created_at).toLocaleString()}</td>
                </tr>
                <tr>
                  <td><strong>Updated</strong></td>
                  <td>{new Date(job.updated_at).toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {stats && (
        <div className="card">
          <h3>Performance Statistics (Last 24 Hours)</h3>
          <table className="table">
            <tbody>
              <tr>
                <td><strong>Total Executions</strong></td>
                <td>{stats.total_executions}</td>
              </tr>
              <tr>
                <td><strong>Successful</strong></td>
                <td>{stats.successful_executions}</td>
              </tr>
              <tr>
                <td><strong>Failed</strong></td>
                <td>{stats.failed_executions}</td>
              </tr>
              <tr>
                <td><strong>Avg Duration (ms)</strong></td>
                <td>{Math.round(stats.avg_duration || 0)}</td>
              </tr>
              <tr>
                <td><strong>Avg Schedule Drift (ms)</strong></td>
                <td>{Math.round(stats.avg_drift_ms || 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <h3>Recent Executions</h3>
        {executions.length === 0 ? (
          <p>No executions yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Execution Time</th>
                <th>Scheduled Time</th>
                <th>Status</th>
                <th>HTTP Status</th>
                <th>Duration (ms)</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {executions.map((exec, idx) => (
                <tr key={idx}>
                  <td>{new Date(exec.executionTimestamp).toLocaleString()}</td>
                  <td>{new Date(exec.scheduledTimestamp).toLocaleString()}</td>
                  <td>
                    <span className={`badge ${exec.status === 'success' ? 'badge-success' : 'badge-danger'}`}>
                      {exec.status}
                    </span>
                  </td>
                  <td>{exec.httpStatus || '-'}</td>
                  <td>{exec.executionDuration}</td>
                  <td style={{ color: '#dc3545', fontSize: '12px' }}>
                    {exec.errorMessage || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default JobDetails

