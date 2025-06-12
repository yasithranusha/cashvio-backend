# Deployment Guide

## Production Environment

### Server Details
- **Platform**: AWS EC2
- **Instance**: t2.micro (or similar)
- **Region**: eu-north-1
- **OS**: Ubuntu/Amazon Linux
- **URL**: `http://ec2-51-21-155-1.eu-north-1.compute.amazonaws.com`

### Prerequisites

#### System Requirements
- Docker & Docker Compose
- Git
- SSH access to EC2 instance

#### Cloud Services
- **DockerHub Account**: For container registry
- **AWS EC2 Instance**: For hosting
- **AWS S3 Bucket**: For file storage
- **AWS KMS**: For encryption
- **IAM roles and policies**: For AWS services

## Automated Deployment (CI/CD)

### GitHub Actions Pipeline

The project uses automated deployment via GitHub Actions:

#### Deployment Trigger
```bash
# Deploy to production by pushing to production branch
git checkout production
git merge your-feature-branch
git push origin production
```

#### Pipeline Stages

1. **Build Stage**: Builds Docker images for all 4 services
   - Auth Service: `cashvio-auth:latest`
   - Stock Service: `cashvio-stock:latest`
   - Order Service: `cashvio-order:latest`
   - Mailer-Uploader Service: `cashvio-mailer-uploader:latest`

2. **Push Stage**: Pushes images to DockerHub registry

3. **Deploy Stage**: Deploys to EC2 using Docker Compose
   - Generates production Docker Compose file
   - Transfers to EC2 instance
   - Pulls latest images
   - Restarts services

#### Required GitHub Secrets

Set these in your GitHub repository settings:

```bash
# EC2 Configuration
EC2_SSH_KEY=your-private-ssh-key
EC2_HOST=ec2-51-21-155-1.eu-north-1.compute.amazonaws.com

# DockerHub Configuration  
DOCKERHUB_USERNAME=your-dockerhub-username
DOCKERHUB_TOKEN=your-dockerhub-access-token

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/cashvio_db

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key
REFRESH_JWT_SECRET=your-refresh-jwt-secret
FORGET_PASSWORD_SECRET=your-forget-password-secret

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://ec2-51-21-155-1.eu-north-1.compute.amazonaws.com/auth/google/callback

# Client URLs
CUSTOMER_CLIENT_URL=http://ec2-51-21-155-1.eu-north-1.compute.amazonaws.com
ADMIN_CLIENT_URL=http://ec2-51-21-155-1.eu-north-1.compute.amazonaws.com/admin
SHOP_CLIENT_URL=http://ec2-51-21-155-1.eu-north-1.compute.amazonaws.com/shop

# Email Configuration
MAILER_EMAIL=your-email@gmail.com
OAUTH_CLIENT_ID=your-gmail-client-id
OAUTH_CLIENT_SECRET=your-gmail-client-secret
OAUTH_REFRESH_TOKEN=your-gmail-refresh-token

# AWS Configuration
AWS_ACCESS_KEY=your-aws-access-key
AWS_SECRET_KEY=your-aws-secret-key
AWS_S3_REGION=eu-north-1
AWS_BUCKET_NAME=your-s3-bucket-name
AWS_REGION=eu-north-1
AWS_ACCESS_KEY_ID=your-aws-access-key-id
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
AWS_KMS_KEY_ID=your-kms-key-id
AWS_KMS_KEY_ALIAS=your-kms-key-alias
```

## Manual Deployment (Alternative)

### Initial Server Setup

#### 1. EC2 Instance Preparation

```bash
# Connect to EC2
ssh -i your-key.pem ubuntu@ec2-51-21-155-1.eu-north-1.compute.amazonaws.com

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add user to docker group
sudo usermod -aG docker ubuntu
# Logout and login again for group changes to take effect
```

#### 2. Application Setup

```bash
# Create application directory
mkdir -p ~/cashvio-backend
cd ~/cashvio-backend

# Clone repository (if needed for configuration files)
git clone https://github.com/yasithranusha/cashvio-backend.git .
```

#### 3. Environment Configuration

Create production environment file:

```bash
# Create .env file
cat > .env << EOF
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/cashvio_db

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key
REFRESH_JWT_SECRET=your-refresh-jwt-secret
FORGET_PASSWORD_SECRET=your-forget-password-secret

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://ec2-51-21-155-1.eu-north-1.compute.amazonaws.com/auth/google/callback

# Client URLs
CUSTOMER_CLIENT_URL=http://ec2-51-21-155-1.eu-north-1.compute.amazonaws.com
ADMIN_CLIENT_URL=http://ec2-51-21-155-1.eu-north-1.compute.amazonaws.com/admin
SHOP_CLIENT_URL=http://ec2-51-21-155-1.eu-north-1.compute.amazonaws.com/shop

# Email Configuration
MAILER_EMAIL=your-email@gmail.com
OAUTH_CLIENT_ID=your-gmail-client-id
OAUTH_CLIENT_SECRET=your-gmail-client-secret
OAUTH_REFRESH_TOKEN=your-gmail-refresh-token

# AWS Configuration
AWS_ACCESS_KEY=your-aws-access-key
AWS_SECRET_KEY=your-aws-secret-key
AWS_S3_REGION=eu-north-1
AWS_BUCKET_NAME=your-s3-bucket-name
AWS_REGION=eu-north-1
AWS_ACCESS_KEY_ID=your-aws-access-key-id
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
AWS_KMS_KEY_ID=your-kms-key-id
AWS_KMS_KEY_ALIAS=your-kms-key-alias
EOF
```

#### 4. Nginx Reverse Proxy Setup

