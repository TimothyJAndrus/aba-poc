#!/bin/bash

# ABA Scheduling System - Environment Setup Script
# This script sets up the production environment for deployment

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-production}
PROJECT_NAME="aba-scheduling"
DOMAIN=${2:-"aba-scheduling.com"}

echo -e "${BLUE}🚀 Setting up ABA Scheduling System - ${ENVIRONMENT} environment${NC}"

# Function to print status
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root for security reasons"
   exit 1
fi

# Check prerequisites
echo -e "${BLUE}Checking prerequisites...${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi
print_status "Node.js $(node -v) is installed"

# Check npm
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed"
    exit 1
fi
print_status "npm $(npm -v) is installed"

# Check Docker (optional)
if command -v docker &> /dev/null; then
    print_status "Docker $(docker --version | cut -d' ' -f3 | cut -d',' -f1) is available"
    DOCKER_AVAILABLE=true
else
    print_warning "Docker is not installed (optional for containerized deployment)"
    DOCKER_AVAILABLE=false
fi

# Check Git
if ! command -v git &> /dev/null; then
    print_error "Git is not installed"
    exit 1
fi
print_status "Git is installed"

# Create directory structure
echo -e "${BLUE}Creating directory structure...${NC}"

mkdir -p logs/{nginx,app}
mkdir -p backups
mkdir -p ssl
mkdir -p monitoring/{prometheus,grafana}
mkdir -p scripts

print_status "Directory structure created"

# Setup environment files
echo -e "${BLUE}Setting up environment configuration...${NC}"

if [ ! -f ".env.${ENVIRONMENT}" ]; then
    print_warning "Environment file .env.${ENVIRONMENT} not found. Creating template..."
    
    cat > ".env.${ENVIRONMENT}" << EOF
# ${ENVIRONMENT^} Environment Configuration
# Generated on $(date)

# API Configuration
VITE_API_BASE_URL=https://api.${DOMAIN}/api
VITE_WS_URL=wss://api.${DOMAIN}

# Application Configuration
VITE_APP_NAME=ABA Scheduling System
VITE_APP_VERSION=1.0.0
VITE_ENVIRONMENT=${ENVIRONMENT}

# Sentry Configuration (replace with actual values)
VITE_SENTRY_DSN=
VITE_SENTRY_ORG=
VITE_SENTRY_PROJECT=${PROJECT_NAME}-ui
VITE_SENTRY_RELEASE=${PROJECT_NAME}-ui@1.0.0
VITE_SENTRY_AUTH_TOKEN=

# Database Configuration
DATABASE_URL=postgresql://aba_user:password@localhost:5432/aba_scheduling
POSTGRES_DB=aba_scheduling
POSTGRES_USER=aba_user
POSTGRES_PASSWORD=

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Security
JWT_SECRET=
SESSION_SECRET=

# Monitoring
GRAFANA_PASSWORD=admin

# Feature Flags
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_ERROR_REPORTING=true
VITE_ENABLE_PERFORMANCE_MONITORING=true

# Security
VITE_ENABLE_CSP=true
VITE_ENABLE_HTTPS_ONLY=true

# Performance
VITE_ENABLE_SERVICE_WORKER=true
VITE_ENABLE_CODE_SPLITTING=true
VITE_ENABLE_LAZY_LOADING=true

# Monitoring
VITE_LOG_LEVEL=error
VITE_ENABLE_DEBUG=false
EOF

    print_warning "Please edit .env.${ENVIRONMENT} with your actual configuration values"
else
    print_status "Environment file .env.${ENVIRONMENT} already exists"
fi

# Install dependencies
echo -e "${BLUE}Installing dependencies...${NC}"

if [ -d "frontend" ]; then
    cd frontend
    print_status "Installing frontend dependencies..."
    npm ci --only=production
    cd ..
fi

if [ -f "package.json" ]; then
    print_status "Installing backend dependencies..."
    npm ci --only=production
fi

print_status "Dependencies installed"

# Build application
echo -e "${BLUE}Building application...${NC}"

if [ -d "frontend" ]; then
    cd frontend
    print_status "Building frontend for ${ENVIRONMENT}..."
    npm run build:${ENVIRONMENT}
    cd ..
    print_status "Frontend build completed"
fi

