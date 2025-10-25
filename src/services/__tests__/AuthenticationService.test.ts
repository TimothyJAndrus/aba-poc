import { AuthenticationService } from '../AuthenticationService';

describe('AuthenticationService', () => {
  let authService: AuthenticationService;

  beforeEach(() => {
    // Setup environment variables for testing
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.JWT_ACCESS_EXPIRY = '15m';
    process.env.JWT_REFRESH_EXPIRY = '7d';
    process.env.BCRYPT_SALT_ROUNDS = '10';
    
    authService = new AuthenticationService();
  });

  describe('role-based authorization methods', () => {
    describe('hasRole', () => {
      it('should return true if user has required role', () => {
        const result = authService.hasRole('admin', ['admin', 'coordinator']);
        expect(result).toBe(true);
      });

      it('should return false if user does not have required role', () => {
        const result = authService.hasRole('rbt', ['admin', 'coordinator']);
        expect(result).toBe(false);
      });
    });

    describe('isAdmin', () => {
      it('should return true for admin role', () => {
        const result = authService.isAdmin('admin');
        expect(result).toBe(true);
      });

      it('should return false for non-admin role', () => {
        const result = authService.isAdmin('coordinator');
        expect(result).toBe(false);
      });
    });

    describe('canManageUsers', () => {
      it('should return true for admin role', () => {
        const result = authService.canManageUsers('admin');
        expect(result).toBe(true);
      });

      it('should return true for coordinator role', () => {
        const result = authService.canManageUsers('coordinator');
        expect(result).toBe(true);
      });

      it('should return false for rbt role', () => {
        const result = authService.canManageUsers('rbt');
        expect(result).toBe(false);
      });

      it('should return false for client_family role', () => {
        const result = authService.canManageUsers('client_family');
        expect(result).toBe(false);
      });
    });
  });

  describe('constructor', () => {
    it('should throw error in production without proper JWT secrets', () => {
      const originalEnv = process.env.NODE_ENV;
      const originalSecret = process.env.JWT_SECRET;
      
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'your-secret-key'; // Default value
      
      expect(() => new AuthenticationService()).toThrow('JWT secrets must be configured in production environment');
      
      // Restore environment
      process.env.NODE_ENV = originalEnv;
      process.env.JWT_SECRET = originalSecret;
    });

    it('should not throw error in development with default secrets', () => {
      const originalEnv = process.env.NODE_ENV;
      
      process.env.NODE_ENV = 'development';
      
      expect(() => new AuthenticationService()).not.toThrow();
      
      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });
  });
});