```bash
# Install Nginx
sudo apt install nginx

# Create Nginx configuration
sudo tee /etc/nginx/sites-available/cashvio << EOF
server {
    listen 80;
    server_name ec2-51-21-155-1.eu-north-1.compute.amazonaws.com;

    location /auth {
        proxy_pass http://localhost:3010;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    location /stock {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    location /order {
        proxy_pass http://localhost:3003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    location /mailer {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/cashvio /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx
```

### Docker Deployment

#### 1. Create Production Docker Compose

```bash
# Create docker-compose.yml for production
cat > docker-compose.yml << EOF
version: '3.8'

services:
  auth:
    image: your-dockerhub-username/cashvio-auth:latest
    ports:
      - "3010:3010"
    environment:
      - DATABASE_URL=\${DATABASE_URL}
      - JWT_SECRET=\${JWT_SECRET}
      - REFRESH_JWT_SECRET=\${REFRESH_JWT_SECRET}
      - GOOGLE_CLIENT_ID=\${GOOGLE_CLIENT_ID}
      - GOOGLE_CLIENT_SECRET=\${GOOGLE_CLIENT_SECRET}
      - GOOGLE_CALLBACK_URL=\${GOOGLE_CALLBACK_URL}
    restart: unless-stopped
    depends_on:
      - postgres
      - rabbitmq

  stock:
    image: your-dockerhub-username/cashvio-stock:latest
    ports:
      - "3002:3002"
    environment:
      - DATABASE_URL=\${DATABASE_URL}
    restart: unless-stopped
    depends_on:
      - postgres
      - rabbitmq

  order:
    image: your-dockerhub-username/cashvio-order:latest
    ports:
      - "3003:3003"
    environment:
      - DATABASE_URL=\${DATABASE_URL}
      - AWS_ACCESS_KEY_ID=\${AWS_ACCESS_KEY_ID}
      - AWS_SECRET_ACCESS_KEY=\${AWS_SECRET_ACCESS_KEY}
      - AWS_KMS_KEY_ID=\${AWS_KMS_KEY_ID}
      - AWS_REGION=\${AWS_REGION}
    restart: unless-stopped
    depends_on:
      - postgres
      - rabbitmq

  mailer-uploader:
    image: your-dockerhub-username/cashvio-mailer-uploader:latest
    ports:
      - "3001:3001"
    environment:
      - MAILER_EMAIL=\${MAILER_EMAIL}
      - OAUTH_CLIENT_ID=\${OAUTH_CLIENT_ID}
      - OAUTH_CLIENT_SECRET=\${OAUTH_CLIENT_SECRET}
      - OAUTH_REFRESH_TOKEN=\${OAUTH_REFRESH_TOKEN}
      - AWS_ACCESS_KEY=\${AWS_ACCESS_KEY}
      - AWS_SECRET_KEY=\${AWS_SECRET_KEY}
      - AWS_BUCKET_NAME=\${AWS_BUCKET_NAME}
      - AWS_S3_REGION=\${AWS_S3_REGION}
    restart: unless-stopped
    depends_on:
      - rabbitmq

  postgres:
    image: postgres:14
    environment:
      - POSTGRES_DB=cashvio_db
      - POSTGRES_USER=your_user
      - POSTGRES_PASSWORD=your_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  rabbitmq:
    image: rabbitmq:3-management
    environment:
      - RABBITMQ_DEFAULT_USER=admin
      - RABBITMQ_DEFAULT_PASS=admin123
    ports:
      - "15672:15672"  # Management UI
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    restart: unless-stopped

volumes:
  postgres_data:
  rabbitmq_data:
EOF
```

#### 2. Deploy Services

```bash
# Pull latest images
docker-compose pull

# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Check service status
docker-compose ps
```

## Monitoring & Maintenance

### Docker Management

```bash
# View running containers
docker ps

# View service logs
docker-compose logs service-name

# Restart specific service
docker-compose restart service-name

# Update services
docker-compose pull
docker-compose up -d

# Scale services (if needed)
docker-compose up -d --scale auth=2
```

### System Monitoring

```bash
# Monitor resource usage
docker stats

# View system resources
htop
df -h

# Check Nginx status
sudo systemctl status nginx

# View Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Database Management

```bash
# Connect to database container
docker-compose exec postgres psql -U your_user -d cashvio_db

# Backup database
docker-compose exec postgres pg_dump -U your_user cashvio_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore database
docker-compose exec -T postgres psql -U your_user -d cashvio_db < backup_file.sql
```

## Security & SSL

### SSL Certificate Setup (Optional)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d ec2-51-21-155-1.eu-north-1.compute.amazonaws.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Security Best Practices

1. **Firewall Configuration**
```bash
# Configure UFW firewall
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
```

2. **Docker Security**
```bash
# Regular security updates
docker system prune -f
docker-compose pull
docker-compose up -d
```

3. **Environment Variables**
   - Never commit secrets to Git
   - Use GitHub Secrets for CI/CD
   - Rotate secrets regularly

## Troubleshooting

### Common Issues

```bash
# Service not starting
docker-compose logs service-name

# Port conflicts
sudo netstat -tlnp | grep :3010

# Disk space issues
docker system prune -af
docker volume prune -f

# Memory issues
docker stats
free -h
```

### Rollback Procedure

```bash
# Rollback to previous version
docker-compose down
docker-compose pull
docker-compose up -d

# Or use specific image tags
docker-compose up -d auth=your-dockerhub-username/cashvio-auth:previous-tag
```

This deployment setup ensures automated, reliable deployments using Docker containers with proper monitoring and maintenance procedures.