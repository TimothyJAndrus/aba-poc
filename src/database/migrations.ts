import { PoolClient } from 'pg';
import { getDatabase } from './connection';
import { logger } from '../utils/logger';

export interface Migration {
  id: string;
  name: string;
  up: (client: PoolClient) => Promise<void>;
  down: (client: PoolClient) => Promise<void>;
}

class MigrationRunner {
  private migrations: Migration[] = [];

  /**
   * Add a migration to the runner
   */
  public addMigration(migration: Migration): void {
    this.migrations.push(migration);
  }

  /**
   * Initialize the migrations table
   */
  private async initializeMigrationsTable(client: PoolClient): Promise<void> {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS migrations (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    await client.query(createTableQuery);
  }

  /**
   * Get executed migrations from the database
   */
  private async getExecutedMigrations(client: PoolClient): Promise<string[]> {
    const result = await client.query('SELECT id FROM migrations ORDER BY executed_at');
    return result.rows.map(row => row.id);
  }

  /**
   * Mark a migration as executed
   */
  private async markMigrationExecuted(client: PoolClient, migration: Migration): Promise<void> {
    await client.query(
      'INSERT INTO migrations (id, name) VALUES ($1, $2)',
      [migration.id, migration.name]
    );
  }

  /**
   * Remove a migration from executed list
   */
  private async unmarkMigrationExecuted(client: PoolClient, migrationId: string): Promise<void> {
    await client.query('DELETE FROM migrations WHERE id = $1', [migrationId]);
  }

  /**
   * Run pending migrations
   */
  public async runMigrations(): Promise<void> {
    const db = getDatabase();
    
    await db.transaction(async (client) => {
      await this.initializeMigrationsTable(client);
      
      const executedMigrations = await this.getExecutedMigrations(client);
      const pendingMigrations = this.migrations.filter(
        migration => !executedMigrations.includes(migration.id)
      );

      if (pendingMigrations.length === 0) {
        logger.info('No pending migrations to run');
        return;
      }

      logger.info(`Running ${pendingMigrations.length} pending migrations`);

      for (const migration of pendingMigrations) {
        try {
          logger.info(`Running migration: ${migration.name}`);
          await migration.up(client);
          await this.markMigrationExecuted(client, migration);
          logger.info(`Migration completed: ${migration.name}`);
        } catch (error) {
          logger.error(`Migration failed: ${migration.name}`, error);
          throw error;
        }
      }

      logger.info('All migrations completed successfully');
    });
  }

  /**
   * Rollback the last migration
   */
  public async rollbackLastMigration(): Promise<void> {
    const db = getDatabase();
    
    await db.transaction(async (client) => {
      await this.initializeMigrationsTable(client);
      
      const executedMigrations = await this.getExecutedMigrations(client);
      
      if (executedMigrations.length === 0) {
        logger.info('No migrations to rollback');
        return;
      }

      const lastMigrationId = executedMigrations[executedMigrations.length - 1];
      const migration = this.migrations.find(m => m.id === lastMigrationId);

      if (!migration) {
        throw new Error(`Migration not found: ${lastMigrationId}`);
      }

      try {
        logger.info(`Rolling back migration: ${migration.name}`);
        await migration.down(client);
        await this.unmarkMigrationExecuted(client, migration.id);
        logger.info(`Migration rollback completed: ${migration.name}`);
      } catch (error) {
        logger.error(`Migration rollback failed: ${migration.name}`, error);
        throw error;
      }
    });
  }

  /**
   * Get migration status
   */
  public async getMigrationStatus(): Promise<{ executed: string[], pending: string[] }> {
    const db = getDatabase();
    const client = await db.getClient();
    
    try {
      await this.initializeMigrationsTable(client);
      const executedMigrations = await this.getExecutedMigrations(client);
      const allMigrations = this.migrations.map(m => m.id);
      const pendingMigrations = allMigrations.filter(id => !executedMigrations.includes(id));

      return {
        executed: executedMigrations,
        pending: pendingMigrations
      };
    } finally {
      client.release();
    }
  }
}

// Create singleton migration runner
const migrationRunner = new MigrationRunner();

// Define all migrations
const migrations: Migration[] = [
  {
    id: '001_create_users_table',
    name: 'Create users table',
    up: async (client: PoolClient) => {
      await client.query(`
        CREATE TABLE users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email VARCHAR(255) UNIQUE NOT NULL,
          first_name VARCHAR(50) NOT NULL,
          last_name VARCHAR(50) NOT NULL,
          phone VARCHAR(20) NOT NULL,
          role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'coordinator', 'rbt', 'client_family')),
          is_active BOOLEAN DEFAULT true,
          password_hash VARCHAR(255),
          salt VARCHAR(255),
          reset_token VARCHAR(255),
          reset_token_expiry TIMESTAMP WITH TIME ZONE,
          last_login_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      await client.query(`
        CREATE INDEX idx_users_email ON users(email);
        CREATE INDEX idx_users_role ON users(role);
        CREATE INDEX idx_users_active ON users(is_active);
      `);
    },
    down: async (client: PoolClient) => {
      await client.query('DROP TABLE IF EXISTS users CASCADE;');
    }
  },

  {
    id: '002_create_rbts_table',
    name: 'Create RBTs table',
    up: async (client: PoolClient) => {
      await client.query(`
        CREATE TABLE rbts (
          user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          license_number VARCHAR(20) UNIQUE NOT NULL,
          qualifications JSONB DEFAULT '[]',
          hourly_rate DECIMAL(10,2) NOT NULL CHECK (hourly_rate >= 0),
          hire_date DATE NOT NULL,
          termination_date DATE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          CONSTRAINT valid_employment_dates CHECK (termination_date IS NULL OR termination_date >= hire_date)
        );
      `);

      await client.query(`
        CREATE INDEX idx_rbts_license ON rbts(license_number);
        CREATE INDEX idx_rbts_active ON rbts(user_id) WHERE termination_date IS NULL;
      `);
    },
    down: async (client: PoolClient) => {
      await client.query('DROP TABLE IF EXISTS rbts CASCADE;');
    }
  },

  {
    id: '003_create_clients_table',
    name: 'Create clients table',
    up: async (client: PoolClient) => {
      await client.query(`
        CREATE TABLE clients (
          user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          date_of_birth DATE NOT NULL,
          guardian_contact JSONB NOT NULL,
          special_needs JSONB DEFAULT '[]',
          preferred_schedule JSONB DEFAULT '[]',
          enrollment_date DATE NOT NULL,
          discharge_date DATE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          CONSTRAINT valid_age CHECK (date_of_birth <= CURRENT_DATE AND date_of_birth >= CURRENT_DATE - INTERVAL '18 years'),
          CONSTRAINT valid_enrollment_dates CHECK (discharge_date IS NULL OR discharge_date >= enrollment_date)
        );
      `);

      await client.query(`
        CREATE INDEX idx_clients_age ON clients(date_of_birth);
        CREATE INDEX idx_clients_active ON clients(user_id) WHERE discharge_date IS NULL;
      `);
    },
    down: async (client: PoolClient) => {
      await client.query('DROP TABLE IF EXISTS clients CASCADE;');
    }
  },

  {
    id: '004_create_teams_table',
    name: 'Create teams table',
    up: async (client: PoolClient) => {
      await client.query(`
        CREATE TABLE teams (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          client_id UUID NOT NULL REFERENCES clients(user_id) ON DELETE CASCADE,
          rbt_ids JSONB NOT NULL DEFAULT '[]',
          primary_rbt_id UUID NOT NULL REFERENCES rbts(user_id),
          effective_date DATE NOT NULL,
          end_date DATE,
          is_active BOOLEAN DEFAULT true,
          created_by UUID NOT NULL REFERENCES users(id),
          updated_by UUID REFERENCES users(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          CONSTRAINT valid_team_dates CHECK (end_date IS NULL OR end_date >= effective_date)
        );
      `);

      await client.query(`
        CREATE INDEX idx_teams_client ON teams(client_id);
        CREATE INDEX idx_teams_primary_rbt ON teams(primary_rbt_id);
        CREATE INDEX idx_teams_active ON teams(is_active);
        CREATE INDEX idx_teams_effective_date ON teams(effective_date);
      `);
    },
    down: async (client: PoolClient) => {
      await client.query('DROP TABLE IF EXISTS teams CASCADE;');
    }
  },

  {
    id: '005_create_availability_slots_table',
    name: 'Create availability slots table',
    up: async (client: PoolClient) => {
      await client.query(`
        CREATE TABLE availability_slots (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          rbt_id UUID NOT NULL REFERENCES rbts(user_id) ON DELETE CASCADE,
          day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
          start_time TIME NOT NULL,
          end_time TIME NOT NULL,
          is_recurring BOOLEAN DEFAULT true,
          effective_date DATE NOT NULL,
          end_date DATE,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          CONSTRAINT valid_time_order CHECK (start_time < end_time),
          CONSTRAINT valid_availability_dates CHECK (end_date IS NULL OR end_date >= effective_date),
          CONSTRAINT business_days_only CHECK (day_of_week BETWEEN 1 AND 5),
          CONSTRAINT business_hours_only CHECK (
            start_time >= '09:00:00' AND 
            end_time <= '19:00:00'
          )
        );
      `);

      await client.query(`
        CREATE INDEX idx_availability_rbt ON availability_slots(rbt_id);
        CREATE INDEX idx_availability_day ON availability_slots(day_of_week);
        CREATE INDEX idx_availability_active ON availability_slots(is_active);
        CREATE UNIQUE INDEX idx_availability_unique ON availability_slots(rbt_id, day_of_week, start_time, end_time, effective_date) 
        WHERE is_active = true;
      `);
    },
    down: async (client: PoolClient) => {
      await client.query('DROP TABLE IF EXISTS availability_slots CASCADE;');
    }
  },

  {
    id: '006_create_sessions_table',
    name: 'Create sessions table',
    up: async (client: PoolClient) => {
      await client.query(`
        CREATE TABLE sessions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          client_id UUID NOT NULL REFERENCES clients(user_id) ON DELETE CASCADE,
          rbt_id UUID NOT NULL REFERENCES rbts(user_id),
          start_time TIMESTAMP WITH TIME ZONE NOT NULL,
          end_time TIMESTAMP WITH TIME ZONE NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')),
          location VARCHAR(200) NOT NULL,
          notes TEXT,
          cancellation_reason VARCHAR(500),
          completion_notes TEXT,
          created_by UUID NOT NULL REFERENCES users(id),
          updated_by UUID REFERENCES users(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          CONSTRAINT valid_session_time CHECK (start_time < end_time),
          CONSTRAINT valid_session_duration CHECK (
            EXTRACT(EPOCH FROM (end_time - start_time)) / 3600 = 3
          ),
          CONSTRAINT business_days_only CHECK (
            EXTRACT(DOW FROM start_time) BETWEEN 1 AND 5
          ),
          CONSTRAINT business_hours_only CHECK (
            EXTRACT(HOUR FROM start_time) >= 9 AND 
            EXTRACT(HOUR FROM end_time) <= 19
          )
        );
      `);

      await client.query(`
        CREATE INDEX idx_sessions_client ON sessions(client_id);
        CREATE INDEX idx_sessions_rbt ON sessions(rbt_id);
        CREATE INDEX idx_sessions_start_time ON sessions(start_time);
        CREATE INDEX idx_sessions_status ON sessions(status);
        CREATE INDEX idx_sessions_date_range ON sessions(start_time, end_time);
        
        -- Prevent double booking
        CREATE UNIQUE INDEX idx_sessions_rbt_no_overlap ON sessions(rbt_id, start_time, end_time) 
        WHERE status NOT IN ('cancelled');
        CREATE UNIQUE INDEX idx_sessions_client_no_overlap ON sessions(client_id, start_time, end_time) 
        WHERE status NOT IN ('cancelled');
      `);
    },
    down: async (client: PoolClient) => {
      await client.query('DROP TABLE IF EXISTS sessions CASCADE;');
    }
  },

  {
    id: '007_create_schedule_events_table',
    name: 'Create schedule events table',
    up: async (client: PoolClient) => {
      await client.query(`
        CREATE TABLE schedule_events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('session_created', 'session_cancelled', 'session_rescheduled', 'rbt_unavailable')),
          session_id UUID REFERENCES sessions(id),
          rbt_id UUID REFERENCES rbts(user_id),
          client_id UUID REFERENCES clients(user_id),
          old_values JSONB,
          new_values JSONB,
          reason VARCHAR(500),
          metadata JSONB,
          created_by UUID NOT NULL REFERENCES users(id),
          updated_by UUID REFERENCES users(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          CONSTRAINT at_least_one_entity CHECK (
            session_id IS NOT NULL OR rbt_id IS NOT NULL OR client_id IS NOT NULL
          )
        );
      `);

      await client.query(`
        CREATE INDEX idx_schedule_events_type ON schedule_events(event_type);
        CREATE INDEX idx_schedule_events_session ON schedule_events(session_id);
        CREATE INDEX idx_schedule_events_rbt ON schedule_events(rbt_id);
        CREATE INDEX idx_schedule_events_client ON schedule_events(client_id);
        CREATE INDEX idx_schedule_events_created_at ON schedule_events(created_at);
        CREATE INDEX idx_schedule_events_created_by ON schedule_events(created_by);
      `);
    },
    down: async (client: PoolClient) => {
      await client.query('DROP TABLE IF EXISTS schedule_events CASCADE;');
    }
  },

  {
    id: '008_create_triggers_and_functions',
    name: 'Create triggers and functions',
    up: async (client: PoolClient) => {
      // Function to update updated_at timestamp
      await client.query(`
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ language 'plpgsql';
      `);

      // Create triggers for all tables with updated_at column
      const tables = ['users', 'rbts', 'clients', 'teams', 'availability_slots', 'sessions', 'schedule_events'];
      
      for (const table of tables) {
        await client.query(`
          CREATE TRIGGER update_${table}_updated_at 
          BEFORE UPDATE ON ${table} 
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        `);
      }

      // Function to validate team RBT membership
      await client.query(`
        CREATE OR REPLACE FUNCTION validate_team_primary_rbt()
        RETURNS TRIGGER AS $$
        BEGIN
          IF NOT (NEW.rbt_ids ? NEW.primary_rbt_id::text) THEN
            RAISE EXCEPTION 'Primary RBT must be a member of the team';
          END IF;
          RETURN NEW;
        END;
        $$ language 'plpgsql';
      `);

      await client.query(`
        CREATE TRIGGER validate_team_primary_rbt_trigger
        BEFORE INSERT OR UPDATE ON teams
        FOR EACH ROW EXECUTE FUNCTION validate_team_primary_rbt();
      `);
    },
    down: async (client: PoolClient) => {
      const tables = ['users', 'rbts', 'clients', 'teams', 'availability_slots', 'sessions', 'schedule_events'];
      
      for (const table of tables) {
        await client.query(`DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table};`);
      }
      
      await client.query('DROP TRIGGER IF EXISTS validate_team_primary_rbt_trigger ON teams;');
      await client.query('DROP FUNCTION IF EXISTS update_updated_at_column();');
      await client.query('DROP FUNCTION IF EXISTS validate_team_primary_rbt();');
    }
  }
];

// Add all migrations to the runner
migrations.forEach(migration => migrationRunner.addMigration(migration));

export { migrationRunner, Migration };

/**
 * Run all pending migrations
 */
export const runMigrations = async (): Promise<void> => {
  return migrationRunner.runMigrations();
};

/**
 * Rollback the last migration
 */
export const rollbackLastMigration = async (): Promise<void> => {
  return migrationRunner.rollbackLastMigration();
};

/**
 * Get migration status
 */
export const getMigrationStatus = async (): Promise<{ executed: string[], pending: string[] }> => {
  return migrationRunner.getMigrationStatus();
};