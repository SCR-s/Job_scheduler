import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

export const jobsAPI = {
  getAll: () => api.get('/jobs'),
  getById: (jobId) => api.get(`/jobs/${jobId}`),
  create: (jobData) => api.post('/jobs', jobData),
  update: (jobId, jobData) => api.put(`/jobs/${jobId}`, jobData),
  delete: (jobId) => api.delete(`/jobs/${jobId}`)
}

export const executionsAPI = {
  getByJobId: (jobId, limit = 5) => api.get(`/executions/${jobId}?limit=${limit}`),
  getAll: (params) => api.get('/executions', { params })
}

export const observabilityAPI = {
  getMetrics: (params) => api.get('/observability/metrics', { params }),
  getJobStats: () => api.get('/observability/stats/jobs'),
  getExecutionStats: (hours = 24) => api.get(`/observability/stats/executions?hours=${hours}`),
  getFailureAlerts: (hours = 1) => api.get(`/observability/alerts/failures?hours=${hours}`),
  getJobPerformance: (jobId, hours = 24) => api.get(`/observability/stats/job/${jobId}?hours=${hours}`)
}

export default api

