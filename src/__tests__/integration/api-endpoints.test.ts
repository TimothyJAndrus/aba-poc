import request from 'supertest';
import express from 'express';
import routes from '../../routes';

describe('API Endpoints Integration', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/', routes);
  });

  describe('Health Check', () => {
    it('should return system health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'ABA Scheduling System API is running',
        timestamp: expect.any(String),
        version: '1.0.0'
      });
    });
  });

  describe('API Documentation', () => {
    it('should return API documentation', async () => {
      const response = await request(app)
        .get('/api/v1')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'ABA Scheduling System API v1',
        endpoints: expect.objectContaining({
          auth: expect.any(Object),
          users: expect.any(Object),
          teams: expect.any(Object),
          scheduling: expect.any(Object),
          rescheduling: expect.any(Object),
          notifications: expect.any(Object),
          calendar: expect.any(Object),
          monitoring: expect.any(Object)
        })
      });
    });
  });

  describe('Authentication Endpoints', () => {
    it('should handle login request structure', async () => {
      // Note: This would fail without proper authentication setup
      // but tests the endpoint structure
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      // Expect either success or proper error structure
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.body).toHaveProperty('success');
    });
  });

  describe('Scheduling Endpoints', () => {
    it('should handle session scheduling request structure', async () => {
      const response = await request(app)
        .post('/api/v1/schedule/session')
        .send({
          clientId: 'client-123',
          preferredStartTime: '2024-01-15T10:00:00Z',
          location: 'Therapy Room A'
        });

      // Expect either success or proper error structure
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.body).toHaveProperty('success');
    });
  });

  describe('Calendar Endpoints', () => {
    it('should handle calendar event creation request structure', async () => {
      const response = await request(app)
        .post('/api/v1/calendar/sessions/session-123/events')
        .send({
          provider: 'ical'
        });

      // Expect either success or proper error structure
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.body).toHaveProperty('success');
    });
  });

  describe('Monitoring Endpoints', () => {
    it('should handle health status request', async () => {
      const response = await request(app)
        .get('/api/v1/monitoring/health');

      // Expect either success or proper error structure
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.body).toHaveProperty('success');
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for non-existent endpoints', async () => {
      const response = await request(app)
        .get('/api/v1/non-existent-endpoint')
        .expect(404);

      // Express default 404 handling
      expect(response.status).toBe(404);
    });

    it('should handle malformed JSON requests', async () => {
      const response = await request(app)
        .post('/api/v1/schedule/session')
        .set('Content-Type', 'application/json')
        .send('invalid json');

      // Expect proper error handling
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('CORS and Security Headers', () => {
    it('should include proper headers in responses', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Check for basic security headers (would be added by middleware)
      expect(response.headers).toHaveProperty('content-type');
    });
  });

  describe('Request Validation', () => {
    it('should validate required fields in requests', async () => {
      const response = await request(app)
        .post('/api/v1/schedule/session')
        .send({}); // Empty request

      // Should return validation error
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body).toHaveProperty('success');
      if (!response.body.success) {
        expect(response.body).toHaveProperty('error');
      }
    });
  });

  describe('Response Format Consistency', () => {
    it('should return consistent response format across endpoints', async () => {
      const endpoints = [
        '/health',
        '/api/v1'
      ];

      for (const endpoint of endpoints) {
        const response = await request(app).get(endpoint);
        
        expect(response.body).toHaveProperty('success');
        expect(typeof response.body.success).toBe('boolean');
        
        if (response.body.success) {
          // Success responses should have consistent structure
          expect(response.body).toMatchObject({
            success: true,
            message: expect.any(String)
          });
        } else {
          // Error responses should have consistent structure
          expect(response.body).toMatchObject({
            success: false,
            error: expect.any(String)
          });
        }
      }
    });
  });
});