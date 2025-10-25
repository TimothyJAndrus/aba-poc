import { PoolClient } from 'pg';
import { BaseRepository, WhereClause, QueryOptions } from './BaseRepository';
import { Session, CreateSessionRequest, UpdateSessionRequest, SessionConflict, SessionSummary } from '../../models/Session';
import { validateCreateSessionRequest, validateUpdateSessionRequest } from '../../models/Session';
import { SessionStatus } from '../../types';

export class SessionRepository extends BaseRepository<Session> {
  constructor() {
    super('sessions');
  }

  /**
   * Create a new session
   */
  public async create(data: CreateSessionRequest, client?: PoolClient): Promise<Session> {
    // Validate input
    const errors = validateCreateSessionRequest(data);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    // Check for conflicts if RBT is specified
    if (data.rbtId) {
      const conflicts = await this.checkConflicts(data.clientId, data.rbtId, data.startTime, data.endTime, client);
      if (conflicts.length > 0) {
        throw new Error(`Scheduling conflicts: ${conflicts.map(c => c.description).join(', ')}`);
      }
    }

    const dbData = this.toDbObject({
      clientId: data.clientId,
      rbtId: data.rbtId,
      startTime: data.startTime,
      endTime: data.endTime,
      status: 'scheduled',
      location: data.location,
      createdBy: data.createdBy
    });

    const fields = Object.keys(dbData);
    const values = Object.values(dbData);
    const query = this.buildInsertQuery(fields);

    const rows = await this.executeQuery<Session>(query, values, client);
    if (rows.length === 0) {
      throw new Error('Failed to create session');
    }
    return this.fromDbObject(rows[0]!) as Session;
  }

