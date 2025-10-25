import { PoolClient } from 'pg';
import { BaseRepository, WhereClause, QueryOptions } from './BaseRepository';
import { RBT, CreateRBTRequest, UpdateRBTRequest, RBTAvailabilitySummary } from '../../models/RBT';
import { validateCreateRBTRequest, validateUpdateRBTRequest } from '../../models/RBT';
import { UserRepository } from './UserRepository';

export class RBTRepository extends BaseRepository<RBT> {
  private userRepository: UserRepository;

  constructor() {
    super('rbts');
    this.primaryKey = 'user_id';
    this.userRepository = new UserRepository();
  }

  /**
   * Create a new RBT with user account
   */
  public async create(data: CreateRBTRequest, client?: PoolClient): Promise<RBT> {
    // Validate input
    const errors = validateCreateRBTRequest(data);
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
        role: 'rbt',
        password: data.password
      }, transactionClient);

      // Create RBT record
      const rbtData = this.toDbObject({
        userId: user.id,
        licenseNumber: data.licenseNumber,
        qualifications: JSON.stringify(data.qualifications),
        hourlyRate: data.hourlyRate,
        hireDate: data.hireDate
      });

      const fields = Object.keys(rbtData);
      const values = Object.values(rbtData);
      const query = this.buildInsertQuery(fields);

      const rows = await this.executeQuery<any>(query, values, transactionClient);
      const rbtRecord = this.fromDbObject(rows[0]);

      // Combine user and RBT data
      return {
        ...user,
        licenseNumber: rbtRecord.licenseNumber,
        qualifications: JSON.parse(rbtRecord.qualifications || '[]'),
        hourlyRate: parseFloat(rbtRecord.hourlyRate),
        hireDate: rbtRecord.hireDate,
        terminationDate: rbtRecord.terminationDate
      } as RBT;
    };

    if (client) {
      return executeTransaction(client);
    } else {
      return this.transaction(executeTransaction);
    }
  }

  /**
   * Update an RBT
   */
  public async update(id: string, data: UpdateRBTRequest, client?: PoolClient): Promise<RBT | null> {
    // Validate input
    const errors = validateUpdateRBTRequest(data);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    const executeTransaction = async (transactionClient: PoolClient) => {
      // Check if RBT exists
      const existingRBT = await this.findById(id, transactionClient);
      if (!existingRBT) {
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

      // Update RBT-specific data
      const rbtUpdateData: any = {};
      if (data.licenseNumber !== undefined) rbtUpdateData.licenseNumber = data.licenseNumber;
      if (data.qualifications !== undefined) rbtUpdateData.qualifications = JSON.stringify(data.qualifications);
      if (data.hourlyRate !== undefined) rbtUpdateData.hourlyRate = data.hourlyRate;
      if (data.terminationDate !== undefined) rbtUpdateData.terminationDate = data.terminationDate;

      if (Object.keys(rbtUpdateData).length > 0) {
        const dbData = this.toDbObject(rbtUpdateData);
        const fields = Object.keys(dbData);
        const values = [...Object.values(dbData), id];
        const query = this.buildUpdateQuery(fields);

        await this.executeQuery(query, values, transactionClient);
      }

      // Return updated RBT
      return this.findById(id, transactionClient);
    };

    if (client) {
      return executeTransaction(client);
    } else {
      return this.transaction(executeTransaction);
    }
  }

  /**
   * Find RBT by ID with user data
   */
  public async findById(id: string, client?: PoolClient): Promise<RBT | null> {
    const query = `
      SELECT 
        u.*,
        r.license_number,
        r.qualifications,
        r.hourly_rate,
        r.hire_date,
        r.termination_date
      FROM users u
      JOIN rbts r ON u.id = r.user_id
      WHERE u.id = $1
    `;

    const rows = await this.executeQuery<any>(query, [id], client);
    if (rows.length === 0) {
      return null;
    }

    const row = this.fromDbObject(rows[0]);
    return {
      ...row,
      qualifications: JSON.parse(row.qualifications || '[]'),
      hourlyRate: parseFloat(row.hourlyRate)
    } as RBT;
  }

  /**
   * Find RBT by license number
   */
  public async findByLicenseNumber(licenseNumber: string, client?: PoolClient): Promise<RBT | null> {
    const query = `
      SELECT 
        u.*,
        r.license_number,
        r.qualifications,
        r.hourly_rate,
        r.hire_date,
        r.termination_date
      FROM users u
      JOIN rbts r ON u.id = r.user_id
      WHERE r.license_number = $1
    `;

    const rows = await this.executeQuery<any>(query, [licenseNumber], client);
    if (rows.length === 0) {
      return null;
    }

    const row = this.fromDbObject(rows[0]);
    return {
      ...row,
      qualifications: JSON.parse(row.qualifications || '[]'),
      hourlyRate: parseFloat(row.hourlyRate)
    } as RBT;
  }

  /**
   * Find all active RBTs
   */
  public async findActive(options: QueryOptions = {}, client?: PoolClient): Promise<RBT[]> {
    const query = `
      SELECT 
        u.*,
        r.license_number,
        r.qualifications,
        r.hourly_rate,
        r.hire_date,
        r.termination_date
      FROM users u
      JOIN rbts r ON u.id = r.user_id
      WHERE u.is_active = true AND r.termination_date IS NULL
      ${this.buildOrderClause(options)}
    `;

    const { clause: limitClause, values: limitValues } = this.buildLimitClause(options, 1);
    const finalQuery = `${query} ${limitClause}`;

    const rows = await this.executeQuery<any>(finalQuery, limitValues, client);
    return rows.map(row => {
      const rbt = this.fromDbObject(row);
      return {
        ...rbt,
        qualifications: JSON.parse(rbt.qualifications || '[]'),
        hourlyRate: parseFloat(rbt.hourlyRate)
      } as RBT;
    });
  }

  /**
   * Find RBTs by qualification
   */
  public async findByQualification(qualification: string, options: QueryOptions = {}, client?: PoolClient): Promise<RBT[]> {
    const query = `
      SELECT 
        u.*,
        r.license_number,
        r.qualifications,
        r.hourly_rate,
        r.hire_date,
        r.termination_date
      FROM users u
      JOIN rbts r ON u.id = r.user_id
      WHERE u.is_active = true 
        AND r.termination_date IS NULL
        AND r.qualifications::jsonb ? $1
      ${this.buildOrderClause(options)}
    `;

    const { clause: limitClause, values: limitValues } = this.buildLimitClause(options, 2);
    const finalQuery = `${query} ${limitClause}`;

    const rows = await this.executeQuery<any>(finalQuery, [qualification, ...limitValues], client);
    return rows.map(row => {
      const rbt = this.fromDbObject(row);
      return {
        ...rbt,
        qualifications: JSON.parse(rbt.qualifications || '[]'),
        hourlyRate: parseFloat(rbt.hourlyRate)
      } as RBT;
    });
  }

  /**
   * Search RBTs by name, email, or license number
   */
  public async search(searchTerm: string, options: QueryOptions = {}, client?: PoolClient): Promise<RBT[]> {
    const query = `
      SELECT 
        u.*,
        r.license_number,
        r.qualifications,
        r.hourly_rate,
        r.hire_date,
        r.termination_date
      FROM users u
      JOIN rbts r ON u.id = r.user_id
      WHERE (
        u.first_name ILIKE $1 OR 
        u.last_name ILIKE $1 OR 
        u.email ILIKE $1 OR
        r.license_number ILIKE $1 OR
        CONCAT(u.first_name, ' ', u.last_name) ILIKE $1
      )
      AND u.is_active = true 
      AND r.termination_date IS NULL
      ${this.buildOrderClause(options)}
    `;

    const searchPattern = `%${searchTerm}%`;
    const { clause: limitClause, values: limitValues } = this.buildLimitClause(options, 2);
    const finalQuery = `${query} ${limitClause}`;

    const rows = await this.executeQuery<any>(finalQuery, [searchPattern, ...limitValues], client);
    return rows.map(row => {
      const rbt = this.fromDbObject(row);
      return {
        ...rbt,
        qualifications: JSON.parse(rbt.qualifications || '[]'),
        hourlyRate: parseFloat(rbt.hourlyRate)
      } as RBT;
    });
  }

  /**
   * Get RBT availability summary
   */
  public async getAvailabilitySummary(rbtId: string, startDate: Date, endDate: Date, client?: PoolClient): Promise<RBTAvailabilitySummary | null> {
    const query = `
      WITH availability_hours AS (
        SELECT 
          COALESCE(SUM(
            EXTRACT(EPOCH FROM (a.end_time - a.start_time)) / 3600
          ), 0) as total_available_hours
        FROM availability_slots a
        WHERE a.rbt_id = $1 
          AND a.is_active = true
          AND (a.end_date IS NULL OR a.end_date >= $2)
          AND a.effective_date <= $3
      ),
      scheduled_hours AS (
        SELECT 
          COALESCE(SUM(
            EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600
          ), 0) as total_scheduled_hours
        FROM sessions s
        WHERE s.rbt_id = $1 
          AND s.status NOT IN ('cancelled')
          AND s.start_time >= $2 
          AND s.end_time <= $3
      )
      SELECT 
        $1 as rbt_id,
        ah.total_available_hours,
        sh.total_scheduled_hours,
        (ah.total_available_hours - sh.total_scheduled_hours) as available_hours,
        CASE 
          WHEN ah.total_available_hours > 0 
          THEN (sh.total_scheduled_hours / ah.total_available_hours * 100)
          ELSE 0 
        END as utilization_rate
      FROM availability_hours ah, scheduled_hours sh
    `;

    const rows = await this.executeQuery<any>(query, [rbtId, startDate, endDate], client);
    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      rbtId: row.rbt_id,
      totalHoursAvailable: parseFloat(row.total_available_hours),
      scheduledHours: parseFloat(row.total_scheduled_hours),
      availableHours: parseFloat(row.available_hours),
      utilizationRate: parseFloat(row.utilization_rate)
    };
  }

  /**
   * Terminate RBT employment
   */
  public async terminate(id: string, terminationDate: Date, client?: PoolClient): Promise<RBT | null> {
    const executeTransaction = async (transactionClient: PoolClient) => {
      // Update termination date
      const query = `
        UPDATE rbts 
        SET termination_date = $1, updated_at = NOW() 
        WHERE user_id = $2
      `;
      
      await this.executeQuery(query, [terminationDate, id], transactionClient);

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
   * Get RBTs available for a specific time slot
   */
  public async findAvailableForTimeSlot(
    startTime: Date, 
    endTime: Date, 
    excludeRbtIds: string[] = [],
    client?: PoolClient
  ): Promise<RBT[]> {
    const dayOfWeek = startTime.getDay();
    const startTimeStr = startTime.toTimeString().substring(0, 5);
    const endTimeStr = endTime.toTimeString().substring(0, 5);

    let excludeClause = '';
    let params = [dayOfWeek, startTimeStr, endTimeStr, startTime, endTime];
    
    if (excludeRbtIds.length > 0) {
      const placeholders = excludeRbtIds.map((_, index) => `$${params.length + index + 1}`).join(', ');
      excludeClause = `AND u.id NOT IN (${placeholders})`;
      params.push(...excludeRbtIds);
    }

    const query = `
      SELECT DISTINCT
        u.*,
        r.license_number,
        r.qualifications,
        r.hourly_rate,
        r.hire_date,
        r.termination_date
      FROM users u
      JOIN rbts r ON u.id = r.user_id
      JOIN availability_slots a ON r.user_id = a.rbt_id
      WHERE u.is_active = true 
        AND r.termination_date IS NULL
        AND a.is_active = true
        AND a.day_of_week = $1
        AND a.start_time <= $2
        AND a.end_time >= $3
        AND (a.end_date IS NULL OR a.end_date >= CURRENT_DATE)
        AND a.effective_date <= CURRENT_DATE
        ${excludeClause}
        AND NOT EXISTS (
          SELECT 1 FROM sessions s 
          WHERE s.rbt_id = r.user_id 
            AND s.status NOT IN ('cancelled')
            AND s.start_time < $5 
            AND s.end_time > $4
        )
      ORDER BY u.first_name, u.last_name
    `;

    const rows = await this.executeQuery<any>(query, params, client);
    return rows.map(row => {
      const rbt = this.fromDbObject(row);
      return {
        ...rbt,
        qualifications: JSON.parse(rbt.qualifications || '[]'),
        hourlyRate: parseFloat(rbt.hourlyRate)
      } as RBT;
    });
  }
}