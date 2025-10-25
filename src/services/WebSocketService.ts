import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
}

interface ScheduleUpdatePayload {
  type: 'session_created' | 'session_cancelled' | 'session_rescheduled' | 'rbt_unavailable';
  sessionId?: string;
  clientId?: string;
  rbtId?: string;
  data: any;
  timestamp: Date;
}

export class WebSocketService {
  private io: SocketIOServer;
  private connectedUsers: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.CORS_ORIGIN || "*",
        methods: ["GET", "POST"]
      },
      transports: ['websocket', 'polling']
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware(): void {
    // Authentication middleware
    this.io.use((socket: any, next) => {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      try {
        const decoded = jwt.verify(token, config.jwt.secret) as any;
        socket.userId = decoded.userId;
        socket.userRole = decoded.role;
        
        logger.info('WebSocket client authenticated', { 
          userId: socket.userId, 
          role: socket.userRole,
          socketId: socket.id 
        });
        
        next();
      } catch (error) {
        logger.warn('WebSocket authentication failed', { error: error instanceof Error ? error.message : 'Unknown error' });
        next(new Error('Invalid authentication token'));
      }
    });
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: any) => {
      this.handleConnection(socket);
      
      socket.on('disconnect', () => {
        this.handleDisconnection(socket);
      });

      socket.on('subscribe_to_schedule', (data: { clientIds?: string[], rbtIds?: string[] }) => {
        this.handleScheduleSubscription(socket, data);
      });

      socket.on('unsubscribe_from_schedule', (data: { clientIds?: string[], rbtIds?: string[] }) => {
        this.handleScheduleUnsubscription(socket, data);
      });
    });
  }

  private handleConnection(socket: AuthenticatedSocket): void {
    const userId = socket.userId!;
    
    // Track connected user
    if (!this.connectedUsers.has(userId)) {
      this.connectedUsers.set(userId, new Set());
    }
    this.connectedUsers.get(userId)!.add(socket.id);

    logger.info('WebSocket client connected', { 
      userId, 
      socketId: socket.id,
      totalConnections: this.io.engine.clientsCount 
    });

    // Send connection confirmation
    socket.emit('connected', {
      message: 'Successfully connected to ABA Scheduling System',
      timestamp: new Date()
    });
  }

  private handleDisconnection(socket: AuthenticatedSocket): void {
    const userId = socket.userId!;
    
    // Remove from connected users
    if (this.connectedUsers.has(userId)) {
      this.connectedUsers.get(userId)!.delete(socket.id);
      if (this.connectedUsers.get(userId)!.size === 0) {
        this.connectedUsers.delete(userId);
      }
    }

    logger.info('WebSocket client disconnected', { 
      userId, 
      socketId: socket.id,
      totalConnections: this.io.engine.clientsCount 
    });
  }

  private handleScheduleSubscription(socket: AuthenticatedSocket, data: { clientIds?: string[], rbtIds?: string[] }): void {
    const { clientIds = [], rbtIds = [] } = data;
    
    // Join rooms for specific clients and RBTs
    clientIds.forEach(clientId => {
      socket.join(`client:${clientId}`);
    });
    
    rbtIds.forEach(rbtId => {
      socket.join(`rbt:${rbtId}`);
    });

    // Join user-specific room
    socket.join(`user:${socket.userId}`);

    logger.info('Client subscribed to schedule updates', {
      userId: socket.userId,
      clientIds,
      rbtIds,
      socketId: socket.id
    });

    socket.emit('subscription_confirmed', {
      clientIds,
      rbtIds,
      timestamp: new Date()
    });
  }

  private handleScheduleUnsubscription(socket: AuthenticatedSocket, data: { clientIds?: string[], rbtIds?: string[] }): void {
    const { clientIds = [], rbtIds = [] } = data;
    
    // Leave rooms for specific clients and RBTs
    clientIds.forEach(clientId => {
      socket.leave(`client:${clientId}`);
    });
    
    rbtIds.forEach(rbtId => {
      socket.leave(`rbt:${rbtId}`);
    });

    logger.info('Client unsubscribed from schedule updates', {
      userId: socket.userId,
      clientIds,
      rbtIds,
      socketId: socket.id
    });
  }

  // Public methods for broadcasting schedule updates
  public broadcastScheduleUpdate(payload: ScheduleUpdatePayload): void {
    const { type, sessionId, clientId, rbtId, data, timestamp } = payload;

    logger.info('Broadcasting schedule update', { type, sessionId, clientId, rbtId });

    // Broadcast to relevant rooms
    if (clientId) {
      this.io.to(`client:${clientId}`).emit('schedule_update', {
        type,
        sessionId,
        clientId,
        rbtId,
        data,
        timestamp
      });
    }

    if (rbtId) {
      this.io.to(`rbt:${rbtId}`).emit('schedule_update', {
        type,
        sessionId,
        clientId,
        rbtId,
        data,
        timestamp
      });
    }

    // Broadcast to all connected coordinators and admins
    this.io.emit('schedule_update', {
      type,
      sessionId,
      clientId,
      rbtId,
      data,
      timestamp
    });
  }

  public notifyUserDirectly(userId: string, event: string, data: any): void {
    this.io.to(`user:${userId}`).emit(event, {
      ...data,
      timestamp: new Date()
    });
  }

  public getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  public getConnectionsCount(): number {
    return this.io.engine.clientsCount;
  }

  public isUserConnected(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }
}

// Singleton instance
let webSocketService: WebSocketService | null = null;

export const initializeWebSocketService = (server: HTTPServer): WebSocketService => {
  if (!webSocketService) {
    webSocketService = new WebSocketService(server);
  }
  return webSocketService;
};

export const getWebSocketService = (): WebSocketService => {
  if (!webSocketService) {
    throw new Error('WebSocket service not initialized. Call initializeWebSocketService first.');
  }
  return webSocketService;
};