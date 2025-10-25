import { logger } from '../utils/logger';

export type AuditEventType = 
  | 'user_login'
  | 'user_logout'
  | 'user_created'
  | 'user_updated'
  | 'user_deactivated'
  | 'session_scheduled'
  | 'session_cancelled'
  | 'session_rescheduled'
  | 'session_completed'
  | 'team_created'
  | 'team_updated'
  | 'team_ended'
  | 'rbt_added_to_team'
  | 'rbt_removed_from_team'
  | 'primary_rbt_changed'
  | 'notification_sent'
  | 'data_export'
  | 'system_configuration_changed'
  | 'alert_triggered'
  | 'alert_resolved';

export interface AuditEvent {
  id: string;
  eventType: AuditEventType;
  userId: string;
  userEmail: string;
  userRole: string;
  targetId?: string;
  targetType?: string;
  action: string;
  description: string;
  metadata?: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  sessionId?: string;
}

export interface AuditQuery {
  eventType?: AuditEventType;
  userId?: string;
  targetId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export class AuditLoggingService {
  private auditEvents: AuditEvent[] = [];

  /**
   * Log an audit event
   */
  logEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>): void {
    const auditEvent: AuditEvent = {
      ...event,
      id: this.generateEventId(),
      timestamp: new Date()
    };

    // Store in memory (in production, this would go to a database)
    this.auditEvents.push(auditEvent);

    // Log to Winston for immediate visibility
    logger.info('AUDIT EVENT', {
      auditEventId: auditEvent.id,
      eventType: auditEvent.eventType,
      userId: auditEvent.userId,
      userEmail: auditEvent.userEmail,
      action: auditEvent.action,
      description: auditEvent.description,
      targetId: auditEvent.targetId,
      targetType: auditEvent.targetType,
      metadata: auditEvent.metadata,
      ipAddress: auditEvent.ipAddress,
      timestamp: auditEvent.timestamp
    });

    // Keep only last 10000 events in memory for performance
    if (this.auditEvents.length > 10000) {
      this.auditEvents = this.auditEvents.slice(-10000);
    }
  }

  /**
   * Log user authentication event
   */
  logUserAuth(
    eventType: 'user_login' | 'user_logout',
    userId: string,
    userEmail: string,
    userRole: string,
    ipAddress: string,
    userAgent: string,
    success: boolean = true,
    sessionId?: string
  ): void {
    this.logEvent({
      eventType,
      userId,
      userEmail,
      userRole,
      action: eventType === 'user_login' ? 'LOGIN' : 'LOGOUT',
      description: `User ${success ? 'successfully' : 'unsuccessfully'} ${eventType === 'user_login' ? 'logged in' : 'logged out'}`,
      metadata: { success },
      ipAddress,
      userAgent,
      ...(sessionId && { sessionId })
    });
  }

  /**
   * Log session management event
   */
  logSessionEvent(
    eventType: 'session_scheduled' | 'session_cancelled' | 'session_rescheduled' | 'session_completed',
    sessionId: string,
    clientId: string,
    rbtId: string,
    userId: string,
    userEmail: string,
    userRole: string,
    ipAddress: string,
    userAgent: string,
    metadata?: Record<string, any>
  ): void {
    const actionMap = {
      session_scheduled: 'SCHEDULE',
      session_cancelled: 'CANCEL',
      session_rescheduled: 'RESCHEDULE',
      session_completed: 'COMPLETE'
    };

    this.logEvent({
      eventType,
      userId,
      userEmail,
      userRole,
      targetId: sessionId,
      targetType: 'session',
      action: actionMap[eventType],
      description: `Session ${actionMap[eventType].toLowerCase()}d for client ${clientId} with RBT ${rbtId}`,
      metadata: {
        ...metadata,
        clientId,
        rbtId,
        sessionId
      },
      ipAddress,
      userAgent
    });
  }

