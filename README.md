# High-Throughput Job Scheduler

A scalable job scheduler system capable of executing thousands of scheduled jobs per second with high accuracy and reliability.

## Features

- Create, modify, and delete jobs
- View job execution history
- Alert on job failures
- High-throughput execution (thousands of jobs/second)
- Extended CRON scheduling with seconds support
- At-least-once execution semantics
- Comprehensive observability and metrics
- Modern React frontend with Vite
- PostgreSQL persistence

## Tech Stack

Backend
- Node.js + Express.js- REST API server
- PostgreSQL - Data persistence
- Winston - Logging
- Custom high-precision scheduler

### Frontend
- React- UI framework
- Vite - Build tool
- Axios - HTTP client

## Project Structure

```
Job_scheduler/
├── server/
│   ├── index.js              # Main server entry point
│   ├── database/
│   │   └── init.js           # Database initialization
│   ├── scheduler/
│   │   ├── scheduler.js      # Core scheduler engine
│   │   └── executor.js       # Job execution logic
│   ├── routes/
│   │   ├── jobs.js           # Job CRUD APIs
│   │   ├── executions.js     # Execution history APIs
│   │   └── observability.js  # Metrics and stats APIs
│   └── utils/
│       ├── cronParser.js     # CRON expression parser
│       ├── logger.js         # Logging configuration
│       ├── metrics.js         # Metrics recording
│       └── alerting.js      # Failure alerting
├── client/
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── services/         # API client
│   │   └── App.jsx          # Main app component
│   └── vite.config.js        # Vite configuration
└── package.json

```

## Setup Instructions

### Prerequisites
- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

### Installation

1. **Clone and install dependencies:**
   ```bash
   npm run install-all
   ```

2. **Set up PostgreSQL database:**
   ```sql
   CREATE DATABASE job_scheduler;
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

4. **Start the application:**
   ```bash
   npm run dev
   ```

   This will start:
   - Backend server on `http://localhost:3001`
   - Frontend dev server on `http://localhost:3000`

## Docker Setup

### Prerequisites
- Docker
- Docker Compose

### Running with Docker Compose

1. Build and start all services:
   ```bash
   docker compose up -d
   ```

2. View logs:
   ```bash
   docker compose logs -f
   ```

3. Stop all services:
   ```bash
   docker compose down
   ```

4. Stop and remove volumes (clears database data):
   ```bash
   docker compose down -v
   ```

The application will be available at http://localhost:3001

The docker-compose.yaml file includes:
- Server container with Node.js application
- PostgreSQL database container
- Automatic database initialization
- Health checks to ensure services start in correct order

Database credentials are set in docker-compose.yaml. For production, use environment variables or secrets management.

## API Endpoints

### Jobs
- `POST /api/jobs` - Create a new job
- `GET /api/jobs` - Get all jobs
- `GET /api/jobs/:jobId` - Get a specific job
- `PUT /api/jobs/:jobId` - Update a job
- `DELETE /api/jobs/:jobId` - Delete a job

### Executions
- `GET /api/executions/:jobId` - Get last 5 executions for a job
- `GET /api/executions` - Get all executions (with pagination)

### Observability
- `GET /api/observability/metrics` - Get system metrics
- `GET /api/observability/stats/jobs` - Get job statistics
- `GET /api/observability/stats/executions` - Get execution statistics
- `GET /api/observability/alerts/failures` - Get failure alerts
- `GET /api/observability/stats/job/:jobId` - Get job performance metrics

## Job Specification Format

```json
{
  "schedule": "31 10-15 1 * * MON-FRI",
  "api": "https://localhost:4444/foo",
  "type": "ATLEAST_ONCE"
}
```

### Schedule Format
Extended CRON format with seconds: `second minute hour day month dayOfWeek`

Examples:
- `"31 10-15 1 * * MON-FRI"` - Every 31st second of minutes 10-15 at 1 AM, Mon-Fri
- `"0 */5 * * * *"` - Every 5 minutes
- `"0 0 12 * * *"` - Every day at noon

## Architecture Decisions

### High-Throughput Design
- **100ms check interval**: The scheduler checks for due jobs every 100ms for high precision
- **Parallel execution**: Multiple jobs execute concurrently using `Promise.allSettled`
- **Efficient scheduling**: Jobs are stored in memory with pre-calculated next execution times
- **Database optimization**: Indexed queries and connection pooling

### Schedule Accuracy
- Minimal drift through frequent checks (100ms intervals)
- Tracks scheduled vs actual execution time for monitoring
- Pre-calculates next execution time to avoid parsing overhead

### Scalability
- Connection pooling for database operations
- In-memory job registry for fast lookups
- Asynchronous job execution
- Metrics collection for performance monitoring

### Observability
- Comprehensive logging with Winston
- Metrics stored in database for historical analysis
- Execution history with full details
- Failure alerting system

## Trade-offs

1. **In-Memory Scheduler**: Jobs are loaded into memory for fast access. On server restart, jobs are reloaded from database. This provides high performance but requires the scheduler to be stateful.

2. **100ms Check Interval**: Provides good accuracy while balancing CPU usage. For even higher precision, this could be reduced, but may impact performance under high load.

3. **At-Least-Once Semantics**: Currently implemented as best-effort. For true at-least-once guarantees, additional mechanisms like idempotency keys or distributed locking would be needed.

4. **Single-Instance**: The current design runs as a single instance. For horizontal scaling, a distributed scheduler (e.g., using Redis for coordination) would be required.

## Monitoring

- Check logs in `logs/combined.log` and `logs/error.log`
- View metrics via the Observability dashboard in the UI
- Monitor failure alerts via `/api/observability/alerts/failures`

## Future Enhancements

- [ ] Distributed scheduling with Redis coordination
- [ ] Email/Slack notifications for failures
- [ ] Job retry mechanisms with exponential backoff
- [ ] Webhook support for job completion callbacks
- [ ] Job templates and bulk operations
- [ ] Advanced CRON expressions (e.g., last day of month)
- [ ] Rate limiting per job
- [ ] Job dependencies and workflows

## License

ISC

