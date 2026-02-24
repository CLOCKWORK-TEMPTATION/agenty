# BullMQ Workers

Production-ready BullMQ workers for async task execution in the Multi-Model Agent Teams Platform.

## Overview

This package contains workers that process jobs from BullMQ queues:

- **Team Execution Worker**: Processes agent team orchestration jobs
- **Tool Execution Worker**: Executes tools with high concurrency
- **Batch Processing Worker**: Handles large dataset operations
- **Notification Worker**: Sends notifications across multiple channels

## Quick Start

### Prerequisites

- Redis server running
- Node.js 20+
- pnpm installed

### Installation

```bash
# Install dependencies
pnpm install

# Build the workers
pnpm run build
```

### Configuration

Create `.env` file:

```bash
cp .env.example .env
```

### Running Workers

**Development:**
```bash
pnpm run dev
```

**Production:**
```bash
pnpm run build
pnpm run start
```

## Monitoring

Navigate to `http://localhost:3000/admin/queues` for real-time monitoring.

## License

Private - Multi-Model Agent Teams Platform
