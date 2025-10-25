import { PoolClient } from 'pg';
import { BaseRepository, WhereClause, QueryOptions } from './BaseRepository';
import { Client, CreateClientRequest, UpdateClientRequest, ClientScheduleSummary } from '../../models/Client';
import { validateCreateClientRequest, validateUpdateClientRequest } from '../../models/Client';
import { UserRepository } from './UserRepository';

export class ClientRepository extends BaseRepository<Client> {
  private userRepository: UserRepository;

  constructor() {
    super('clients');
    this.primaryKey = 'user_id';
    this.userRepository = new UserRepository();
  }

  /**
   * Create a new client with user account
   */
  public async create(data: CreateClientRequest, client?: PoolClient): Promise<Client> {
    // Validate input
    const errors = validateCreateClientRequest(data);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    const executeTransaction = async (transactionClient: PoolClient) => {
      // Create user account first
      const user = await this.userRepository.create({
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        role: 'client_family',
        password: 'temp_password' // This should be handled by a separate password setup process
      }, transactionClient);

      // Create client record
      const clientData = this.toDbObject({
        userId: user.id,
        dateOfBirth: data.dateOfBirth,
        guardianContact: JSON.stringify(data.guardianContact),
        specialNeeds: JSON.stringify(data.specialNeeds),
        preferredSchedule: JSON.stringify(data.preferredSchedule),
        enrollmentDate: data.enrollmentDate
      });

      const fields = Object.keys(clientData);
      const values = Object.values(clientData);
      const query = this.buildInsertQuery(fields);

      const rows = await this.executeQuery<any>(query, values, transactionClient);
      const clientRecord = this.fromDbObject(rows[0]);

      // Combine user and client data
      return {
        ...user,
        dateOfBirth: clientRecord.dateOfBirth,
        guardianContact: JSON.parse(clientRecord.guardianContact || '{}'),
        specialNeeds: JSON.parse(clientRecord.specialNeeds || '[]'),
        preferredSchedule: JSON.parse(clientRecord.preferredSchedule || '[]'),
        enrollmentDate: clientRecord.enrollmentDate,
        dischargeDate: clientRecord.dischargeDate
      } as Client;
    };

    if (client) {
      return executeTransaction(client);
    } else {
      return this.transaction(executeTransaction);
    }
  }

  /**
   * Update a client
   */
  public async update(id: string, data: UpdateClientRequest, client?: PoolClient): Promise<Client | null> {
    // Validate input
    const errors = validateUpdateClientRequest(data);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    const executeTransaction = async (transactionClient: PoolClient) => {
      // Check if client exists
      const existingClient = await this.findById(id, transactionClient);
      if (!existingClient) {
        return null;
      }

      // Update user data if provided
      const userUpdateData: any = {};
      if (data.firstName !== undefined) userUpdateData.firstName = data.firstName;
      if (data.lastName !== undefined) userUpdateData.lastName = data.lastName;
      if (data.phone !== undefined) userUpdateData.phone = data.phone;
      if (data.isActive !== undefined) userUpdateData.isActive = data.isActive;

      if (Object.keys(userUpdateData).length > 0) {
        await this.userRepository.update(id, userUpdateData, transactionClient);
      }

      // Update client-specific data
      const clientUpdateData: any = {};
      if (data.guardianContact !== undefined) clientUpdateData.guardianContact = JSON.stringify(data.guardianContact);
      if (data.specialNeeds !== undefined) clientUpdateData.specialNeeds = JSON.stringify(data.specialNeeds);
      if (data.preferredSchedule !== undefined) clientUpdateData.preferredSchedule = JSON.stringify(data.preferredSchedule);
      if (data.dischargeDate !== undefined) clientUpdateData.dischargeDate = data.dischargeDate;

      if (Object.keys(clientUpdateData).length > 0) {
        const dbData = this.toDbObject(clientUpdateData);
        const fields = Object.keys(dbData);
        const values = [...Object.values(dbData), id];
        const query = this.buildUpdateQuery(fields);

        await this.executeQuery(query, values, transactionClient);
      }

      // Return updated client
      return this.findById(id, transactionClient);
    };

    if (client) {
      return executeTransaction(client);
    } else {
      return this.transaction(executeTransaction);
    }
  }

