import React, { useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import JobsList from './components/JobsList'
import CreateJob from './components/CreateJob'
import JobDetails from './components/JobDetails'
import Observability from './components/Observability'
import './App.css'

function App() {
  return (
    <Router>
      <div className="app">
        <nav className="navbar">
          <div className="container">
            <h1 className="navbar-brand">Job Scheduler</h1>
            <div className="navbar-links">
              <Link to="/">Jobs</Link>
              <Link to="/create">Create Job</Link>
              <Link to="/observability">Observability</Link>
            </div>
          </div>
        </nav>
        <div className="container">
          <Routes>
            <Route path="/" element={<JobsList />} />
            <Route path="/create" element={<CreateJob />} />
            <Route path="/job/:jobId" element={<JobDetails />} />
            <Route path="/observability" element={<Observability />} />
          </Routes>
        </div>
      </div>
    </Router>
  )
}

export default App