# Setup SSL certificates (Let's Encrypt)
setup_ssl() {
    echo -e "${BLUE}Setting up SSL certificates...${NC}"
    
    if command -v certbot &> /dev/null; then
        print_status "Certbot is available"
        
        # Create SSL certificate
        sudo certbot certonly --standalone \
            --email admin@${DOMAIN} \
            --agree-tos \
            --no-eff-email \
            -d ${DOMAIN} \
            -d www.${DOMAIN} \
            -d api.${DOMAIN}
        
        # Copy certificates to ssl directory
        sudo cp /etc/letsencrypt/live/${DOMAIN}/fullchain.pem ssl/
        sudo cp /etc/letsencrypt/live/${DOMAIN}/privkey.pem ssl/
        sudo chown $(whoami):$(whoami) ssl/*.pem
        
        print_status "SSL certificates configured"
    else
        print_warning "Certbot not found. Please install certbot for SSL certificates"
        print_warning "Or manually place your SSL certificates in the ssl/ directory"
    fi
}

# Setup systemd service (for non-Docker deployment)
setup_systemd_service() {
    echo -e "${BLUE}Setting up systemd service...${NC}"
    
    cat > "${PROJECT_NAME}.service" << EOF
[Unit]
Description=ABA Scheduling System
After=network.target

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=$(pwd)
Environment=NODE_ENV=${ENVIRONMENT}
ExecStart=$(which node) src/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    print_status "Systemd service file created: ${PROJECT_NAME}.service"
    print_warning "To install the service, run: sudo cp ${PROJECT_NAME}.service /etc/systemd/system/"
    print_warning "Then: sudo systemctl enable ${PROJECT_NAME} && sudo systemctl start ${PROJECT_NAME}"
}

# Setup nginx configuration
setup_nginx() {
    echo -e "${BLUE}Setting up Nginx configuration...${NC}"
    
    cat > "nginx-${ENVIRONMENT}.conf" << EOF
# Nginx configuration for ABA Scheduling System - ${ENVIRONMENT}
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ${DOMAIN} www.${DOMAIN};
    
    ssl_certificate /path/to/ssl/fullchain.pem;
    ssl_certificate_key /path/to/ssl/privkey.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Frontend
    location / {
        root $(pwd)/frontend/dist;
        try_files \$uri \$uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # Backend API
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
    
    # WebSocket
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

    print_status "Nginx configuration created: nginx-${ENVIRONMENT}.conf"
}

# Setup monitoring
setup_monitoring() {
    echo -e "${BLUE}Setting up monitoring configuration...${NC}"
    
    # Prometheus configuration
    cat > "monitoring/prometheus/prometheus.yml" << EOF
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  # - "first_rules.yml"
  # - "second_rules.yml"

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
  
  - job_name: 'aba-scheduling-backend'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
    scrape_interval: 30s
  
  - job_name: 'node-exporter'
    static_configs:
      - targets: ['localhost:9100']
EOF

    print_status "Monitoring configuration created"
}

# Setup log rotation
setup_log_rotation() {
    echo -e "${BLUE}Setting up log rotation...${NC}"
    
    cat > "${PROJECT_NAME}-logrotate" << EOF
$(pwd)/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 $(whoami) $(whoami)
    postrotate
        systemctl reload ${PROJECT_NAME} > /dev/null 2>&1 || true
    endscript
}
EOF

    print_status "Log rotation configuration created: ${PROJECT_NAME}-logrotate"
    print_warning "To install: sudo cp ${PROJECT_NAME}-logrotate /etc/logrotate.d/${PROJECT_NAME}"
}

# Setup backup script
setup_backup_script() {
    echo -e "${BLUE}Setting up backup script...${NC}"
    
    cat > "scripts/backup.sh" << EOF
#!/bin/bash
# Backup script for ABA Scheduling System

BACKUP_DIR="\$(pwd)/backups"
DATE=\$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="${PROJECT_NAME}_backup_\${DATE}"

# Create backup directory
mkdir -p "\${BACKUP_DIR}/\${BACKUP_NAME}"

# Backup database
if command -v pg_dump &> /dev/null; then
    pg_dump \${DATABASE_URL} > "\${BACKUP_DIR}/\${BACKUP_NAME}/database.sql"
    echo "Database backup completed"
fi

# Backup application files
tar -czf "\${BACKUP_DIR}/\${BACKUP_NAME}/app_files.tar.gz" \
    --exclude=node_modules \
    --exclude=dist \
    --exclude=logs \
    --exclude=backups \
    .

# Backup environment files
cp .env.* "\${BACKUP_DIR}/\${BACKUP_NAME}/" 2>/dev/null || true

# Create archive
cd "\${BACKUP_DIR}"
tar -czf "\${BACKUP_NAME}.tar.gz" "\${BACKUP_NAME}"
rm -rf "\${BACKUP_NAME}"

echo "Backup completed: \${BACKUP_DIR}/\${BACKUP_NAME}.tar.gz"

# Clean old backups (keep last 7 days)
find "\${BACKUP_DIR}" -name "${PROJECT_NAME}_backup_*.tar.gz" -mtime +7 -delete
EOF

    chmod +x scripts/backup.sh
    print_status "Backup script created: scripts/backup.sh"
}

# Main setup process
echo -e "${BLUE}Starting environment setup...${NC}"

# Ask user what to set up
echo "What would you like to set up?"
echo "1) SSL certificates"
echo "2) Systemd service"
echo "3) Nginx configuration"
echo "4) Monitoring"
echo "5) Log rotation"
echo "6) Backup script"
echo "7) All of the above"
echo "8) Skip additional setup"

read -p "Enter your choice (1-8): " choice

case $choice in
    1) setup_ssl ;;
    2) setup_systemd_service ;;
    3) setup_nginx ;;
    4) setup_monitoring ;;
    5) setup_log_rotation ;;
    6) setup_backup_script ;;
    7) 
        setup_ssl
        setup_systemd_service
        setup_nginx
        setup_monitoring
        setup_log_rotation
        setup_backup_script
        ;;
    8) print_status "Skipping additional setup" ;;
    *) print_warning "Invalid choice. Skipping additional setup" ;;
esac

# Final instructions
echo -e "${GREEN}"
echo "🎉 Environment setup completed!"
echo -e "${NC}"
echo "Next steps:"
echo "1. Edit .env.${ENVIRONMENT} with your actual configuration values"
echo "2. Configure your database connection"
echo "3. Set up your domain DNS to point to this server"
echo "4. Install and configure SSL certificates if not done already"
echo "5. Set up your reverse proxy (Nginx/Apache)"
echo "6. Start your application"
echo ""
echo "For Docker deployment:"
echo "  docker-compose up -d"
echo ""
echo "For traditional deployment:"
echo "  npm start"
echo ""
echo "For more information, see DEPLOYMENT.md"

print_status "Setup script completed successfully!"