  /**
   * Log team management event
   */
  logTeamEvent(
    eventType: 'team_created' | 'team_updated' | 'team_ended' | 'rbt_added_to_team' | 'rbt_removed_from_team' | 'primary_rbt_changed',
    teamId: string,
    clientId: string,
    userId: string,
    userEmail: string,
    userRole: string,
    ipAddress: string,
    userAgent: string,
    metadata?: Record<string, any>
  ): void {
    const actionMap = {
      team_created: 'CREATE_TEAM',
      team_updated: 'UPDATE_TEAM',
      team_ended: 'END_TEAM',
      rbt_added_to_team: 'ADD_RBT',
      rbt_removed_from_team: 'REMOVE_RBT',
      primary_rbt_changed: 'CHANGE_PRIMARY_RBT'
    };

    this.logEvent({
      eventType,
      userId,
      userEmail,
      userRole,
      targetId: teamId,
      targetType: 'team',
      action: actionMap[eventType],
      description: `Team management action: ${actionMap[eventType]} for client ${clientId}`,
      metadata: {
        ...metadata,
        teamId,
        clientId
      },
      ipAddress,
      userAgent
    });
  }

  /**
   * Log data access event
   */
  logDataAccess(
    action: 'VIEW' | 'EXPORT' | 'DOWNLOAD',
    dataType: string,
    targetId: string,
    userId: string,
    userEmail: string,
    userRole: string,
    ipAddress: string,
    userAgent: string,
    metadata?: Record<string, any>
  ): void {
    this.logEvent({
      eventType: 'data_export',
      userId,
      userEmail,
      userRole,
      targetId,
      targetType: dataType,
      action,
      description: `User ${action.toLowerCase()}ed ${dataType} data`,
      ...(metadata && { metadata }),
      ipAddress,
      userAgent
    });
  }

  /**
   * Log system configuration change
   */
  logSystemChange(
    configType: string,
    changeDescription: string,
    userId: string,
    userEmail: string,
    userRole: string,
    ipAddress: string,
    userAgent: string,
    oldValue?: any,
    newValue?: any
  ): void {
    this.logEvent({
      eventType: 'system_configuration_changed',
      userId,
      userEmail,
      userRole,
      targetType: 'system_config',
      action: 'CONFIGURE',
      description: `System configuration changed: ${changeDescription}`,
      metadata: {
        configType,
        oldValue,
        newValue
      },
      ipAddress,
      userAgent
    });
  }

  /**
   * Query audit events
   */
  queryEvents(query: AuditQuery): AuditEvent[] {
    let filteredEvents = [...this.auditEvents];

    // Apply filters
    if (query.eventType) {
      filteredEvents = filteredEvents.filter(event => event.eventType === query.eventType);
    }

    if (query.userId) {
      filteredEvents = filteredEvents.filter(event => event.userId === query.userId);
    }

    if (query.targetId) {
      filteredEvents = filteredEvents.filter(event => event.targetId === query.targetId);
    }

    if (query.startDate) {
      filteredEvents = filteredEvents.filter(event => event.timestamp >= query.startDate!);
    }

    if (query.endDate) {
      filteredEvents = filteredEvents.filter(event => event.timestamp <= query.endDate!);
    }

    // Sort by timestamp (newest first)
    filteredEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply pagination
    const offset = query.offset || 0;
    const limit = query.limit || 100;
    
    return filteredEvents.slice(offset, offset + limit);
  }

  /**
   * Get audit statistics
   */
  getAuditStats(startDate?: Date, endDate?: Date): {
    totalEvents: number;
    eventsByType: Record<AuditEventType, number>;
    eventsByUser: Record<string, number>;
    recentEvents: AuditEvent[];
  } {
    let events = [...this.auditEvents];

    if (startDate) {
      events = events.filter(event => event.timestamp >= startDate);
    }

    if (endDate) {
      events = events.filter(event => event.timestamp <= endDate);
    }

    const eventsByType = events.reduce((acc, event) => {
      acc[event.eventType] = (acc[event.eventType] || 0) + 1;
      return acc;
    }, {} as Record<AuditEventType, number>);

    const eventsByUser = events.reduce((acc, event) => {
      acc[event.userEmail] = (acc[event.userEmail] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const recentEvents = events
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10);

    return {
      totalEvents: events.length,
      eventsByType,
      eventsByUser,
      recentEvents
    };
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance
let auditLoggingService: AuditLoggingService | null = null;

export const getAuditLoggingService = (): AuditLoggingService => {
  if (!auditLoggingService) {
    auditLoggingService = new AuditLoggingService();
  }
  return auditLoggingService;
};