import { PoolClient } from 'pg';
import { BaseRepository, WhereClause, QueryOptions } from './BaseRepository';
import { Team, CreateTeamRequest, UpdateTeamRequest, TeamHistory, TeamChange } from '../../models/Team';
import { validateCreateTeamRequest, validateUpdateTeamRequest } from '../../models/Team';

export class TeamRepository extends BaseRepository<Team> {
  constructor() {
    super('teams');
  }

  /**
   * Create a new team
   */
  public async create(data: CreateTeamRequest, client?: PoolClient): Promise<Team> {
    // Validate input
    const errors = validateCreateTeamRequest(data);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    // Check if client already has an active team
    const existingTeam = await this.findActiveByClientId(data.clientId, client);
    if (existingTeam) {
      throw new Error('Client already has an active team');
    }

    const dbData = this.toDbObject({
      clientId: data.clientId,
      rbtIds: JSON.stringify(data.rbtIds),
      primaryRbtId: data.primaryRbtId,
      effectiveDate: data.effectiveDate,
      isActive: true,
      createdBy: data.createdBy
    });

    const fields = Object.keys(dbData);
    const values = Object.values(dbData);
    const query = this.buildInsertQuery(fields);

    const rows = await this.executeQuery<any>(query, values, client);
    const team = this.fromDbObject(rows[0]);
    
    return {
      ...team,
      rbtIds: JSON.parse(team.rbtIds || '[]')
    } as Team;
  }

  /**
   * Update a team
   */
  public async update(id: string, data: UpdateTeamRequest, client?: PoolClient): Promise<Team | null> {
    // Validate input
    const errors = validateUpdateTeamRequest(data);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    // Check if team exists
    const existingTeam = await this.findById(id, client);
    if (!existingTeam) {
      return null;
    }

    const updateData: any = { updatedBy: data.updatedBy };
    if (data.rbtIds !== undefined) updateData.rbtIds = JSON.stringify(data.rbtIds);
    if (data.primaryRbtId !== undefined) updateData.primaryRbtId = data.primaryRbtId;
    if (data.endDate !== undefined) updateData.endDate = data.endDate;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const dbData = this.toDbObject(updateData);
    const fields = Object.keys(dbData);
    const values = [...Object.values(dbData), id];
    const query = this.buildUpdateQuery(fields);

    const rows = await this.executeQuery<any>(query, values, client);
    if (rows.length === 0) {
      return null;
    }

    const team = this.fromDbObject(rows[0]);
    return {
      ...team,
      rbtIds: JSON.parse(team.rbtIds || '[]')
    } as Team;
  }

  /**
   * Find team by ID
   */
  public override async findById(id: string, client?: PoolClient): Promise<Team | null> {
    const query = `SELECT * FROM ${this.tableName} WHERE id = $1`;
    const rows = await this.executeQuery<any>(query, [id], client);
    
    if (rows.length === 0) {
      return null;
    }

    const team = this.fromDbObject(rows[0]);
    return {
      ...team,
      rbtIds: JSON.parse(team.rbtIds || '[]')
    } as Team;
  }

  /**
   * Find active team by client ID
   */
  public async findActiveByClientId(clientId: string, client?: PoolClient): Promise<Team | null> {
    const conditions: WhereClause[] = [
      { field: 'client_id', operator: '=', value: clientId },
      { field: 'is_active', operator: '=', value: true },
      { field: 'effective_date', operator: '<=', value: new Date() }
    ];

    const query = `
      SELECT * FROM ${this.tableName} 
      WHERE client_id = $1 
        AND is_active = true 
        AND effective_date <= CURRENT_DATE
        AND (end_date IS NULL OR end_date >= CURRENT_DATE)
      ORDER BY effective_date DESC
      LIMIT 1
    `;

    const rows = await this.executeQuery<any>(query, [clientId], client);
    
    if (rows.length === 0) {
      return null;
    }

    const team = this.fromDbObject(rows[0]);
    return {
      ...team,
      rbtIds: JSON.parse(team.rbtIds || '[]')
    } as Team;
  }

