import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { jobsAPI } from '../services/api'

function CreateJob() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    schedule: '',
    api: '',
    type: 'ATLEAST_ONCE'
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
    setError(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const response = await jobsAPI.create(formData)
      setSuccess(true)
      setTimeout(() => {
        navigate(`/job/${response.data.jobId}`)
      }, 1500)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create job')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="card">
        <h2>Create New Job</h2>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">Job created successfully! Redirecting...</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="schedule">Schedule (CRON with seconds)</label>
            <input
              type="text"
              id="schedule"
              name="schedule"
              value={formData.schedule}
              onChange={handleChange}
              placeholder="31 10-15 1 * * MON-FRI"
              required
            />
            <small style={{ color: '#666', marginTop: '5px', display: 'block' }}>
              Format: second minute hour day month dayOfWeek
              <br />
              Example: "31 10-15 1 * * MON-FRI" (every 31st second of minutes 10-15 at 1 AM, Mon-Fri)
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="api">API Endpoint</label>
            <input
              type="url"
              id="api"
              name="api"
              value={formData.api}
              onChange={handleChange}
              placeholder="https://localhost:4444/foo"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="type">Execution Type</label>
            <select
              id="type"
              name="type"
              value={formData.type}
              onChange={handleChange}
            >
              <option value="ATLEAST_ONCE">At Least Once</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Job'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate('/')}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateJob

