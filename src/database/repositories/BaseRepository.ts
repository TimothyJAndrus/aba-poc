import { PoolClient } from 'pg';
import { getDatabase } from '../connection';
import { BaseEntity } from '../../types';
import { logger } from '../../utils/logger';

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
}

export interface WhereClause {
  field: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'IN' | 'LIKE' | 'ILIKE';
  value: any;
}

export abstract class BaseRepository<T extends BaseEntity> {
  protected tableName: string;
  protected primaryKey: string = 'id';

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  /**
   * Get database instance
   */
  protected getDb() {
    return getDatabase();
  }

  /**
   * Build WHERE clause from conditions
   */
  protected buildWhereClause(conditions: WhereClause[]): { whereClause: string; values: any[] } {
    if (conditions.length === 0) {
      return { whereClause: '', values: [] };
    }

    const clauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const condition of conditions) {
      const { field, operator, value } = condition;
      
      if (operator === 'IN') {
        if (!Array.isArray(value) || value.length === 0) {
          throw new Error('IN operator requires non-empty array');
        }
        const placeholders = value.map(() => `$${paramIndex++}`).join(', ');
        clauses.push(`${field} IN (${placeholders})`);
        values.push(...value);
      } else {
        clauses.push(`${field} ${operator} $${paramIndex++}`);
        values.push(value);
      }
    }

    return {
      whereClause: `WHERE ${clauses.join(' AND ')}`,
      values
    };
  }

  /**
   * Build ORDER BY clause
   */
  protected buildOrderClause(options: QueryOptions): string {
    if (!options.orderBy) {
      return '';
    }

    const direction = options.orderDirection || 'ASC';
    return `ORDER BY ${options.orderBy} ${direction}`;
  }

  /**
   * Build LIMIT and OFFSET clause
   */
  protected buildLimitClause(options: QueryOptions, valueIndex: number): { clause: string; values: any[] } {
    const clauses: string[] = [];
    const values: any[] = [];

    if (options.limit !== undefined) {
      clauses.push(`LIMIT $${valueIndex++}`);
      values.push(options.limit);
    }

    if (options.offset !== undefined) {
      clauses.push(`OFFSET $${valueIndex++}`);
      values.push(options.offset);
    }

    return {
      clause: clauses.join(' '),
      values
    };
  }

  /**
   * Execute a query with error handling
   */
  protected async executeQuery<R = any>(
    query: string, 
    params: any[] = [], 
    client?: PoolClient
  ): Promise<R[]> {
    try {
      if (client) {
        const result = await client.query(query, params);
        return result.rows;
      } else {
        return await this.getDb().query<R>(query, params);
      }
    } catch (error) {
      logger.error(`Query execution failed in ${this.tableName}:`, {
        query,
        params,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  /**
   * Find a single record by ID
   */
  public async findById(id: string, client?: PoolClient): Promise<T | null> {
    const query = `SELECT * FROM ${this.tableName} WHERE ${this.primaryKey} = $1`;
    const rows = await this.executeQuery<T>(query, [id], client);
    return rows.length > 0 ? (rows[0] ?? null) : null;
  }

  /**
   * Find records by conditions
   */
  public async findBy(
    conditions: WhereClause[], 
    options: QueryOptions = {},
    client?: PoolClient
  ): Promise<T[]> {
    const { whereClause, values } = this.buildWhereClause(conditions);
    const orderClause = this.buildOrderClause(options);
    const { clause: limitClause, values: limitValues } = this.buildLimitClause(options, values.length + 1);

    const query = `
      SELECT * FROM ${this.tableName} 
      ${whereClause} 
      ${orderClause} 
      ${limitClause}
    `.trim();

    return this.executeQuery<T>(query, [...values, ...limitValues], client);
  }

  /**
   * Find all records
   */
  public async findAll(options: QueryOptions = {}, client?: PoolClient): Promise<T[]> {
    return this.findBy([], options, client);
  }

  /**
   * Count records by conditions
   */
  public async countBy(conditions: WhereClause[], client?: PoolClient): Promise<number> {
    const { whereClause, values } = this.buildWhereClause(conditions);
    const query = `SELECT COUNT(*) as count FROM ${this.tableName} ${whereClause}`;
    
    const rows = await this.executeQuery<{ count: string }>(query, values, client);
    return parseInt(rows[0]?.count ?? '0', 10);
  }

  /**
   * Count all records
   */
  public async countAll(client?: PoolClient): Promise<number> {
    return this.countBy([], client);
  }

  /**
   * Check if a record exists
   */
  public async exists(conditions: WhereClause[], client?: PoolClient): Promise<boolean> {
    const count = await this.countBy(conditions, client);
    return count > 0;
  }

  /**
   * Check if a record exists by ID
   */
  public async existsById(id: string, client?: PoolClient): Promise<boolean> {
    return this.exists([{ field: this.primaryKey, operator: '=', value: id }], client);
  }

  /**
   * Create a new record
   */
  public abstract create(data: Omit<T, keyof BaseEntity>, client?: PoolClient): Promise<T>;

  /**
   * Update a record by ID
   */
  public abstract update(id: string, data: Partial<Omit<T, keyof BaseEntity>>, client?: PoolClient): Promise<T | null>;

  /**
   * Delete a record by ID
   */
  public async delete(id: string, client?: PoolClient): Promise<boolean> {
    const query = `DELETE FROM ${this.tableName} WHERE ${this.primaryKey} = $1`;
    const rows = await this.executeQuery(query, [id], client);
    return rows.length > 0;
  }

  /**
   * Soft delete a record (if the table supports it)
   */
  public async softDelete(id: string, client?: PoolClient): Promise<T | null> {
    // Check if table has is_active column
    const checkQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = $1 AND column_name = 'is_active'
    `;
    
    const columns = await this.executeQuery(checkQuery, [this.tableName], client);
    
    if (columns.length === 0) {
      throw new Error(`Table ${this.tableName} does not support soft delete (no is_active column)`);
    }

    const query = `
      UPDATE ${this.tableName} 
      SET is_active = false, updated_at = NOW() 
      WHERE ${this.primaryKey} = $1 
      RETURNING *
    `;
    
    const rows = await this.executeQuery<T>(query, [id], client);
    return rows.length > 0 ? (rows[0] ?? null) : null;
  }

  /**
   * Execute a transaction
   */
  public async transaction<R>(callback: (client: PoolClient) => Promise<R>): Promise<R> {
    return this.getDb().transaction(callback);
  }

  /**
   * Build insert query with returning clause
   */
  protected buildInsertQuery(fields: string[]): string {
    const placeholders = fields.map((_, index) => `$${index + 1}`).join(', ');
    return `
      INSERT INTO ${this.tableName} (${fields.join(', ')}) 
      VALUES (${placeholders}) 
      RETURNING *
    `;
  }

  /**
   * Build update query with returning clause
   */
  protected buildUpdateQuery(fields: string[]): string {
    const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
    return `
      UPDATE ${this.tableName} 
      SET ${setClause}, updated_at = NOW() 
      WHERE ${this.primaryKey} = $${fields.length + 1} 
      RETURNING *
    `;
  }

  /**
   * Convert camelCase to snake_case for database columns
   */
  protected toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  /**
   * Convert snake_case to camelCase for JavaScript objects
   */
  protected toCamelCase(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  /**
   * Convert object keys from camelCase to snake_case
   */
  protected toDbObject(obj: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[this.toSnakeCase(key)] = value;
    }
    return result;
  }

  /**
   * Convert object keys from snake_case to camelCase
   */
  protected fromDbObject(obj: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[this.toCamelCase(key)] = value;
    }
    return result;
  }
}