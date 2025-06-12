# Development Guide

## Prerequisites

### System Requirements
- **Node.js**: 18.x or higher
- **Yarn**: Package manager (preferred over npm)
- **PostgreSQL**: 14.x or higher
- **RabbitMQ**: 3.8.x or higher
- **Git**: Latest version
- **Docker & Docker Compose**: For containerized development

### Optional Tools
- **Postman**: For API testing
- **pgAdmin**: For database management
- **VS Code**: Recommended IDE

## Local Development Setup

### 1. Clone Repository

```bash
git clone https://github.com/yasithranusha/cashvio-backend.git
cd cashvio-backend
```

### 2. Install Dependencies

```bash
# Install all dependencies using Yarn
yarn install

# Install global tools (optional)
yarn global add @nestjs/cli
yarn global add prisma
```

### 3. Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit .env file with your local settings
```

#### Environment Variables

```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/cashvio_dev"

# JWT Configuration
JWT_SECRET="your-development-jwt-secret"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# Google OAuth (Development)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_REDIRECT_URI="http://localhost:8080/auth/google/callback"

# Gmail OAuth (Separate Configuration)
GMAIL_CLIENT_ID="your-gmail-client-id"
GMAIL_CLIENT_SECRET="your-gmail-client-secret"
GMAIL_REFRESH_TOKEN="your-gmail-refresh-token"
GMAIL_USER_EMAIL="your-email@gmail.com"

# AWS Configuration
AWS_ACCESS_KEY_ID="your-aws-access-key"
AWS_SECRET_ACCESS_KEY="your-aws-secret-key"
AWS_S3_BUCKET="your-development-bucket"
AWS_KMS_KEY_ID="your-kms-key-id"
AWS_REGION="eu-north-1"

# RabbitMQ
RABBITMQ_URL="amqp://localhost:5672"
RABBITMQ_QUEUE_NAME="cashvio_queue"

# Service Ports
AUTH_SERVICE_PORT=8080
MAILER_UPLOADER_SERVICE_PORT=8081
STOCK_SERVICE_PORT=8082
ORDER_SERVICE_PORT=8083
```

## Development Options

### Option 1: Docker Development Environment (Recommended)

```bash
# Start all services with Docker Compose
docker-compose -f docker-compose-dev.yml up --build

# Start in detached mode
docker-compose -f docker-compose-dev.yml up -d --build

# View logs
docker-compose -f docker-compose-dev.yml logs -f

# Stop services
docker-compose -f docker-compose-dev.yml down
```

### Option 2: Local Development (Manual Setup)

#### 4. Database Setup

```bash
# Create development database
createdb cashvio_dev

# Generate Prisma client
yarn prisma generate

# Run database migrations
yarn prisma migrate dev

# Seed database (optional)
yarn prisma db seed
```

#### 5. RabbitMQ Setup

```bash
# Start RabbitMQ (Ubuntu/Debian)
sudo systemctl start rabbitmq-server

# Enable management plugin
sudo rabbitmq-plugins enable rabbitmq_management

# Access management UI: http://localhost:15672
# Default credentials: guest/guest
```

#### 6. Start Development Services

**Option A: Start All Services**

```bash
# Start all microservices concurrently
yarn start:dev
```

**Option B: Start Individual Services**

```bash
# Terminal 1 - Auth Service
yarn start:dev auth

# Terminal 2 - Stock Service  
yarn start:dev stock

# Terminal 3 - Order Service
yarn start:dev order

# Terminal 4 - Mailer-Uploader Service
yarn start:dev mailer-uploader
```

### Development Ports

| Service | Port | URL |
|---------|------|-----|
| Auth Service | 8080 | http://localhost:8080 |
| Mailer-Uploader | 8081 | http://localhost:8081 |
| Stock Service | 8082 | http://localhost:8082 |
| Order Service | 8083 | http://localhost:8083 |

## Project Structure

```
cashvio-backend/
├── apps/
│   ├── auth/                 # Auth microservice
│   │   ├── Dockerfile        # Docker configuration
│   │   └── src/              # Source code
│   ├── stock/                # Stock microservice
│   │   ├── Dockerfile        # Docker configuration
│   │   └── src/              # Source code
│   ├── order/                # Order microservice
│   │   ├── Dockerfile        # Docker configuration
│   │   └── src/              # Source code
│   └── mailer-uploader/      # Mailer-Uploader microservice
│       ├── Dockerfile        # Docker configuration
│       └── src/              # Source code
├── libs/                     # Shared libraries
│   ├── common/               # Common utilities
│   └── database/             # Database configuration
├── prisma/                   # Database schema and migrations
├── docs/                     # Documentation
├── docker-compose-dev.yml    # Development Docker setup
├── docker-compose-template.yml # Production template
├── .github/workflows/        # CI/CD configuration
├── nest-cli.json             # NestJS CLI configuration
├── package.json              # Dependencies and scripts
└── tsconfig.json             # TypeScript configuration
```

## Development Workflow

### 1. Feature Development

```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes
# ...

# Test changes
yarn test
yarn test:e2e

