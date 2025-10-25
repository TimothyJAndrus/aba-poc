describe('AuthenticationService - Simple Tests', () => {
  describe('role-based authorization methods', () => {
    // Import the service class directly to test static methods
    const { AuthenticationService } = require('../AuthenticationService');
    const authService = new AuthenticationService();

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
});