  /**
   * Find teams by RBT ID
   */
  public async findByRbtId(rbtId: string, options: QueryOptions = {}, client?: PoolClient): Promise<Team[]> {
    const query = `
      SELECT * FROM ${this.tableName} 
      WHERE rbt_ids::jsonb ? $1
        AND is_active = true
        AND (end_date IS NULL OR end_date >= CURRENT_DATE)
      ${this.buildOrderClause(options)}
    `;

    const { clause: limitClause, values: limitValues } = this.buildLimitClause(options, 2);
    const finalQuery = `${query} ${limitClause}`;

    const rows = await this.executeQuery<any>(finalQuery, [rbtId, ...limitValues], client);
    return rows.map(row => {
      const team = this.fromDbObject(row);
      return {
        ...team,
        rbtIds: JSON.parse(team.rbtIds || '[]')
      } as Team;
    });
  }

  /**
   * Find teams by primary RBT ID
   */
  public async findByPrimaryRbtId(primaryRbtId: string, options: QueryOptions = {}, client?: PoolClient): Promise<Team[]> {
    const conditions: WhereClause[] = [
      { field: 'primary_rbt_id', operator: '=', value: primaryRbtId },
      { field: 'is_active', operator: '=', value: true }
    ];

    return this.findBy(conditions, options, client);
  }

  /**
   * Get team with member details
   */
  public async findWithMemberDetails(id: string, client?: PoolClient): Promise<any | null> {
    const query = `
      SELECT 
        t.*,
        c.first_name as client_first_name,
        c.last_name as client_last_name,
        c.email as client_email,
        pr.first_name as primary_rbt_first_name,
        pr.last_name as primary_rbt_last_name,
        pr.email as primary_rbt_email,
        r.license_number as primary_rbt_license
      FROM teams t
      JOIN users c ON t.client_id = c.id
      JOIN users pr ON t.primary_rbt_id = pr.id
      JOIN rbts r ON pr.id = r.user_id
      WHERE t.id = $1
    `;

    const rows = await this.executeQuery<any>(query, [id], client);
    
    if (rows.length === 0) {
      return null;
    }

    const row = this.fromDbObject(rows[0]);
    return {
      ...row,
      rbtIds: JSON.parse(row.rbtIds || '[]'),
      client: {
        id: row.clientId,
        firstName: row.clientFirstName,
        lastName: row.clientLastName,
        email: row.clientEmail
      },
      primaryRbt: {
        id: row.primaryRbtId,
        firstName: row.primaryRbtFirstName,
        lastName: row.primaryRbtLastName,
        email: row.primaryRbtEmail,
        licenseNumber: row.primaryRbtLicense
      }
    };
  }

  /**
   * Add RBT to team
   */
  public async addRbtToTeam(teamId: string, rbtId: string, updatedBy: string, client?: PoolClient): Promise<Team | null> {
    const executeTransaction = async (transactionClient: PoolClient) => {
      const team = await this.findById(teamId, transactionClient);
      if (!team) {
        throw new Error('Team not found');
      }

      if (team.rbtIds.includes(rbtId)) {
        throw new Error('RBT is already a member of this team');
      }

      const updatedRbtIds = [...team.rbtIds, rbtId];
      return this.update(teamId, { rbtIds: updatedRbtIds, updatedBy }, transactionClient);
    };

    if (client) {
      return executeTransaction(client);
    } else {
      return this.transaction(executeTransaction);
    }
  }

  /**
   * Remove RBT from team
   */
  public async removeRbtFromTeam(teamId: string, rbtId: string, updatedBy: string, client?: PoolClient): Promise<Team | null> {
    const executeTransaction = async (transactionClient: PoolClient) => {
      const team = await this.findById(teamId, transactionClient);
      if (!team) {
        throw new Error('Team not found');
      }

      if (!team.rbtIds.includes(rbtId)) {
        throw new Error('RBT is not a member of this team');
      }

      if (team.primaryRbtId === rbtId) {
        throw new Error('Cannot remove primary RBT. Change primary RBT first.');
      }

      const updatedRbtIds = team.rbtIds.filter(id => id !== rbtId);
      return this.update(teamId, { rbtIds: updatedRbtIds, updatedBy }, transactionClient);
    };

    if (client) {
      return executeTransaction(client);
    } else {
      return this.transaction(executeTransaction);
    }
  }