# Commit changes
git add .
git commit -m "feat: add new feature"

# Push to production branch for deployment
git push origin production
```

### 2. Database Changes

```bash
# Modify Prisma schema
# Edit prisma/schema.prisma

# Create migration
yarn prisma migrate dev --name migration-name

# Generate client
yarn prisma generate
```

### 3. Testing

```bash
# Unit tests
yarn test

# E2E tests
yarn test:e2e

# Test coverage
yarn test:cov

# Test specific service
yarn test auth
yarn test stock
yarn test order
yarn test mailer-uploader
```

## Docker Development

### Building Individual Services

```bash
# Build auth service
docker build -f apps/auth/Dockerfile -t cashvio-auth .

# Build stock service
docker build -f apps/stock/Dockerfile -t cashvio-stock .

# Build order service
docker build -f apps/order/Dockerfile -t cashvio-order .

# Build mailer-uploader service
docker build -f apps/mailer-uploader/Dockerfile -t cashvio-mailer-uploader .
```

### Docker Compose Commands

```bash
# Build and start development environment
docker-compose -f docker-compose-dev.yml up --build

# Rebuild specific service
docker-compose -f docker-compose-dev.yml build auth

# View service logs
docker-compose -f docker-compose-dev.yml logs auth

# Execute commands in running container
docker-compose -f docker-compose-dev.yml exec auth sh

# Clean up
docker-compose -f docker-compose-dev.yml down --volumes --remove-orphans
```

## API Testing

### Postman Collection

Import the Postman collection for comprehensive API testing:
- File: `cashvio_postman_collection.json`
- Collection includes all endpoints with example requests
- Environment variables for different environments

### Example API Calls

#### Authentication

```bash
# Login
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'

# Google OAuth
curl http://localhost:8080/auth/google
```

#### Stock Management

```bash
# Get products
curl -X GET http://localhost:8082/products \
  -H "Authorization: Bearer YOUR_TOKEN"

# Create product
curl -X POST http://localhost:8082/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"name": "Product Name", "categoryId": 1}'
```

## Debugging

### VS Code Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Auth Service",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/dist/apps/auth/main.js",
      "env": {
        "NODE_ENV": "development"
      },
      "sourceMaps": true,
      "outFiles": ["${workspaceFolder}/dist/**/*.js"]
    }
  ]
}
```

### Docker Debugging

```bash
# View container logs
docker-compose logs -f service-name

# Access container shell
docker-compose exec service-name sh

# Inspect container
docker inspect container-name

# View resource usage
docker stats
```

### Logging

```typescript
// Use built-in NestJS logger
import { Logger } from '@nestjs/common';

const logger = new Logger('ServiceName');
logger.log('Info message');
logger.error('Error message');
logger.debug('Debug message');
```

## Common Issues

### Port Conflicts

```bash
# Check if port is in use
lsof -i :8080

# Kill process using port
kill -9 $(lsof -t -i:8080)

# Or use Docker to avoid port conflicts
docker-compose -f docker-compose-dev.yml up
```

### Database Connection Issues

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Connect to database
psql -h localhost -U username -d cashvio_dev

# Reset database in Docker
docker-compose -f docker-compose-dev.yml down --volumes
docker-compose -f docker-compose-dev.yml up --build
```

### RabbitMQ Issues

```bash
# Check RabbitMQ status
sudo systemctl status rabbitmq-server

# Restart RabbitMQ
sudo systemctl restart rabbitmq-server

# Check queues
rabbitmqctl list_queues

# Docker RabbitMQ management
docker-compose -f docker-compose-dev.yml logs rabbitmq
```

### Docker Issues

```bash
# Clean up Docker system
docker system prune -af

# Remove all containers and images
docker-compose -f docker-compose-dev.yml down --rmi all --volumes

# Rebuild everything
docker-compose -f docker-compose-dev.yml build --no-cache
```

## Performance Tips

1. **Development Environment**
   - Use Docker development setup for consistency
   - Use volume mounts for hot-reloading
   - Optimize Docker layer caching

2. **Database Optimization**
   - Use database indexes for frequently queried fields
   - Implement connection pooling
   - Use pagination for large datasets

3. **Memory Management**
   - Monitor Docker container resource usage
   - Use streaming for large file uploads
   - Optimize bundle sizes

4. **Code Quality**
   - Use ESLint and Prettier for consistent code style
   - Write unit tests for new features
   - Follow NestJS best practices

## CI/CD Pipeline

### GitHub Actions Workflow

The project uses GitHub Actions for automated deployment:

- **Trigger**: Push to `production` branch
- **Build**: Builds Docker images for all 4 services
- **Deploy**: Deploys to EC2 using Docker Compose
- **Services**: Auth, Stock, Order, Mailer-Uploader

### Deployment Process

```bash
# Deploy to production
git checkout production
git merge your-feature-branch
git push origin production

# GitHub Actions will automatically:
# 1. Build Docker images
# 2. Push to DockerHub
# 3. Deploy to EC2
# 4. Start services with Docker Compose
```