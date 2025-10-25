import { Request, Response } from 'express';
import { getWebSocketService } from '../services/WebSocketService';
import { logger } from '../utils/logger';

export class WebSocketController {
  
  /**
   * Get WebSocket connection statistics
   */
  public static async getConnectionStats(req: Request, res: Response): Promise<void> {
    try {
      const webSocketService = getWebSocketService();
      
      const stats = {
        connectedUsers: webSocketService.getConnectedUsersCount(),
        totalConnections: webSocketService.getConnectionsCount(),
        timestamp: new Date()
      };

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Error getting WebSocket connection stats', { error: error instanceof Error ? error.message : 'Unknown error' });
      res.status(500).json({
        success: false,
        message: 'Failed to get connection statistics'
      });
    }
  }

  /**
   * Send a direct notification to a specific user
   */
  public static async sendUserNotification(req: Request, res: Response): Promise<void> {
    try {
      const { userId, event, data } = req.body;

      if (!userId || !event) {
        res.status(400).json({
          success: false,
          message: 'userId and event are required'
        });
        return;
      }

      const webSocketService = getWebSocketService();
      
      // Check if user is connected
      if (!webSocketService.isUserConnected(userId)) {
        res.status(404).json({
          success: false,
          message: 'User is not currently connected'
        });
        return;
      }

      webSocketService.notifyUserDirectly(userId, event, data);

      logger.info('Direct notification sent to user', { userId, event });

      res.json({
        success: true,
        message: 'Notification sent successfully'
      });
    } catch (error) {
      logger.error('Error sending user notification', { error: error instanceof Error ? error.message : 'Unknown error' });
      res.status(500).json({
        success: false,
        message: 'Failed to send notification'
      });
    }
  }

  /**
   * Broadcast a schedule update to all relevant clients
   */
  public static async broadcastScheduleUpdate(req: Request, res: Response): Promise<void> {
    try {
      const { type, sessionId, clientId, rbtId, data } = req.body;

      if (!type) {
        res.status(400).json({
          success: false,
          message: 'Update type is required'
        });
        return;
      }

      const webSocketService = getWebSocketService();
      
      webSocketService.broadcastScheduleUpdate({
        type,
        sessionId,
        clientId,
        rbtId,
        data,
        timestamp: new Date()
      });

      logger.info('Schedule update broadcasted', { type, sessionId, clientId, rbtId });

      res.json({
        success: true,
        message: 'Schedule update broadcasted successfully'
      });
    } catch (error) {
      logger.error('Error broadcasting schedule update', { error: error instanceof Error ? error.message : 'Unknown error' });
      res.status(500).json({
        success: false,
        message: 'Failed to broadcast schedule update'
      });
    }
  }

  /**
   * Check if a specific user is currently connected
   */
  public static async checkUserConnection(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      if (!userId) {
        res.status(400).json({
          success: false,
          message: 'userId is required'
        });
        return;
      }

      const webSocketService = getWebSocketService();
      const isConnected = webSocketService.isUserConnected(userId);

      res.json({
        success: true,
        data: {
          userId,
          isConnected,
          timestamp: new Date()
        }
      });
    } catch (error) {
      logger.error('Error checking user connection', { error: error instanceof Error ? error.message : 'Unknown error' });
      res.status(500).json({
        success: false,
        message: 'Failed to check user connection'
      });
    }
  }
}