  /**
   * Find client by ID with user data
   */
  public async findById(id: string, client?: PoolClient): Promise<Client | null> {
    const query = `
      SELECT 
        u.*,
        c.date_of_birth,
        c.guardian_contact,
        c.special_needs,
        c.preferred_schedule,
        c.enrollment_date,
        c.discharge_date
      FROM users u
      JOIN clients c ON u.id = c.user_id
      WHERE u.id = $1
    `;

    const rows = await this.executeQuery<any>(query, [id], client);
    if (rows.length === 0) {
      return null;
    }

    const row = this.fromDbObject(rows[0]);
    return {
      ...row,
      guardianContact: JSON.parse(row.guardianContact || '{}'),
      specialNeeds: JSON.parse(row.specialNeeds || '[]'),
      preferredSchedule: JSON.parse(row.preferredSchedule || '[]')
    } as Client;
  }

  /**
   * Find all active clients
   */
  public async findActive(options: QueryOptions = {}, client?: PoolClient): Promise<Client[]> {
    const query = `
      SELECT 
        u.*,
        c.date_of_birth,
        c.guardian_contact,
        c.special_needs,
        c.preferred_schedule,
        c.enrollment_date,
        c.discharge_date
      FROM users u
      JOIN clients c ON u.id = c.user_id
      WHERE u.is_active = true AND c.discharge_date IS NULL
      ${this.buildOrderClause(options)}
    `;

    const { clause: limitClause, values: limitValues } = this.buildLimitClause(options, 1);
    const finalQuery = `${query} ${limitClause}`;

    const rows = await this.executeQuery<any>(finalQuery, limitValues, client);
    return rows.map(row => {
      const clientData = this.fromDbObject(row);
      return {
        ...clientData,
        guardianContact: JSON.parse(clientData.guardianContact || '{}'),
        specialNeeds: JSON.parse(clientData.specialNeeds || '[]'),
        preferredSchedule: JSON.parse(clientData.preferredSchedule || '[]')
      } as Client;
    });
  }

  /**
   * Find clients by age range
   */
  public async findByAgeRange(minAge: number, maxAge: number, options: QueryOptions = {}, client?: PoolClient): Promise<Client[]> {
    const minDate = new Date();
    minDate.setFullYear(minDate.getFullYear() - maxAge);
    
    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() - minAge);

    const query = `
      SELECT 
        u.*,
        c.date_of_birth,
        c.guardian_contact,
        c.special_needs,
        c.preferred_schedule,
        c.enrollment_date,
        c.discharge_date
      FROM users u
      JOIN clients c ON u.id = c.user_id
      WHERE u.is_active = true 
        AND c.discharge_date IS NULL
        AND c.date_of_birth BETWEEN $1 AND $2
      ${this.buildOrderClause(options)}
    `;

    const { clause: limitClause, values: limitValues } = this.buildLimitClause(options, 3);
    const finalQuery = `${query} ${limitClause}`;