  /**
   * Update a session
   */
  public async update(id: string, data: UpdateSessionRequest, client?: PoolClient): Promise<Session | null> {
    // Validate input
    const errors = validateUpdateSessionRequest(data);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    // Check if session exists
    const existingSession = await this.findById(id, client);
    if (!existingSession) {
      return null;
    }

    // Check for conflicts if time or RBT is being changed
    if ((data.rbtId || data.startTime || data.endTime) && data.rbtId) {
      const startTime = data.startTime || existingSession.startTime;
      const endTime = data.endTime || existingSession.endTime;
      const rbtId = data.rbtId || existingSession.rbtId;
      
      const conflicts = await this.checkConflicts(existingSession.clientId, rbtId, startTime, endTime, client, id);
      if (conflicts.length > 0) {
        throw new Error(`Scheduling conflicts: ${conflicts.map(c => c.description).join(', ')}`);
      }
    }

    const updateData: any = { updatedBy: data.updatedBy };
    if (data.rbtId !== undefined) updateData.rbtId = data.rbtId;
    if (data.startTime !== undefined) updateData.startTime = data.startTime;
    if (data.endTime !== undefined) updateData.endTime = data.endTime;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.location !== undefined) updateData.location = data.location;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.cancellationReason !== undefined) updateData.cancellationReason = data.cancellationReason;
    if (data.completionNotes !== undefined) updateData.completionNotes = data.completionNotes;

    const dbData = this.toDbObject(updateData);
    const fields = Object.keys(dbData);
    const values = [...Object.values(dbData), id];
    const query = this.buildUpdateQuery(fields);

    const rows = await this.executeQuery<Session>(query, values, client);
    return rows.length > 0 ? this.fromDbObject(rows[0]!) as Session : null;
  }

  /**
   * Check for scheduling conflicts
   */
  public async checkConflicts(
    clientId: string, 
    rbtId: string, 
    startTime: Date, 
    endTime: Date, 
    client?: PoolClient,
    excludeSessionId?: string
  ): Promise<SessionConflict[]> {
    const conflicts: SessionConflict[] = [];

    // Check RBT double booking
    let rbtConflictQuery = `
      SELECT id, start_time, end_time FROM ${this.tableName}
      WHERE rbt_id = $1 
        AND status NOT IN ('cancelled')
        AND start_time < $3 
        AND end_time > $2
    `;
    
    let rbtParams = [rbtId, startTime, endTime];
    
    if (excludeSessionId) {
      rbtConflictQuery += ' AND id != $4';
      rbtParams.push(excludeSessionId);
    }

    const rbtConflicts = await this.executeQuery(rbtConflictQuery, rbtParams, client);
    
    for (const conflict of rbtConflicts) {
      conflicts.push({
        sessionId: conflict.id,
        conflictType: 'rbt_double_booked',
        conflictingSessionId: conflict.id,
        description: `RBT is already scheduled from ${conflict.start_time} to ${conflict.end_time}`
      });
    }

    // Check client double booking
    let clientConflictQuery = `
      SELECT id, start_time, end_time FROM ${this.tableName}
      WHERE client_id = $1 
        AND status NOT IN ('cancelled')
        AND start_time < $3 
        AND end_time > $2
    `;
    
    let clientParams = [clientId, startTime, endTime];
    
    if (excludeSessionId) {
      clientConflictQuery += ' AND id != $4';
      clientParams.push(excludeSessionId);
    }

    const clientConflicts = await this.executeQuery(clientConflictQuery, clientParams, client);
    
    for (const conflict of clientConflicts) {
      conflicts.push({
        sessionId: conflict.id,
        conflictType: 'client_double_booked',
        conflictingSessionId: conflict.id,
        description: `Client is already scheduled from ${conflict.start_time} to ${conflict.end_time}`
      });
    }

    // Check RBT availability
    const dayOfWeek = startTime.getDay();
    const startTimeStr = startTime.toTimeString().substring(0, 5);
    const endTimeStr = endTime.toTimeString().substring(0, 5);

    const availabilityQuery = `
      SELECT COUNT(*) as count FROM availability_slots
      WHERE rbt_id = $1 
        AND day_of_week = $2
        AND start_time <= $3
        AND end_time >= $4
        AND is_active = true
        AND effective_date <= $5
        AND (end_date IS NULL OR end_date >= $5)
    `;

    const availabilityRows = await this.executeQuery<{ count: string }>(
      availabilityQuery, 
      [rbtId, dayOfWeek, startTimeStr, endTimeStr, startTime.toISOString().split('T')[0]], 
      client
    );

    if (availabilityRows.length === 0 || parseInt(availabilityRows[0]!.count, 10) === 0) {
      conflicts.push({
        sessionId: '',
        conflictType: 'rbt_unavailable',
        description: `RBT is not available during the requested time slot`
      });
    }

    return conflicts;
  }

  /**
   * Find sessions by client ID
   */
  public async findByClientId(clientId: string, options: QueryOptions = {}, client?: PoolClient): Promise<Session[]> {
    const conditions: WhereClause[] = [
      { field: 'client_id', operator: '=', value: clientId }
    ];

    return this.findBy(conditions, options, client);
  }

  /**
   * Find sessions by RBT ID
   */
  public async findByRbtId(rbtId: string, options: QueryOptions = {}, client?: PoolClient): Promise<Session[]> {
    const conditions: WhereClause[] = [
      { field: 'rbt_id', operator: '=', value: rbtId }
    ];

    return this.findBy(conditions, options, client);
  }

  /**
   * Find sessions by status
   */
  public async findByStatus(status: SessionStatus, options: QueryOptions = {}, client?: PoolClient): Promise<Session[]> {
    const conditions: WhereClause[] = [
      { field: 'status', operator: '=', value: status }
    ];

    return this.findBy(conditions, options, client);
  }

  /**
   * Find active sessions by date range (excludes cancelled and no-show)
   */
  public async findActiveByDateRange(startDate: Date, endDate: Date, options: QueryOptions = {}, client?: PoolClient): Promise<Session[]> {
    const conditions: WhereClause[] = [
      { field: 'start_time', operator: '>=', value: startDate },
      { field: 'start_time', operator: '<=', value: endDate },
      { field: 'status', operator: '!=', value: 'cancelled' },
      { field: 'status', operator: '!=', value: 'no_show' }
    ];

    return this.findBy(conditions, options, client);
  }

  /**
   * Find sessions by date range
   */
  public async findByDateRange(startDate: Date, endDate: Date, options: QueryOptions = {}, client?: PoolClient): Promise<Session[]> {
    const conditions: WhereClause[] = [
      { field: 'start_time', operator: '>=', value: startDate },
      { field: 'end_time', operator: '<=', value: endDate }
    ];

    return this.findBy(conditions, options, client);
  }

  /**
   * Find sessions for a specific day
   */
  public async findByDate(date: Date, options: QueryOptions = {}, client?: PoolClient): Promise<Session[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return this.findByDateRange(startOfDay, endOfDay, options, client);
  }

  /**
   * Get session summaries with names
   */
  public async getSessionSummaries(
    startDate: Date, 
    endDate: Date, 
    options: QueryOptions = {}, 
    client?: PoolClient
  ): Promise<SessionSummary[]> {
    const query = `
      SELECT 
        s.id as session_id,
        CONCAT(c.first_name, ' ', c.last_name) as client_name,
        CONCAT(r.first_name, ' ', r.last_name) as rbt_name,
        s.start_time,
        s.end_time,
        s.status,
        EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 60 as duration,
        s.location
      FROM sessions s
      JOIN users c ON s.client_id = c.id
      JOIN users r ON s.rbt_id = r.id
      WHERE s.start_time >= $1 AND s.end_time <= $2
      ${this.buildOrderClause(options)}
    `;

    const { clause: limitClause, values: limitValues } = this.buildLimitClause(options, 3);
    const finalQuery = `${query} ${limitClause}`;

    const rows = await this.executeQuery<any>(finalQuery, [startDate, endDate, ...limitValues], client);
    return rows.map(row => ({
      sessionId: row.session_id,
      clientName: row.client_name,
      rbtName: row.rbt_name,
      startTime: row.start_time,
      endTime: row.end_time,
      status: row.status,
      duration: parseInt(row.duration, 10),
      location: row.location
    }));
  }

  /**
   * Cancel session
   */
  public async cancel(id: string, reason: string, cancelledBy: string, client?: PoolClient): Promise<Session | null> {
    return this.update(id, {
      status: 'cancelled',
      cancellationReason: reason,
      updatedBy: cancelledBy
    }, client);
  }

  /**
   * Complete session
   */
  public async complete(id: string, completionNotes: string, completedBy: string, client?: PoolClient): Promise<Session | null> {
    return this.update(id, {
      status: 'completed',
      completionNotes,
      updatedBy: completedBy
    }, client);
  }

  /**
   * Mark session as no-show
   */
  public async markNoShow(id: string, updatedBy: string, client?: PoolClient): Promise<Session | null> {
    return this.update(id, {
      status: 'no_show',
      updatedBy
    }, client);
  }

  /**
   * Reschedule session
   */
  public async reschedule(
    id: string, 
    newStartTime: Date, 
    newEndTime: Date, 
    newRbtId?: string, 
    updatedBy?: string,
    client?: PoolClient
  ): Promise<Session | null> {
    const updateData: UpdateSessionRequest = {
      startTime: newStartTime,
      endTime: newEndTime,
      updatedBy: updatedBy || 'system'
    };

    if (newRbtId) {
      updateData.rbtId = newRbtId;
    }

    return this.update(id, updateData, client);
  }

  /**
   * Get upcoming sessions for RBT
   */
  public async getUpcomingForRbt(rbtId: string, days: number = 7, client?: PoolClient): Promise<Session[]> {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    const conditions: WhereClause[] = [
      { field: 'rbt_id', operator: '=', value: rbtId },
      { field: 'start_time', operator: '>=', value: startDate },
      { field: 'start_time', operator: '<=', value: endDate },
      { field: 'status', operator: 'IN', value: ['scheduled', 'confirmed'] }
    ];

    return this.findBy(conditions, { orderBy: 'start_time', orderDirection: 'ASC' }, client);
  }

  /**
   * Get upcoming sessions for client
   */
  public async getUpcomingForClient(clientId: string, days: number = 7, client?: PoolClient): Promise<Session[]> {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    const conditions: WhereClause[] = [
      { field: 'client_id', operator: '=', value: clientId },
      { field: 'start_time', operator: '>=', value: startDate },
      { field: 'start_time', operator: '<=', value: endDate },
      { field: 'status', operator: 'IN', value: ['scheduled', 'confirmed'] }
    ];

    return this.findBy(conditions, { orderBy: 'start_time', orderDirection: 'ASC' }, client);
  }

  /**
   * Get sessions requiring confirmation
   */
  public async getRequiringConfirmation(hoursAhead: number = 24, client?: PoolClient): Promise<Session[]> {
    const confirmationTime = new Date();
    confirmationTime.setHours(confirmationTime.getHours() + hoursAhead);

    const conditions: WhereClause[] = [
      { field: 'status', operator: '=', value: 'scheduled' },
      { field: 'start_time', operator: '<=', value: confirmationTime },
      { field: 'start_time', operator: '>=', value: new Date() }
    ];

    return this.findBy(conditions, { orderBy: 'start_time', orderDirection: 'ASC' }, client);
  }
}