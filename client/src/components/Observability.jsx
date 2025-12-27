import React, { useState, useEffect } from 'react'
import { observabilityAPI } from '../services/api'

function Observability() {
  const [jobStats, setJobStats] = useState(null)
  const [executionStats, setExecutionStats] = useState(null)
  const [failures, setFailures] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [hours, setHours] = useState(24)

  useEffect(() => {
    loadStats()
  }, [hours])

  const loadStats = async () => {
    try {
      setLoading(true)
      const [jobStatsRes, executionStatsRes, failuresRes] = await Promise.all([
        observabilityAPI.getJobStats(),
        observabilityAPI.getExecutionStats(hours),
        observabilityAPI.getFailureAlerts(1)
      ])

      setJobStats(jobStatsRes.data)
      setExecutionStats(executionStatsRes.data)
      setFailures(failuresRes.data.failures)
      setError(null)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load statistics')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="loading">Loading statistics...</div>
  }

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2>System Observability</h2>
          <div>
            <label style={{ marginRight: '10px' }}>Time Range:</label>
            <select value={hours} onChange={(e) => setHours(parseInt(e.target.value))}>
              <option value={1}>Last Hour</option>
              <option value={24}>Last 24 Hours</option>
              <option value={168}>Last Week</option>
            </select>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {jobStats && (
          <div style={{ marginBottom: '30px' }}>
            <h3>Job Statistics</h3>
            <table className="table">
              <tbody>
                <tr>
                  <td><strong>Total Jobs</strong></td>
                  <td>{jobStats.total_jobs}</td>
                </tr>
                <tr>
                  <td><strong>Active Jobs</strong></td>
                  <td>{jobStats.active_jobs}</td>
                </tr>
                <tr>
                  <td><strong>Inactive Jobs</strong></td>
                  <td>{jobStats.inactive_jobs}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {executionStats && (
          <div style={{ marginBottom: '30px' }}>
            <h3>Execution Statistics (Last {hours} hours)</h3>
            <table className="table">
              <tbody>
                <tr>
                  <td><strong>Total Executions</strong></td>
                  <td>{executionStats.total_executions}</td>
                </tr>
                <tr>
                  <td><strong>Successful</strong></td>
                  <td>{executionStats.successful_executions}</td>
                </tr>
                <tr>
                  <td><strong>Failed</strong></td>
                  <td>{executionStats.failed_executions}</td>
                </tr>
                <tr>
                  <td><strong>Success Rate</strong></td>
                  <td>
                    {executionStats.total_executions > 0
                      ? ((executionStats.successful_executions / executionStats.total_executions) * 100).toFixed(2)
                      : 0}%
                  </td>
                </tr>
                <tr>
                  <td><strong>Avg Duration (ms)</strong></td>
                  <td>{Math.round(executionStats.avg_duration || 0)}</td>
                </tr>
                <tr>
                  <td><strong>Min Duration (ms)</strong></td>
                  <td>{Math.round(executionStats.min_duration || 0)}</td>
                </tr>
                <tr>
                  <td><strong>Max Duration (ms)</strong></td>
                  <td>{Math.round(executionStats.max_duration || 0)}</td>
                </tr>
                <tr>
                  <td><strong>Avg Schedule Drift (ms)</strong></td>
                  <td>{Math.round(executionStats.avg_drift_ms || 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h3>Failure Alerts (Last Hour)</h3>
        {failures.length === 0 ? (
          <p style={{ color: '#28a745' }}>✓ No failures in the last hour</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Job ID</th>
                <th>API Endpoint</th>
                <th>Failure Count</th>
                <th>Last Failure</th>
                <th>Latest Error</th>
              </tr>
            </thead>
            <tbody>
              {failures.map((failure, idx) => (
                <tr key={idx}>
                  <td>{failure.job_id.substring(0, 8)}...</td>
                  <td>{failure.api_endpoint}</td>
                  <td>
                    <span className="badge badge-danger">{failure.failure_count}</span>
                  </td>
                  <td>{new Date(failure.last_failure).toLocaleString()}</td>
                  <td style={{ color: '#dc3545', fontSize: '12px' }}>
                    {failure.latest_error || 'Unknown error'}
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

export default Observability

