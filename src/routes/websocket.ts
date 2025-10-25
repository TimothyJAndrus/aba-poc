import { Router } from 'express';
import { WebSocketController } from '../controllers/WebSocketController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All WebSocket routes require authentication
router.use(authenticateToken);

// Get WebSocket connection statistics
router.get('/stats', WebSocketController.getConnectionStats);

// Send direct notification to a user
router.post('/notify-user', WebSocketController.sendUserNotification);

// Broadcast schedule update
router.post('/broadcast-schedule-update', WebSocketController.broadcastScheduleUpdate);

// Check if user is connected
router.get('/user/:userId/connection', WebSocketController.checkUserConnection);

export default router;