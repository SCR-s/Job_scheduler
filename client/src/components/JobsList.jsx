import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { jobsAPI } from '../services/api'

function JobsList() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadJobs()
  }, [])

  const loadJobs = async () => {
    try {
      setLoading(true)
      const response = await jobsAPI.getAll()
      setJobs(response.data.jobs)
      setError(null)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load jobs')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (jobId) => {
    if (!window.confirm('Are you sure you want to delete this job?')) {
      return
    }

    try {
      await jobsAPI.delete(jobId)
      loadJobs()
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete job')
    }
  }

  const toggleActive = async (job) => {
    try {
      await jobsAPI.update(job.job_id, { active: !job.active })
      loadJobs()
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update job')
    }
  }

  if (loading) {
    return <div className="loading">Loading jobs...</div>
  }

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2>Jobs</h2>
          <Link to="/create" className="btn btn-primary">Create New Job</Link>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {jobs.length === 0 ? (
          <p>No jobs found. Create your first job to get started.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Job ID</th>
                <th>Schedule</th>
                <th>API Endpoint</th>
                <th>Type</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.job_id}>
                  <td>
                    <Link to={`/job/${job.job_id}`} style={{ color: '#007bff', textDecoration: 'none' }}>
                      {job.job_id.substring(0, 8)}...
                    </Link>
                  </td>
                  <td><code>{job.schedule}</code></td>
                  <td>{job.api_endpoint}</td>
                  <td>{job.type}</td>
                  <td>
                    <span className={`badge ${job.active ? 'badge-success' : 'badge-warning'}`}>
                      {job.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>{new Date(job.created_at).toLocaleString()}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <Link to={`/job/${job.job_id}`} className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: '12px' }}>
                        View
                      </Link>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '5px 10px', fontSize: '12px' }}
                        onClick={() => toggleActive(job)}
                      >
                        {job.active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        className="btn btn-danger"
                        style={{ padding: '5px 10px', fontSize: '12px' }}
                        onClick={() => handleDelete(job.job_id)}
                      >
                        Delete
                      </button>
                    </div>
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

export default JobsList

