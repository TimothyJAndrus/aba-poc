import { PoolClient } from 'pg';
import { BaseRepository, WhereClause, QueryOptions } from './BaseRepository';
import { User, CreateUserRequest, UpdateUserRequest, UserWithAuth } from '../../models/User';
import { validateCreateUserRequest, validateUpdateUserRequest } from '../../models/User';
import { UserRole } from '../../types';

export class UserRepository extends BaseRepository<User> {
  constructor() {
    super('users');
  }

  /**
   * Create a new user
   */
  public async create(data: CreateUserRequest, client?: PoolClient): Promise<User> {
    // Validate input
    const errors = validateCreateUserRequest(data);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    // Check if email already exists
    const existingUser = await this.findByEmail(data.email, client);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    const dbData = this.toDbObject({
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      role: data.role,
      isActive: true
    });

    const fields = Object.keys(dbData);
    const values = Object.values(dbData);
    const query = this.buildInsertQuery(fields);

    const rows = await this.executeQuery<User>(query, values, client);
    return this.fromDbObject(rows[0]) as User;
  }

  /**
   * Update a user
   */
  public async update(id: string, data: UpdateUserRequest, client?: PoolClient): Promise<User | null> {
    // Validate input
    const errors = validateUpdateUserRequest(data);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    // Check if user exists
    const existingUser = await this.findById(id, client);
    if (!existingUser) {
      return null;
    }

    const dbData = this.toDbObject(data);
    const fields = Object.keys(dbData);
    const values = [...Object.values(dbData), id];
    const query = this.buildUpdateQuery(fields);

    const rows = await this.executeQuery<User>(query, values, client);
    return rows.length > 0 ? this.fromDbObject(rows[0]) as User : null;
  }

  /**
   * Find user by email
   */
  public async findByEmail(email: string, client?: PoolClient): Promise<User | null> {
    const conditions: WhereClause[] = [
      { field: 'email', operator: '=', value: email }
    ];
    
    const users = await this.findBy(conditions, {}, client);
    return users.length > 0 ? users[0] : null;
  }

  /**
   * Find users by role
   */
  public async findByRole(role: UserRole, options: QueryOptions = {}, client?: PoolClient): Promise<User[]> {
    const conditions: WhereClause[] = [
      { field: 'role', operator: '=', value: role }
    ];
    
    return this.findBy(conditions, options, client);
  }

  /**
   * Find active users
   */
  public async findActive(options: QueryOptions = {}, client?: PoolClient): Promise<User[]> {
    const conditions: WhereClause[] = [
      { field: 'is_active', operator: '=', value: true }
    ];
    
    return this.findBy(conditions, options, client);
  }

  /**
   * Find users by role and active status
   */
  public async findActiveByRole(role: UserRole, options: QueryOptions = {}, client?: PoolClient): Promise<User[]> {
    const conditions: WhereClause[] = [
      { field: 'role', operator: '=', value: role },
      { field: 'is_active', operator: '=', value: true }
    ];
    
    return this.findBy(conditions, options, client);
  }

  /**
   * Search users by name or email
   */
  public async search(searchTerm: string, options: QueryOptions = {}, client?: PoolClient): Promise<User[]> {
    const query = `
      SELECT * FROM ${this.tableName} 
      WHERE (
        first_name ILIKE $1 OR 
        last_name ILIKE $1 OR 
        email ILIKE $1 OR
        CONCAT(first_name, ' ', last_name) ILIKE $1
      )
      ${this.buildOrderClause(options)}
    `;

    const searchPattern = `%${searchTerm}%`;
    const { clause: limitClause, values: limitValues } = this.buildLimitClause(options, 2);
    
    const finalQuery = `${query} ${limitClause}`;
    const rows = await this.executeQuery<User>(finalQuery, [searchPattern, ...limitValues], client);
    
    return rows.map(row => this.fromDbObject(row) as User);
  }

  /**
   * Create user with authentication data
   */
  public async createWithAuth(
    userData: CreateUserRequest, 
    authData: { passwordHash: string; salt: string },
    client?: PoolClient
  ): Promise<UserWithAuth> {
    const dbData = this.toDbObject({
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      phone: userData.phone,
      role: userData.role,
      isActive: true,
      passwordHash: authData.passwordHash,
      salt: authData.salt
    });

    const fields = Object.keys(dbData);
    const values = Object.values(dbData);
    const query = this.buildInsertQuery(fields);

    const rows = await this.executeQuery<UserWithAuth>(query, values, client);
    return this.fromDbObject(rows[0]) as UserWithAuth;
  }

  /**
   * Find user with authentication data by email
   */
  public async findWithAuthByEmail(email: string, client?: PoolClient): Promise<UserWithAuth | null> {
    const query = `SELECT * FROM ${this.tableName} WHERE email = $1`;
    const rows = await this.executeQuery<UserWithAuth>(query, [email], client);
    return rows.length > 0 ? this.fromDbObject(rows[0]) as UserWithAuth : null;
  }

  /**
   * Update user password
   */
  public async updatePassword(
    id: string, 
    passwordHash: string, 
    salt: string, 
    client?: PoolClient
  ): Promise<boolean> {
    const query = `
      UPDATE ${this.tableName} 
      SET password_hash = $1, salt = $2, updated_at = NOW() 
      WHERE id = $3
    `;
    
    await this.executeQuery(query, [passwordHash, salt, id], client);
    return true;
  }

  /**
   * Set password reset token
   */
  public async setResetToken(
    email: string, 
    resetToken: string, 
    expiryDate: Date, 
    client?: PoolClient
  ): Promise<boolean> {
    const query = `
      UPDATE ${this.tableName} 
      SET reset_token = $1, reset_token_expiry = $2, updated_at = NOW() 
      WHERE email = $3
    `;
    
    await this.executeQuery(query, [resetToken, expiryDate, email], client);
    return true;
  }

  /**
   * Clear password reset token
   */
  public async clearResetToken(id: string, client?: PoolClient): Promise<boolean> {
    const query = `
      UPDATE ${this.tableName} 
      SET reset_token = NULL, reset_token_expiry = NULL, updated_at = NOW() 
      WHERE id = $1
    `;
    
    await this.executeQuery(query, [id], client);
    return true;
  }

  /**
   * Update last login timestamp
   */
  public async updateLastLogin(id: string, client?: PoolClient): Promise<boolean> {
    const query = `
      UPDATE ${this.tableName} 
      SET last_login_at = NOW(), updated_at = NOW() 
      WHERE id = $1
    `;
    
    await this.executeQuery(query, [id], client);
    return true;
  }

  /**
   * Deactivate user account
   */
  public async deactivate(id: string, client?: PoolClient): Promise<User | null> {
    return this.softDelete(id, client);
  }

  /**
   * Reactivate user account
   */
  public async reactivate(id: string, client?: PoolClient): Promise<User | null> {
    const query = `
      UPDATE ${this.tableName} 
      SET is_active = true, updated_at = NOW() 
      WHERE id = $1 
      RETURNING *
    `;
    
    const rows = await this.executeQuery<User>(query, [id], client);
    return rows.length > 0 ? this.fromDbObject(rows[0]) as User : null;
  }
}