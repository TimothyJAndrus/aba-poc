import { PoolClient } from 'pg';
import { BaseRepository, WhereClause, QueryOptions } from './BaseRepository';
import { ScheduleEvent, CreateScheduleEventRequest, ScheduleEventQuery, ScheduleEventSummary, AuditTrail } from '../../models/ScheduleEvent';
import { validateCreateScheduleEventRequest, validateScheduleEventQuery } from '../../models/ScheduleEvent';
import { ScheduleEventType } from '../../types';

export class ScheduleEventRepository extends BaseRepository<ScheduleEvent> {
  constructor() {
    super('schedule_events');
  }

  /**
   * Create a new schedule event
   */
  public async create(data: CreateScheduleEventRequest, client?: PoolClient): Promise<ScheduleEvent> {
    // Validate input
    const errors = validateCreateScheduleEventRequest(data);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    const dbData = this.toDbObject({
      eventType: data.eventType,
      sessionId: data.sessionId,
      rbtId: data.rbtId,
      clientId: data.clientId,
      oldValues: data.oldValues ? JSON.stringify(data.oldValues) : null,
      newValues: data.newValues ? JSON.stringify(data.newValues) : null,
      reason: data.reason,
      metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      createdBy: data.createdBy
    });

    const fields = Object.keys(dbData);
    const values = Object.values(dbData);
    const query = this.buildInsertQuery(fields);

    const rows = await this.executeQuery<any>(query, values, client);
    const event = this.fromDbObject(rows[0]);
    
    return {
      ...event,
      oldValues: event.oldValues ? JSON.parse(event.oldValues) : undefined,
      newValues: event.newValues ? JSON.parse(event.newValues) : undefined,
      metadata: event.metadata ? JSON.parse(event.metadata) : undefined
    } as ScheduleEvent;
  }

  /**
   * Update is not allowed for schedule events (audit trail integrity)
   */
  public async update(id: string, data: any, client?: PoolClient): Promise<ScheduleEvent | null> {
    throw new Error('Schedule events cannot be updated to maintain audit trail integrity');
  }

  /**
   * Find schedule event by ID
   */
  public override async findById(id: string, client?: PoolClient): Promise<ScheduleEvent | null> {
    const query = `SELECT * FROM ${this.tableName} WHERE id = $1`;
    const rows = await this.executeQuery<any>(query, [id], client);
    
    if (rows.length === 0) {
      return null;
    }

    const event = this.fromDbObject(rows[0]);
    return {
      ...event,
      oldValues: event.oldValues && typeof event.oldValues === 'string' ? JSON.parse(event.oldValues) : event.oldValues,
      newValues: event.newValues && typeof event.newValues === 'string' ? JSON.parse(event.newValues) : event.newValues,
      metadata: event.metadata && typeof event.metadata === 'string' ? JSON.parse(event.metadata) : event.metadata
    } as ScheduleEvent;
  }

  /**
   * Query schedule events with filters
   */
  public async query(queryParams: ScheduleEventQuery, client?: PoolClient): Promise<ScheduleEvent[]> {
    // Validate query parameters
    const errors = validateScheduleEventQuery(queryParams);
    if (errors.length > 0) {
      throw new Error(`Query validation failed: ${errors.join(', ')}`);
    }

    const conditions: WhereClause[] = [];
    
    if (queryParams.eventType) {
      conditions.push({ field: 'event_type', operator: '=', value: queryParams.eventType });
    }
    
    if (queryParams.sessionId) {
      conditions.push({ field: 'session_id', operator: '=', value: queryParams.sessionId });
    }
    
    if (queryParams.rbtId) {
      conditions.push({ field: 'rbt_id', operator: '=', value: queryParams.rbtId });
    }
    
    if (queryParams.clientId) {
      conditions.push({ field: 'client_id', operator: '=', value: queryParams.clientId });
    }
    
    if (queryParams.createdBy) {
      conditions.push({ field: 'created_by', operator: '=', value: queryParams.createdBy });
    }
    
    if (queryParams.startDate) {
      conditions.push({ field: 'created_at', operator: '>=', value: queryParams.startDate });
    }
    
    if (queryParams.endDate) {
      conditions.push({ field: 'created_at', operator: '<=', value: queryParams.endDate });
    }

    const options: QueryOptions = {
      orderBy: 'created_at',
      orderDirection: 'DESC'
    };
    
    if (queryParams.limit !== undefined) {
      options.limit = queryParams.limit;
    }
    
    if (queryParams.offset !== undefined) {
      options.offset = queryParams.offset;
    }

    const events = await this.findBy(conditions, options, client);
    return events.map(event => ({
      ...event,
      oldValues: event.oldValues ? JSON.parse(event.oldValues as string) : undefined,
      newValues: event.newValues ? JSON.parse(event.newValues as string) : undefined,
      metadata: event.metadata ? JSON.parse(event.metadata as string) : undefined
    }));
  }

  /**
   * Find events by type
   */
  public async findByEventType(eventType: ScheduleEventType, options: QueryOptions = {}, client?: PoolClient): Promise<ScheduleEvent[]> {
    const conditions: WhereClause[] = [
      { field: 'event_type', operator: '=', value: eventType }
    ];

    const events = await this.findBy(conditions, options, client);
    return events.map(event => ({
      ...event,
      oldValues: event.oldValues ? JSON.parse(event.oldValues as string) : undefined,
      newValues: event.newValues ? JSON.parse(event.newValues as string) : undefined,
      metadata: event.metadata ? JSON.parse(event.metadata as string) : undefined
    }));
  }

  /**
   * Find events by session ID
   */
  public async findBySessionId(sessionId: string, options: QueryOptions = {}, client?: PoolClient): Promise<ScheduleEvent[]> {
    const conditions: WhereClause[] = [
      { field: 'session_id', operator: '=', value: sessionId }
    ];

    const events = await this.findBy(conditions, { ...options, orderBy: 'created_at', orderDirection: 'ASC' }, client);
    return events.map(event => ({
      ...event,
      oldValues: event.oldValues ? JSON.parse(event.oldValues as string) : undefined,
      newValues: event.newValues ? JSON.parse(event.newValues as string) : undefined,
      metadata: event.metadata ? JSON.parse(event.metadata as string) : undefined
    }));
  }

  /**
   * Find events by RBT ID
   */
  public async findByRbtId(rbtId: string, options: QueryOptions = {}, client?: PoolClient): Promise<ScheduleEvent[]> {
    const conditions: WhereClause[] = [
      { field: 'rbt_id', operator: '=', value: rbtId }
    ];

    const events = await this.findBy(conditions, options, client);
    return events.map(event => ({
      ...event,
      oldValues: event.oldValues ? JSON.parse(event.oldValues as string) : undefined,
      newValues: event.newValues ? JSON.parse(event.newValues as string) : undefined,
      metadata: event.metadata ? JSON.parse(event.metadata as string) : undefined
    }));
  }

  /**
   * Find events by client ID
   */
  public async findByClientId(clientId: string, options: QueryOptions = {}, client?: PoolClient): Promise<ScheduleEvent[]> {
    const conditions: WhereClause[] = [
      { field: 'client_id', operator: '=', value: clientId }
    ];

    const events = await this.findBy(conditions, options, client);
    return events.map(event => ({
      ...event,
      oldValues: event.oldValues ? JSON.parse(event.oldValues as string) : undefined,
      newValues: event.newValues ? JSON.parse(event.newValues as string) : undefined,
      metadata: event.metadata ? JSON.parse(event.metadata as string) : undefined
    }));
  }

  /**
   * Get event summaries with descriptions
   */
  public async getEventSummaries(
    startDate: Date, 
    endDate: Date, 
    options: QueryOptions = {}, 
    client?: PoolClient
  ): Promise<ScheduleEventSummary[]> {
    const query = `
      SELECT 
        se.id as event_id,
        se.event_type,
        se.created_at as timestamp,
        se.session_id,
        se.rbt_id,
        se.client_id,
        se.created_by,
        CONCAT(u.first_name, ' ', u.last_name) as created_by_name
      FROM schedule_events se
      JOIN users u ON se.created_by = u.id
      WHERE se.created_at >= $1 AND se.created_at <= $2
      ${this.buildOrderClause(options)}
    `;

    const { clause: limitClause, values: limitValues } = this.buildLimitClause(options, 3);
    const finalQuery = `${query} ${limitClause}`;

    const rows = await this.executeQuery<any>(finalQuery, [startDate, endDate, ...limitValues], client);
    return rows.map(row => ({
      eventId: row.event_id,
      eventType: row.event_type,
      timestamp: row.timestamp,
      description: this.generateEventDescription(row.event_type, row.created_by_name),
      affectedEntities: {
        sessionId: row.session_id,
        rbtId: row.rbt_id,
        clientId: row.client_id
      },
      createdBy: row.created_by
    }));
  }

  /**
   * Get audit trail for an entity
   */
  public async getAuditTrail(
    entityType: 'session' | 'rbt' | 'client' | 'team',
    entityId: string,
    startDate?: Date,
    endDate?: Date,
    client?: PoolClient
  ): Promise<AuditTrail> {
    const conditions: WhereClause[] = [];
    
    // Map entity type to field name
    const fieldMap = {
      session: 'session_id',
      rbt: 'rbt_id',
      client: 'client_id',
      team: 'client_id' // Teams are tracked via client_id
    };
    
    conditions.push({ field: fieldMap[entityType], operator: '=', value: entityId });
    
    if (startDate) {
      conditions.push({ field: 'created_at', operator: '>=', value: startDate });
    }
    
    if (endDate) {
      conditions.push({ field: 'created_at', operator: '<=', value: endDate });
    }

    const events = await this.findBy(conditions, { orderBy: 'created_at', orderDirection: 'ASC' }, client);
    
    const eventSummaries: ScheduleEventSummary[] = events.map(event => ({
      eventId: event.id,
      eventType: event.eventType,
      timestamp: event.createdAt,
      description: this.generateEventDescription(event.eventType),
      affectedEntities: {
        sessionId: event.sessionId,
        rbtId: event.rbtId,
        clientId: event.clientId
      },
      createdBy: event.createdBy
    }));

    return {
      entityType,
      entityId,
      events: eventSummaries,
      totalEvents: eventSummaries.length,
      dateRange: {
        startDate: startDate || (events.length > 0 ? events[0].createdAt : new Date()),
        endDate: endDate || (events.length > 0 ? events[events.length - 1].createdAt : new Date())
      }
    };
  }

  /**
   * Log session creation
   */
  public async logSessionCreated(
    sessionId: string,
    clientId: string,
    rbtId: string,
    sessionData: any,
    createdBy: string,
    client?: PoolClient
  ): Promise<ScheduleEvent> {
    return this.create({
      eventType: 'session_created',
      sessionId,
      clientId,
      rbtId,
      newValues: sessionData,
      createdBy
    }, client);
  }

  /**
   * Log session cancellation
   */
  public async logSessionCancelled(
    sessionId: string,
    clientId: string,
    rbtId: string,
    reason: string,
    oldSessionData: any,
    createdBy: string,
    client?: PoolClient
  ): Promise<ScheduleEvent> {
    return this.create({
      eventType: 'session_cancelled',
      sessionId,
      clientId,
      rbtId,
      oldValues: oldSessionData,
      reason,
      createdBy
    }, client);
  }

  /**
   * Log session rescheduling
   */
  public async logSessionRescheduled(
    sessionId: string,
    clientId: string,
    rbtId: string,
    oldSessionData: any,
    newSessionData: any,
    reason: string,
    createdBy: string,
    client?: PoolClient
  ): Promise<ScheduleEvent> {
    return this.create({
      eventType: 'session_rescheduled',
      sessionId,
      clientId,
      rbtId,
      oldValues: oldSessionData,
      newValues: newSessionData,
      reason,
      createdBy
    }, client);
  }

  /**
   * Log RBT unavailability
   */
  public async logRbtUnavailable(
    rbtId: string,
    reason: string,
    unavailabilityData: any,
    createdBy: string,
    client?: PoolClient
  ): Promise<ScheduleEvent> {
    return this.create({
      eventType: 'rbt_unavailable',
      rbtId,
      newValues: unavailabilityData,
      reason,
      createdBy
    }, client);
  }

  /**
   * Get recent events
   */
  public async getRecentEvents(hours: number = 24, limit: number = 50, client?: PoolClient): Promise<ScheduleEvent[]> {
    const startDate = new Date();
    startDate.setHours(startDate.getHours() - hours);

    return this.query({
      startDate,
      limit
    }, client);
  }

  /**
   * Safely parse JSON string or return the value if already parsed
   */
  private safeJsonParse(value: any): any {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  }

  /**
   * Generate human-readable event description
   */
  private generateEventDescription(eventType: ScheduleEventType, createdByName?: string): string {
    const actor = createdByName || 'System';
    
    switch (eventType) {
      case 'session_created':
        return `${actor} created a new session`;
      case 'session_cancelled':
        return `${actor} cancelled a session`;
      case 'session_rescheduled':
        return `${actor} rescheduled a session`;
      case 'rbt_unavailable':
        return `${actor} marked RBT as unavailable`;
      default:
        return `${actor} performed an action`;
    }
  }
}