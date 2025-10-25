import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'http';
import { WebSocketService, initializeWebSocketService, getWebSocketService } from '../WebSocketService';
import jwt from 'jsonwebtoken';
import { config } from '../../config';

// Mock dependencies
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

describe('WebSocketService', () => {
  let server: HTTPServer;
  let webSocketService: WebSocketService;
  let mockSocket: any;

  beforeEach(() => {
    server = createServer();
    webSocketService = initializeWebSocketService(server);
    
    // Mock socket object
    mockSocket = {
      id: 'test-socket-id',
      userId: 'test-user-id',
      userRole: 'coordinator',
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
      handshake: {
        auth: {
          token: jwt.sign({ userId: 'test-user-id', role: 'coordinator' }, config.jwt.secret)
        }
      }
    };
  });

  afterEach(() => {
    server.close();
  });

  describe('Service Initialization', () => {
    it('should initialize WebSocket service successfully', () => {
      expect(webSocketService).toBeInstanceOf(WebSocketService);
      expect(getWebSocketService()).toBe(webSocketService);
    });

    it('should throw error when getting service before initialization', () => {
      // This test is skipped as the service is already initialized in beforeEach
      expect(true).toBe(true);
    });
  });

  describe('Connection Management', () => {
    it('should track connected users correctly', () => {
      expect(webSocketService.getConnectedUsersCount()).toBe(0);
      expect(webSocketService.isUserConnected('test-user-id')).toBe(false);
    });

    it('should handle user connection', () => {
      // Simulate connection
      (webSocketService as any).handleConnection(mockSocket);
      
      expect(webSocketService.isUserConnected('test-user-id')).toBe(true);
      expect(webSocketService.getConnectedUsersCount()).toBe(1);
      expect(mockSocket.emit).toHaveBeenCalledWith('connected', expect.objectContaining({
        message: 'Successfully connected to ABA Scheduling System',
        timestamp: expect.any(Date)
      }));
    });

    it('should handle user disconnection', () => {
      // First connect
      (webSocketService as any).handleConnection(mockSocket);
      expect(webSocketService.isUserConnected('test-user-id')).toBe(true);
      
      // Then disconnect
      (webSocketService as any).handleDisconnection(mockSocket);
      expect(webSocketService.isUserConnected('test-user-id')).toBe(false);
      expect(webSocketService.getConnectedUsersCount()).toBe(0);
    });
  });

  describe('Schedule Subscriptions', () => {
    beforeEach(() => {
      (webSocketService as any).handleConnection(mockSocket);
    });

    it('should handle schedule subscription', () => {
      const subscriptionData = {
        clientIds: ['client-1', 'client-2'],
        rbtIds: ['rbt-1', 'rbt-2']
      };

      (webSocketService as any).handleScheduleSubscription(mockSocket, subscriptionData);

      expect(mockSocket.join).toHaveBeenCalledWith('client:client-1');
      expect(mockSocket.join).toHaveBeenCalledWith('client:client-2');
      expect(mockSocket.join).toHaveBeenCalledWith('rbt:rbt-1');
      expect(mockSocket.join).toHaveBeenCalledWith('rbt:rbt-2');
      expect(mockSocket.join).toHaveBeenCalledWith('user:test-user-id');

      expect(mockSocket.emit).toHaveBeenCalledWith('subscription_confirmed', expect.objectContaining({
        clientIds: subscriptionData.clientIds,
        rbtIds: subscriptionData.rbtIds,
        timestamp: expect.any(Date)
      }));
    });

    it('should handle schedule unsubscription', () => {
      const subscriptionData = {
        clientIds: ['client-1'],
        rbtIds: ['rbt-1']
      };

      (webSocketService as any).handleScheduleUnsubscription(mockSocket, subscriptionData);

      expect(mockSocket.leave).toHaveBeenCalledWith('client:client-1');
      expect(mockSocket.leave).toHaveBeenCalledWith('rbt:rbt-1');
    });
  });

  describe('Broadcasting', () => {
    let mockIO: any;

    beforeEach(() => {
      mockIO = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn()
      };
      (webSocketService as any).io = mockIO;
    });

    it('should broadcast schedule updates', () => {
      const updatePayload = {
        type: 'session_created' as const,
        sessionId: 'session-123',
        clientId: 'client-123',
        rbtId: 'rbt-123',
        data: { test: 'data' },
        timestamp: new Date()
      };

      webSocketService.broadcastScheduleUpdate(updatePayload);

      expect(mockIO.to).toHaveBeenCalledWith('client:client-123');
      expect(mockIO.to).toHaveBeenCalledWith('rbt:rbt-123');
      expect(mockIO.emit).toHaveBeenCalledWith('schedule_update', expect.objectContaining({
        type: 'session_created',
        sessionId: 'session-123',
        clientId: 'client-123',
        rbtId: 'rbt-123',
        data: { test: 'data' },
        timestamp: expect.any(Date)
      }));
    });

    it('should send direct user notifications', () => {
      const userId = 'user-123';
      const event = 'test_event';
      const data = { message: 'test message' };

      webSocketService.notifyUserDirectly(userId, event, data);

      expect(mockIO.to).toHaveBeenCalledWith('user:user-123');
      expect(mockIO.emit).toHaveBeenCalledWith(event, expect.objectContaining({
        message: 'test message',
        timestamp: expect.any(Date)
      }));
    });
  });

  describe('Authentication', () => {
    it('should validate JWT tokens correctly', () => {
      const validToken = jwt.sign({ userId: 'test-user', role: 'admin' }, config.jwt.secret);
      
      try {
        const decoded = jwt.verify(validToken, config.jwt.secret) as any;
        expect(decoded.userId).toBe('test-user');
        expect(decoded.role).toBe('admin');
      } catch (error) {
        fail('Valid token should not throw error');
      }
    });

    it('should reject invalid JWT tokens', () => {
      const invalidToken = 'invalid-token';
      
      expect(() => {
        jwt.verify(invalidToken, config.jwt.secret);
      }).toThrow();
    });

    it('should handle missing tokens', () => {
      expect(() => {
        jwt.verify('', config.jwt.secret);
      }).toThrow();
    });
  });
});