  /**
   * Change primary RBT
   */
  public async changePrimaryRbt(teamId: string, newPrimaryRbtId: string, updatedBy: string, client?: PoolClient): Promise<Team | null> {
    const executeTransaction = async (transactionClient: PoolClient) => {
      const team = await this.findById(teamId, transactionClient);
      if (!team) {
        throw new Error('Team not found');
      }

      if (!team.rbtIds.includes(newPrimaryRbtId)) {
        throw new Error('New primary RBT must be a member of the team');
      }

      return this.update(teamId, { primaryRbtId: newPrimaryRbtId, updatedBy }, transactionClient);
    };

    if (client) {
      return executeTransaction(client);
    } else {
      return this.transaction(executeTransaction);
    }
  }

  /**
   * End team assignment
   */
  public async endTeam(teamId: string, endDate: Date, updatedBy: string, client?: PoolClient): Promise<Team | null> {
    return this.update(teamId, { endDate, isActive: false, updatedBy }, client);
  }

  /**
   * Get team history for a client
   */
  public async getClientTeamHistory(clientId: string, client?: PoolClient): Promise<TeamHistory> {
    const query = `
      SELECT 
        t.*,
        se.event_type,
        se.old_values,
        se.new_values,
        se.reason,
        se.created_at as change_date,
        se.created_by as changed_by
      FROM teams t
      LEFT JOIN schedule_events se ON (
        se.client_id = t.client_id 
        AND se.event_type IN ('team_created', 'team_updated', 'team_ended')
      )
      WHERE t.client_id = $1
      ORDER BY t.effective_date DESC, se.created_at DESC
    `;

    const rows = await this.executeQuery<any>(query, [clientId], client);
    
    const changes: TeamChange[] = rows
      .filter(row => row.eventType)
      .map(row => ({
        changeDate: row.changeDate,
        changeType: this.mapEventTypeToChangeType(row.eventType),
        rbtId: row.newValues?.rbtId,
        previousPrimaryRbtId: row.oldValues?.primaryRbtId,
        newPrimaryRbtId: row.newValues?.primaryRbtId,
        changedBy: row.changedBy,
        reason: row.reason
      }));

    return {
      teamId: rows[0]?.id || '',
      clientId,
      changes
    };
  }

  /**
   * Get active teams with low RBT count
   */
  public async findTeamsNeedingRbts(minRbtCount: number = 2, options: QueryOptions = {}, client?: PoolClient): Promise<Team[]> {
    const query = `
      SELECT * FROM ${this.tableName} 
      WHERE is_active = true 
        AND (end_date IS NULL OR end_date >= CURRENT_DATE)
        AND jsonb_array_length(rbt_ids) < $1
      ${this.buildOrderClause(options)}
    `;

    const { clause: limitClause, values: limitValues } = this.buildLimitClause(options, 2);
    const finalQuery = `${query} ${limitClause}`;

    const rows = await this.executeQuery<any>(finalQuery, [minRbtCount, ...limitValues], client);
    return rows.map(row => {
      const team = this.fromDbObject(row);
      return {
        ...team,
        rbtIds: JSON.parse(team.rbtIds || '[]')
      } as Team;
    });
  }

  /**
   * Get teams by effective date range
   */
  public async findByDateRange(startDate: Date, endDate: Date, options: QueryOptions = {}, client?: PoolClient): Promise<Team[]> {
    const conditions: WhereClause[] = [
      { field: 'effective_date', operator: '>=', value: startDate },
      { field: 'effective_date', operator: '<=', value: endDate }
    ];

    return this.findBy(conditions, options, client);
  }

  /**
   * Map event type to change type
   */
  private mapEventTypeToChangeType(eventType: string): TeamChange['changeType'] {
    switch (eventType) {
      case 'team_created': return 'team_created';
      case 'team_ended': return 'team_ended';
      default: return 'team_created'; // Default fallback
    }
  }
}