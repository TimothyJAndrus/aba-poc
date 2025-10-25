import express from 'express';
import { createServer } from 'http';
import { config } from './config';
import { logger } from './utils/logger';
import routes from './routes';
import { initializeWebSocketService } from './services/WebSocketService';
import { initializeCacheService } from './services/CacheService';

const app = express();
const server = createServer(app);

// Initialize services
async function initializeServices() {
  try {
    // Initialize cache service
    await initializeCacheService();
    logger.info('Cache service initialized successfully');

    // Initialize WebSocket service
    const webSocketService = initializeWebSocketService(server);
    logger.info('WebSocket service initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize services', { error: error.message });
    process.exit(1);
  }
}

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, { 
    ip: req.ip, 
    userAgent: req.get('User-Agent'),
    body: req.method !== 'GET' ? req.body : undefined
  });
  next();
});

// API routes
app.use('/', routes);

const PORT = config.port || 3000;

// Start server with service initialization
initializeServices().then(() => {
  server.listen(PORT, () => {
    logger.info(`ABA Scheduling System server running on port ${PORT}`);
    logger.info('All services initialized and ready');
  });
}).catch((error) => {
  logger.error('Failed to start server', { error: error.message });
  process.exit(1);
});

export default app;