    const rows = await this.executeQuery<any>(finalQuery, [minDate, maxDate, ...limitValues], client);
    return rows.map(row => {
      const clientData = this.fromDbObject(row);
      return {
        ...clientData,
        guardianContact: JSON.parse(clientData.guardianContact || '{}'),
        specialNeeds: JSON.parse(clientData.specialNeeds || '[]'),
        preferredSchedule: JSON.parse(clientData.preferredSchedule || '[]')
      } as Client;
    });
  }

  /**
   * Find clients by special need
   */
  public async findBySpecialNeed(specialNeed: string, options: QueryOptions = {}, client?: PoolClient): Promise<Client[]> {
    const query = `
      SELECT 
        u.*,
        c.date_of_birth,
        c.guardian_contact,
        c.special_needs,
        c.preferred_schedule,
        c.enrollment_date,
        c.discharge_date
      FROM users u
      JOIN clients c ON u.id = c.user_id
      WHERE u.is_active = true 
        AND c.discharge_date IS NULL
        AND c.special_needs::jsonb ? $1
      ${this.buildOrderClause(options)}
    `;

    const { clause: limitClause, values: limitValues } = this.buildLimitClause(options, 2);
    const finalQuery = `${query} ${limitClause}`;

    const rows = await this.executeQuery<any>(finalQuery, [specialNeed, ...limitValues], client);
    return rows.map(row => {
      const clientData = this.fromDbObject(row);
      return {
        ...clientData,
        guardianContact: JSON.parse(clientData.guardianContact || '{}'),
        specialNeeds: JSON.parse(clientData.specialNeeds || '[]'),
        preferredSchedule: JSON.parse(clientData.preferredSchedule || '[]')
      } as Client;
    });
  }

  /**
   * Search clients by name or guardian contact
   */
  public async search(searchTerm: string, options: QueryOptions = {}, client?: PoolClient): Promise<Client[]> {
    const query = `
      SELECT 
        u.*,
        c.date_of_birth,
        c.guardian_contact,
        c.special_needs,
        c.preferred_schedule,
        c.enrollment_date,
        c.discharge_date
      FROM users u
      JOIN clients c ON u.id = c.user_id
      WHERE (
        u.first_name ILIKE $1 OR 
        u.last_name ILIKE $1 OR 
        u.email ILIKE $1 OR
        c.guardian_contact::text ILIKE $1 OR
        CONCAT(u.first_name, ' ', u.last_name) ILIKE $1
      )
      AND u.is_active = true 
      AND c.discharge_date IS NULL
      ${this.buildOrderClause(options)}
    `;

    const searchPattern = `%${searchTerm}%`;
    const { clause: limitClause, values: limitValues } = this.buildLimitClause(options, 2);
    const finalQuery = `${query} ${limitClause}`;

    const rows = await this.executeQuery<any>(finalQuery, [searchPattern, ...limitValues], client);
    return rows.map(row => {
      const clientData = this.fromDbObject(row);
      return {
        ...clientData,
        guardianContact: JSON.parse(clientData.guardianContact || '{}'),
        specialNeeds: JSON.parse(clientData.specialNeeds || '[]'),
        preferredSchedule: JSON.parse(clientData.preferredSchedule || '[]')
      } as Client;
    });
  }

  /**
   * Get client schedule summary
   */
  public async getScheduleSummary(clientId: string, startDate: Date, endDate: Date, client?: PoolClient): Promise<ClientScheduleSummary | null> {
    const query = `
      WITH client_sessions AS (
        SELECT 
          s.client_id,
          COUNT(*) as total_sessions,
          SUM(EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600) as total_hours,
          COUNT(DISTINCT s.rbt_id) as unique_rbts
        FROM sessions s
        WHERE s.client_id = $1 
          AND s.status NOT IN ('cancelled')
          AND s.start_time >= $2 
          AND s.end_time <= $3
        GROUP BY s.client_id
      ),
      preferred_hours AS (
        SELECT 
          c.user_id,
          COALESCE(
            (
              SELECT SUM(
                EXTRACT(EPOCH FROM (
                  (ps->>'preferredEndTime')::time - (ps->>'preferredStartTime')::time
                )) / 3600
              )
              FROM jsonb_array_elements(c.preferred_schedule) ps
            ), 0
          ) * 5 as weekly_preferred_hours -- Multiply by 5 for weekdays
        FROM clients c
        WHERE c.user_id = $1
      ),
      continuity_data AS (
        SELECT 
          s.client_id,
          s.rbt_id,
          COUNT(*) as sessions_with_rbt,
          ROW_NUMBER() OVER (PARTITION BY s.client_id ORDER BY COUNT(*) DESC) as rbt_rank
        FROM sessions s
        WHERE s.client_id = $1 
          AND s.status = 'completed'
          AND s.start_time >= $2 - INTERVAL '30 days' -- Include last 30 days for continuity
          AND s.end_time <= $3
        GROUP BY s.client_id, s.rbt_id
      )
      SELECT 
        $1 as client_id,
        COALESCE(cs.total_hours, 0) as weekly_hours_scheduled,
        COALESCE(ph.weekly_preferred_hours, 0) as preferred_hours,
        CASE 
          WHEN ph.weekly_preferred_hours > 0 
          THEN (cs.total_hours / ph.weekly_preferred_hours * 100)
          ELSE 0 
        END as scheduling_efficiency,
        CASE 
          WHEN cs.total_sessions > 0 AND cs.unique_rbts > 0
          THEN (
            SELECT COALESCE(AVG(sessions_with_rbt::float / cs.total_sessions * 100), 0)
            FROM continuity_data 
            WHERE rbt_rank <= 2 -- Top 2 RBTs for continuity
          )
          ELSE 0 
        END as continuity_score
      FROM client_sessions cs
      FULL OUTER JOIN preferred_hours ph ON cs.client_id = ph.user_id
    `;

    const rows = await this.executeQuery<any>(query, [clientId, startDate, endDate], client);
    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      clientId: row.client_id,
      weeklyHoursScheduled: parseFloat(row.weekly_hours_scheduled || '0'),
      preferredHours: parseFloat(row.preferred_hours || '0'),
      schedulingEfficiency: parseFloat(row.scheduling_efficiency || '0'),
      continuityScore: parseFloat(row.continuity_score || '0')
    };
  }

  /**
   * Discharge client
   */
  public async discharge(id: string, dischargeDate: Date, client?: PoolClient): Promise<Client | null> {
    const executeTransaction = async (transactionClient: PoolClient) => {
      // Update discharge date
      const query = `
        UPDATE clients 
        SET discharge_date = $1, updated_at = NOW() 
        WHERE user_id = $2
      `;
      
      await this.executeQuery(query, [dischargeDate, id], transactionClient);

      // Deactivate user account
      await this.userRepository.deactivate(id, transactionClient);

      return this.findById(id, transactionClient);
    };

    if (client) {
      return executeTransaction(client);
    } else {
      return this.transaction(executeTransaction);
    }
  }

  /**
   * Get clients needing team assignment
   */
  public async findWithoutActiveTeam(options: QueryOptions = {}, client?: PoolClient): Promise<Client[]> {
    const query = `
      SELECT 
        u.*,
        c.date_of_birth,
        c.guardian_contact,
        c.special_needs,
        c.preferred_schedule,
        c.enrollment_date,
        c.discharge_date
      FROM users u
      JOIN clients c ON u.id = c.user_id
      WHERE u.is_active = true 
        AND c.discharge_date IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM teams t 
          WHERE t.client_id = c.user_id 
            AND t.is_active = true 
            AND (t.end_date IS NULL OR t.end_date >= CURRENT_DATE)
        )
      ${this.buildOrderClause(options)}
    `;

    const { clause: limitClause, values: limitValues } = this.buildLimitClause(options, 1);
    const finalQuery = `${query} ${limitClause}`;

    const rows = await this.executeQuery<any>(finalQuery, limitValues, client);
    return rows.map(row => {
      const clientData = this.fromDbObject(row);
      return {
        ...clientData,
        guardianContact: JSON.parse(clientData.guardianContact || '{}'),
        specialNeeds: JSON.parse(clientData.specialNeeds || '[]'),
        preferredSchedule: JSON.parse(clientData.preferredSchedule || '[]')
      } as Client;
    });
  }
}