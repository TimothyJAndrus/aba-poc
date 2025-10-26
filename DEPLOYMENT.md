# ABA Scheduling System - Deployment Guide

This document provides comprehensive instructions for deploying the ABA Scheduling System to production and staging environments.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Configuration](#environment-configuration)
3. [Build Process](#build-process)
4. [Deployment Options](#deployment-options)
5. [Environment Variables](#environment-variables)
6. [Security Configuration](#security-configuration)
7. [Monitoring and Error Tracking](#monitoring-and-error-tracking)
8. [Performance Optimization](#performance-optimization)
9. [Troubleshooting](#troubleshooting)
10. [Rollback Procedures](#rollback-procedures)

## Prerequisites

### System Requirements

- **Node.js**: Version 18.x or higher
- **npm**: Version 9.x or higher
- **Git**: For version control
- **SSL Certificate**: For HTTPS in production
- **CDN**: Recommended for static asset delivery

### Development Tools

- **Docker**: For containerized deployments (optional)
- **CI/CD Pipeline**: GitHub Actions, GitLab CI, or similar
- **Monitoring Tools**: Sentry for error tracking

## Environment Configuration

### Environment Files

The application uses different environment files for different deployment stages:

- `.env.development` - Local development
- `.env.staging` - Staging environment
- `.env.production` - Production environment

### Required Environment Variables

```bash
# API Configuration
VITE_API_BASE_URL=https://api.aba-scheduling.com/api
VITE_WS_URL=wss://api.aba-scheduling.com

# Application Configuration
VITE_APP_NAME=ABA Scheduling System
VITE_APP_VERSION=1.0.0
VITE_ENVIRONMENT=production

# Sentry Configuration
VITE_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
VITE_SENTRY_ORG=your-org
VITE_SENTRY_PROJECT=aba-scheduling-ui
VITE_SENTRY_RELEASE=aba-scheduling-ui@1.0.0
VITE_SENTRY_AUTH_TOKEN=your-sentry-auth-token

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
```

## Build Process

### Local Build

```bash
# Install dependencies
npm install

# Run linting and formatting
npm run lint:fix
npm run format

# Run tests
npm run test:all

# Build for production
npm run build:production

# Preview production build
npm run preview:production
```

### CI/CD Build Pipeline

```yaml
# Example GitHub Actions workflow
name: Build and Deploy

on:
  push:
    branches: [main, staging]

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
        cache-dependency-path: frontend/package-lock.json
    
    - name: Install dependencies
      run: |
        cd frontend
        npm ci
    
    - name: Run tests
      run: |
        cd frontend
        npm run test:all
    
    - name: Build application
      run: |
        cd frontend
        npm run build:production
      env:
        VITE_API_BASE_URL: ${{ secrets.API_BASE_URL }}
        VITE_SENTRY_DSN: ${{ secrets.SENTRY_DSN }}
        VITE_SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
    
    - name: Upload build artifacts
      uses: actions/upload-artifact@v3
      with:
        name: dist
        path: frontend/dist/
```

## Deployment Options

### Option 1: Static Hosting (Recommended)

Deploy to static hosting services like:

- **Vercel**
- **Netlify** 
- **AWS S3 + CloudFront**
- **Azure Static Web Apps**
- **Google Cloud Storage + CDN**

#### Vercel Deployment

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy to staging
vercel --prod=false

# Deploy to production
vercel --prod
```

#### Netlify Deployment

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Build and deploy
npm run build:production
netlify deploy --prod --dir=dist
```

#### AWS S3 + CloudFront

```bash
# Build application
npm run build:production

# Sync to S3 bucket
aws s3 sync dist/ s3://your-bucket-name --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id YOUR_DISTRIBUTION_ID --paths "/*"
```

### Option 2: Docker Deployment

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci --only=production

COPY frontend/ .
RUN npm run build:production

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

```bash
# Build Docker image
docker build -t aba-scheduling-ui .

# Run container
docker run -p 80:80 aba-scheduling-ui
```

### Option 3: Traditional Web Server

Deploy to Apache or Nginx web servers:

```nginx
# nginx.conf
server {
    listen 80;
    server_name your-domain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    root /var/www/aba-scheduling-ui;
    index index.html;
    
    # Enable gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    
    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Handle client-side routing
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";
}
```

## Security Configuration

### Content Security Policy (CSP)

Add CSP headers to prevent XSS attacks:

```html
<!-- In index.html -->
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://browser.sentry-cdn.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data: https:;
  connect-src 'self' https://api.aba-scheduling.com wss://api.aba-scheduling.com https://sentry.io;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
">
```

### HTTPS Configuration

Ensure all production deployments use HTTPS:

1. Obtain SSL certificate from Let's Encrypt or commercial CA
2. Configure web server for HTTPS
3. Set up HTTP to HTTPS redirects
4. Enable HSTS headers

### Environment Security

- Never commit `.env` files to version control
- Use secure secret management (AWS Secrets Manager, Azure Key Vault, etc.)
- Rotate API keys and tokens regularly
- Implement proper CORS policies on the backend

## Monitoring and Error Tracking

### Sentry Configuration

1. Create Sentry project at https://sentry.io
2. Configure environment variables:
   ```bash
   VITE_SENTRY_DSN=your-sentry-dsn
   VITE_SENTRY_ORG=your-org
   VITE_SENTRY_PROJECT=your-project
   VITE_SENTRY_AUTH_TOKEN=your-auth-token
   ```
3. Set up release tracking and source maps upload

### Performance Monitoring

- Enable Lighthouse CI for performance monitoring
- Set up Core Web Vitals tracking
- Monitor bundle size and loading times
- Use browser performance APIs

### Health Checks

Implement health check endpoints:

```javascript
// health-check.js
const healthCheck = {
  status: 'healthy',
  timestamp: new Date().toISOString(),
  version: process.env.VITE_APP_VERSION,
  environment: process.env.VITE_ENVIRONMENT,
  uptime: process.uptime(),
};

// Serve at /health endpoint
```

## Performance Optimization

### Build Optimizations

- Code splitting by routes and components
- Tree shaking to remove unused code
- Asset optimization (images, fonts)
- Gzip/Brotli compression
- Service worker for caching

### Runtime Optimizations

- Lazy loading of components
- Image lazy loading
- Virtual scrolling for large lists
- Debounced search and API calls
- Efficient state management

### CDN Configuration

Use CDN for static assets:

```javascript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          // Configure asset paths for CDN
          return `assets/[name]-[hash][extname]`;
        },
      },
    },
  },
});
```

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check Node.js version compatibility
   - Clear npm cache: `npm cache clean --force`
   - Delete node_modules and reinstall

2. **Runtime Errors**
   - Check browser console for errors
   - Verify API endpoints are accessible
   - Check CORS configuration

3. **Performance Issues**
   - Analyze bundle size with build analyzer
   - Check for memory leaks
   - Optimize images and assets

4. **Deployment Issues**
   - Verify environment variables
   - Check file permissions
   - Validate SSL certificates

### Debug Mode

Enable debug mode for troubleshooting:

```bash
VITE_ENABLE_DEBUG=true
VITE_LOG_LEVEL=debug
```

### Log Analysis

Monitor application logs:

```bash
# View application logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# Check Sentry for error reports
# Monitor performance metrics
```

## Rollback Procedures

### Quick Rollback

1. **Static Hosting**: Revert to previous deployment
2. **Docker**: Deploy previous image version
3. **Traditional Server**: Restore previous build files

### Rollback Steps

```bash
# Example rollback script
#!/bin/bash

PREVIOUS_VERSION=$1
BACKUP_DIR="/var/backups/aba-scheduling-ui"

if [ -z "$PREVIOUS_VERSION" ]; then
  echo "Usage: $0 <previous-version>"
  exit 1
fi

# Stop application
systemctl stop nginx

# Restore previous version
cp -r "$BACKUP_DIR/$PREVIOUS_VERSION"/* /var/www/aba-scheduling-ui/

# Start application
systemctl start nginx

echo "Rollback to version $PREVIOUS_VERSION completed"
```

### Database Rollback

If database changes are involved:

1. Stop application
2. Restore database backup
3. Deploy compatible frontend version
4. Restart application

## Maintenance

### Regular Tasks

- Update dependencies monthly
- Review and rotate secrets quarterly
- Monitor performance metrics weekly
- Update SSL certificates before expiration
- Review error logs daily

### Backup Strategy

- Automated daily backups of configuration
- Version control for all deployment scripts
- Document all manual configuration changes
- Test restore procedures regularly

## Support and Documentation

- **Technical Documentation**: Available in `/docs` directory
- **API Documentation**: Available at `/api/docs`
- **Support Contact**: support@aba-scheduling.com
- **Emergency Contact**: emergency@aba-scheduling.com

---

For additional support or questions about deployment, please contact the development team or refer to the project's issue tracker.