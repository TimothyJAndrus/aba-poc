import { Request, Response } from 'express';
import { WebSocketController } from '../WebSocketController';
import { getWebSocketService } from '../../services/WebSocketService';

// Mock the WebSocket service
jest.mock('../../services/WebSocketService', () => ({
  getWebSocketService: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('WebSocketController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockWebSocketService: any;

  beforeEach(() => {
    mockRequest = {
      body: {},
      params: {},
      user: { userId: 'test-user', email: 'test@example.com', role: 'coordinator' }
    };

    mockResponse = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis()
    };

    mockWebSocketService = {
      getConnectedUsersCount: jest.fn(),
      getConnectionsCount: jest.fn(),
      isUserConnected: jest.fn(),
      notifyUserDirectly: jest.fn(),
      broadcastScheduleUpdate: jest.fn()
    };

    (getWebSocketService as jest.Mock).mockReturnValue(mockWebSocketService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getConnectionStats', () => {
    it('should return connection statistics successfully', async () => {
      mockWebSocketService.getConnectedUsersCount.mockReturnValue(5);
      mockWebSocketService.getConnectionsCount.mockReturnValue(8);

      await WebSocketController.getConnectionStats(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          connectedUsers: 5,
          totalConnections: 8,
          timestamp: expect.any(Date)
        }
      });
    });

    it('should handle service errors', async () => {
      (getWebSocketService as jest.Mock).mockImplementation(() => {
        throw new Error('Service not available');
      });

      await WebSocketController.getConnectionStats(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to get connection statistics'
      });
    });
  });

  describe('sendUserNotification', () => {
    it('should send notification to connected user successfully', async () => {
      mockRequest.body = {
        userId: 'target-user',
        event: 'test_event',
        data: { message: 'test message' }
      };
      mockWebSocketService.isUserConnected.mockReturnValue(true);

      await WebSocketController.sendUserNotification(mockRequest as Request, mockResponse as Response);

      expect(mockWebSocketService.isUserConnected).toHaveBeenCalledWith('target-user');
      expect(mockWebSocketService.notifyUserDirectly).toHaveBeenCalledWith(
        'target-user',
        'test_event',
        { message: 'test message' }
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Notification sent successfully'
      });
    });

    it('should return error for missing required fields', async () => {
      mockRequest.body = { userId: 'target-user' }; // Missing event

      await WebSocketController.sendUserNotification(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'userId and event are required'
      });
    });

    it('should return error for disconnected user', async () => {
      mockRequest.body = {
        userId: 'target-user',
        event: 'test_event',
        data: { message: 'test message' }
      };
      mockWebSocketService.isUserConnected.mockReturnValue(false);

      await WebSocketController.sendUserNotification(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'User is not currently connected'
      });
    });
  });

  describe('broadcastScheduleUpdate', () => {
    it('should broadcast schedule update successfully', async () => {
      mockRequest.body = {
        type: 'session_created',
        sessionId: 'session-123',
        clientId: 'client-123',
        rbtId: 'rbt-123',
        data: { session: 'data' }
      };

      await WebSocketController.broadcastScheduleUpdate(mockRequest as Request, mockResponse as Response);

      expect(mockWebSocketService.broadcastScheduleUpdate).toHaveBeenCalledWith({
        type: 'session_created',
        sessionId: 'session-123',
        clientId: 'client-123',
        rbtId: 'rbt-123',
        data: { session: 'data' },
        timestamp: expect.any(Date)
      });
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Schedule update broadcasted successfully'
      });
    });

    it('should return error for missing type', async () => {
      mockRequest.body = {
        sessionId: 'session-123',
        data: { session: 'data' }
      };

      await WebSocketController.broadcastScheduleUpdate(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Update type is required'
      });
    });

    it('should handle service errors', async () => {
      mockRequest.body = {
        type: 'session_created',
        data: { session: 'data' }
      };
      mockWebSocketService.broadcastScheduleUpdate.mockImplementation(() => {
        throw new Error('Broadcast failed');
      });

      await WebSocketController.broadcastScheduleUpdate(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to broadcast schedule update'
      });
    });
  });

  describe('checkUserConnection', () => {
    it('should check user connection successfully', async () => {
      mockRequest.params = { userId: 'target-user' };
      mockWebSocketService.isUserConnected.mockReturnValue(true);

      await WebSocketController.checkUserConnection(mockRequest as Request, mockResponse as Response);

      expect(mockWebSocketService.isUserConnected).toHaveBeenCalledWith('target-user');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          userId: 'target-user',
          isConnected: true,
          timestamp: expect.any(Date)
        }
      });
    });

    it('should return error for missing userId', async () => {
      mockRequest.params = {};

      await WebSocketController.checkUserConnection(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'userId is required'
      });
    });

    it('should handle service errors', async () => {
      mockRequest.params = { userId: 'target-user' };
      mockWebSocketService.isUserConnected.mockImplementation(() => {
        throw new Error('Service error');
      });

      await WebSocketController.checkUserConnection(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to check user connection'
      });
    });
  });
});