import { NotificationTemplateService } from '../NotificationTemplateService';
import { NotificationType, NotificationChannel } from '../../types';

// Mock uuid
jest.mock('uuid', () => ({
  v4: () => 'mock-uuid-123'
}));

describe('NotificationTemplateService', () => {
  let templateService: NotificationTemplateService;

  beforeEach(() => {
    templateService = new NotificationTemplateService();
  });

  describe('getTemplate', () => {
    it('should return template for valid type and channel', () => {
      const template = templateService.getTemplate('session_scheduled', 'email');
      
      expect(template).toBeDefined();
      expect(template?.type).toBe('session_scheduled');
      expect(template?.channel).toBe('email');
      expect(template?.subject).toContain('{{clientName}}');
      expect(template?.isActive).toBe(true);
    });

    it('should return undefined for non-existent template', () => {
      const template = templateService.getTemplate('system_alert', 'push' as NotificationChannel);
      expect(template).toBeUndefined();
    });
  });

  describe('getTemplatesByType', () => {
    it('should return all templates for a specific type', () => {
      const templates = templateService.getTemplatesByType('session_scheduled');
      
      expect(templates.length).toBeGreaterThan(0);
      expect(templates.every(t => t.type === 'session_scheduled')).toBe(true);
      expect(templates.every(t => t.isActive)).toBe(true);
    });

    it('should return empty array for non-existent type', () => {
      const templates = templateService.getTemplatesByType('non_existent' as NotificationType);
      expect(templates).toHaveLength(0);
    });
  });

  describe('getTemplatesByChannel', () => {
    it('should return all templates for a specific channel', () => {
      const templates = templateService.getTemplatesByChannel('email');
      
      expect(templates.length).toBeGreaterThan(0);
      expect(templates.every(t => t.channel === 'email')).toBe(true);
      expect(templates.every(t => t.isActive)).toBe(true);
    });

    it('should return empty array for non-existent channel', () => {
      const templates = templateService.getTemplatesByChannel('push' as NotificationChannel);
      expect(templates).toHaveLength(0);
    });
  });

  describe('upsertTemplate', () => {
    it('should create new template', () => {
      const newTemplate = {
        type: 'system_alert' as NotificationType,
        channel: 'push' as NotificationChannel,
        subject: 'System Alert: {{alertType}}',
        content: 'Alert: {{message}}',
        variables: ['alertType', 'message'],
        isActive: true
      };

      const created = templateService.upsertTemplate(newTemplate);
      
      expect(created).toBeDefined();
      expect(created.id).toBeDefined();
      expect(created.type).toBe(newTemplate.type);
      expect(created.channel).toBe(newTemplate.channel);
      expect(created.createdAt).toBeDefined();
      expect(created.updatedAt).toBeDefined();
    });

    it('should update existing template', async () => {
      const originalTemplate = templateService.getTemplate('session_scheduled', 'email');
      expect(originalTemplate).toBeDefined();

      // Add a small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 1));

      const updatedTemplate = templateService.upsertTemplate({
        type: 'session_scheduled',
        channel: 'email',
        subject: 'Updated Subject: {{clientName}}',
        content: 'Updated content',
        variables: ['clientName'],
        isActive: true
      });

      expect(updatedTemplate.id).toBe(originalTemplate!.id);
      expect(updatedTemplate.subject).toBe('Updated Subject: {{clientName}}');
      expect(updatedTemplate.updatedAt.getTime()).toBeGreaterThanOrEqual(originalTemplate!.updatedAt.getTime());
    });
  });

  describe('deleteTemplate', () => {
    it('should delete existing template', () => {
      // First create a template
      const newTemplate = {
        type: 'system_alert' as NotificationType,
        channel: 'email' as NotificationChannel,
        subject: 'Test Alert',
        content: 'Test content',
        variables: ['test'],
        isActive: true
      };

      templateService.upsertTemplate(newTemplate);
      
      // Verify it exists
      let template = templateService.getTemplate('system_alert', 'email');
      expect(template).toBeDefined();

      // Delete it
      const deleted = templateService.deleteTemplate('system_alert', 'email');
      expect(deleted).toBe(true);

      // Verify it's gone
      template = templateService.getTemplate('system_alert', 'email');
      expect(template).toBeUndefined();
    });

    it('should return false for non-existent template', () => {
      const deleted = templateService.deleteTemplate('non_existent' as NotificationType, 'email');
      expect(deleted).toBe(false);
    });
  });

  describe('setTemplateStatus', () => {
    it('should activate/deactivate template', () => {
      const template = templateService.getTemplate('session_scheduled', 'email');
      expect(template?.isActive).toBe(true);

      // Deactivate
      const deactivated = templateService.setTemplateStatus('session_scheduled', 'email', false);
      expect(deactivated).toBe(true);

      const updatedTemplate = templateService.getTemplate('session_scheduled', 'email');
      expect(updatedTemplate?.isActive).toBe(false);

      // Reactivate
      const reactivated = templateService.setTemplateStatus('session_scheduled', 'email', true);
      expect(reactivated).toBe(true);

      const reactivatedTemplate = templateService.getTemplate('session_scheduled', 'email');
      expect(reactivatedTemplate?.isActive).toBe(true);
    });

    it('should return false for non-existent template', () => {
      const result = templateService.setTemplateStatus('non_existent' as NotificationType, 'email', false);
      expect(result).toBe(false);
    });
  });

  describe('validateTemplate', () => {
    it('should validate template with all required variables', () => {
      const template = templateService.getTemplate('session_scheduled', 'email');
      const data = {
        recipientName: 'John Doe',
        clientName: 'Jane Smith',
        rbtName: 'Dr. Johnson',
        sessionDate: 'Monday, January 15, 2024',
        sessionTime: '10:00 AM',
        duration: '3',
        location: 'Clinic Room A'
      };

      const validation = templateService.validateTemplate(template!, data);
      expect(validation.isValid).toBe(true);
      expect(validation.missingVariables).toHaveLength(0);
    });

    it('should identify missing variables', () => {
      const template = templateService.getTemplate('session_scheduled', 'email');
      const data = {
        recipientName: 'John Doe',
        clientName: 'Jane Smith'
        // Missing other required variables
      };

      const validation = templateService.validateTemplate(template!, data);
      expect(validation.isValid).toBe(false);
      expect(validation.missingVariables.length).toBeGreaterThan(0);
      expect(validation.missingVariables).toContain('rbtName');
    });
  });

  describe('renderTemplate', () => {
    it('should render template with simple variables', () => {
      const template = 'Hello {{name}}, your appointment is on {{date}}';
      const data = {
        name: 'John Doe',
        date: 'Monday, January 15, 2024'
      };

      const rendered = templateService.renderTemplate(template, data);
      expect(rendered).toBe('Hello John Doe, your appointment is on Monday, January 15, 2024');
    });

    it('should handle conditional blocks', () => {
      const template = 'Hello {{name}}. {{#hasAlternatives}}Alternatives are available.{{/hasAlternatives}}';
      
      // With condition true
      const dataWithCondition = {
        name: 'John Doe',
        hasAlternatives: true
      };
      
      let rendered = templateService.renderTemplate(template, dataWithCondition);
      expect(rendered).toBe('Hello John Doe. Alternatives are available.');

      // With condition false
      const dataWithoutCondition = {
        name: 'John Doe',
        hasAlternatives: false
      };
      
      rendered = templateService.renderTemplate(template, dataWithoutCondition);
      expect(rendered).toBe('Hello John Doe. ');
    });

    it('should handle array iterations', () => {
      const template = 'Team members: {{#teamMembers}}{{name}} - {{role}}, {{/teamMembers}}';
      const data = {
        teamMembers: [
          { name: 'Dr. Smith', role: 'Primary RBT' },
          { name: 'Jane Doe', role: 'Secondary RBT' }
        ]
      };

      const rendered = templateService.renderTemplate(template, data);
      expect(rendered).toBe('Team members: Dr. Smith - Primary RBT, Jane Doe - Secondary RBT, ');
    });

    it('should handle missing variables gracefully', () => {
      const template = 'Hello {{name}}, your {{missingVar}} is ready';
      const data = { name: 'John Doe' };

      const rendered = templateService.renderTemplate(template, data);
      expect(rendered).toBe('Hello John Doe, your  is ready');
    });
  });

  describe('getAllTemplates', () => {
    it('should return all templates', () => {
      const templates = templateService.getAllTemplates();
      
      expect(templates.length).toBeGreaterThan(0);
      expect(templates.every(t => t.id && t.type && t.channel)).toBe(true);
    });
  });
});