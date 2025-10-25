import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import {
  NotificationTemplate,
  NotificationType,
  NotificationChannel
} from '../types';

export class NotificationTemplateService {
  private templates: Map<string, NotificationTemplate> = new Map();

  constructor() {
    this.initializeDefaultTemplates();
  }

  private initializeDefaultTemplates(): void {
    const defaultTemplates: Omit<NotificationTemplate, 'id' | 'createdAt' | 'updatedAt'>[] = [
      // Session Scheduled Templates
      {
        type: 'session_scheduled',
        channel: 'email',
        subject: 'ABA Session Scheduled - {{clientName}}',
        content: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2c5aa0;">Session Scheduled</h2>
            <p>Dear {{recipientName}},</p>
            <p>A new ABA therapy session has been scheduled:</p>
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 8px 0; font-weight: bold;">Client:</td><td style="padding: 8px 0;">{{clientName}}</td></tr>
                <tr><td style="padding: 8px 0; font-weight: bold;">RBT:</td><td style="padding: 8px 0;">{{rbtName}}</td></tr>
                <tr><td style="padding: 8px 0; font-weight: bold;">Date:</td><td style="padding: 8px 0;">{{sessionDate}}</td></tr>
                <tr><td style="padding: 8px 0; font-weight: bold;">Time:</td><td style="padding: 8px 0;">{{sessionTime}}</td></tr>
                <tr><td style="padding: 8px 0; font-weight: bold;">Duration:</td><td style="padding: 8px 0;">{{duration}} hours</td></tr>
                <tr><td style="padding: 8px 0; font-weight: bold;">Location:</td><td style="padding: 8px 0;">{{location}}</td></tr>
              </table>
            </div>
            <p>Please confirm your availability by replying to this email or contacting your coordinator.</p>
            <p>Best regards,<br>ABA Scheduling Team</p>
          </div>
        `,
        variables: ['recipientName', 'clientName', 'rbtName', 'sessionDate', 'sessionTime', 'duration', 'location'],
        isActive: true,
      },
      {
        type: 'session_scheduled',
        channel: 'sms',
        subject: 'Session Scheduled',
        content: 'ABA session scheduled: {{clientName}} on {{sessionDate}} at {{sessionTime}} with {{rbtName}}. Location: {{location}}',
        variables: ['clientName', 'sessionDate', 'sessionTime', 'rbtName', 'location'],
        isActive: true,
      },

      // Session Cancelled Templates
      {
        type: 'session_cancelled',
        channel: 'email',
        subject: 'ABA Session Cancelled - {{clientName}}',
        content: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc3545;">Session Cancelled</h2>
            <p>Dear {{recipientName}},</p>
            <p>The following ABA therapy session has been cancelled:</p>
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 8px 0; font-weight: bold;">Client:</td><td style="padding: 8px 0;">{{clientName}}</td></tr>
                <tr><td style="padding: 8px 0; font-weight: bold;">Original Date:</td><td style="padding: 8px 0;">{{sessionDate}}</td></tr>
                <tr><td style="padding: 8px 0; font-weight: bold;">Original Time:</td><td style="padding: 8px 0;">{{sessionTime}}</td></tr>
                <tr><td style="padding: 8px 0; font-weight: bold;">RBT:</td><td style="padding: 8px 0;">{{rbtName}}</td></tr>
                <tr><td style="padding: 8px 0; font-weight: bold;">Reason:</td><td style="padding: 8px 0;">{{reason}}</td></tr>
              </table>
            </div>
            {{#hasAlternatives}}
            <div style="background-color: #d4edda; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #155724;"><strong>Good news!</strong> Alternative sessions are available. Please contact your coordinator to reschedule.</p>
            </div>
            {{/hasAlternatives}}
            <p>We apologize for any inconvenience. Please contact us if you have any questions.</p>
            <p>Best regards,<br>ABA Scheduling Team</p>
          </div>
        `,
        variables: ['recipientName', 'clientName', 'sessionDate', 'sessionTime', 'rbtName', 'reason', 'hasAlternatives'],
        isActive: true,
      },
      {
        type: 'session_cancelled',
        channel: 'sms',
        subject: 'Session Cancelled',
        content: 'CANCELLED: {{clientName}} session on {{sessionDate}} at {{sessionTime}}. Reason: {{reason}}. Contact coordinator for rescheduling.',
        variables: ['clientName', 'sessionDate', 'sessionTime', 'reason'],
        isActive: true,
      },

      // Session Rescheduled Templates
      {
        type: 'session_rescheduled',
        channel: 'email',
        subject: 'ABA Session Rescheduled - {{clientName}}',
        content: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #fd7e14;">Session Rescheduled</h2>
            <p>Dear {{recipientName}},</p>
            <p>An ABA therapy session has been rescheduled:</p>
            
            <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #856404;">Original Session</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 4px 0; font-weight: bold;">Date:</td><td style="padding: 4px 0;">{{originalDate}}</td></tr>
                <tr><td style="padding: 4px 0; font-weight: bold;">Time:</td><td style="padding: 4px 0;">{{originalTime}}</td></tr>
                <tr><td style="padding: 4px 0; font-weight: bold;">RBT:</td><td style="padding: 4px 0;">{{originalRbt}}</td></tr>
              </table>
            </div>

            <div style="background-color: #d4edda; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #155724;">New Session</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 4px 0; font-weight: bold;">Client:</td><td style="padding: 4px 0;">{{clientName}}</td></tr>
                <tr><td style="padding: 4px 0; font-weight: bold;">Date:</td><td style="padding: 4px 0;">{{newDate}}</td></tr>
                <tr><td style="padding: 4px 0; font-weight: bold;">Time:</td><td style="padding: 4px 0;">{{newTime}}</td></tr>
                <tr><td style="padding: 4px 0; font-weight: bold;">RBT:</td><td style="padding: 4px 0;">{{newRbt}}</td></tr>
                <tr><td style="padding: 4px 0; font-weight: bold;">Location:</td><td style="padding: 4px 0;">{{location}}</td></tr>
              </table>
            </div>

            <p><strong>Reason for change:</strong> {{reason}}</p>
            <p>Please confirm your availability for the new time slot.</p>
            <p>Best regards,<br>ABA Scheduling Team</p>
          </div>
        `,
        variables: ['recipientName', 'clientName', 'originalDate', 'originalTime', 'originalRbt', 'newDate', 'newTime', 'newRbt', 'location', 'reason'],
        isActive: true,
      },
      {
        type: 'session_rescheduled',
        channel: 'sms',
        subject: 'Session Rescheduled',
        content: 'RESCHEDULED: {{clientName}} session moved from {{originalDate}} {{originalTime}} to {{newDate}} {{newTime}} with {{newRbt}}',
        variables: ['clientName', 'originalDate', 'originalTime', 'newDate', 'newTime', 'newRbt'],
        isActive: true,
      },

      // Session Reminder Templates
      {
        type: 'session_reminder',
        channel: 'email',
        subject: 'Session Reminder - {{clientName}} Tomorrow',
        content: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #17a2b8;">Session Reminder</h2>
            <p>Dear {{recipientName}},</p>
            <p>This is a friendly reminder about your upcoming ABA therapy session:</p>
            <div style="background-color: #d1ecf1; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 8px 0; font-weight: bold;">Client:</td><td style="padding: 8px 0;">{{clientName}}</td></tr>
                <tr><td style="padding: 8px 0; font-weight: bold;">Date:</td><td style="padding: 8px 0;">{{sessionDate}}</td></tr>
                <tr><td style="padding: 8px 0; font-weight: bold;">Time:</td><td style="padding: 8px 0;">{{sessionTime}}</td></tr>
                <tr><td style="padding: 8px 0; font-weight: bold;">RBT:</td><td style="padding: 8px 0;">{{rbtName}}</td></tr>
                <tr><td style="padding: 8px 0; font-weight: bold;">Location:</td><td style="padding: 8px 0;">{{location}}</td></tr>
              </table>
            </div>
            <p>Please ensure you're prepared for the session. If you need to make any changes, contact us as soon as possible.</p>
            <p>Best regards,<br>ABA Scheduling Team</p>
          </div>
        `,
        variables: ['recipientName', 'clientName', 'sessionDate', 'sessionTime', 'rbtName', 'location'],
        isActive: true,
      },
      {
        type: 'session_reminder',
        channel: 'sms',
        subject: 'Session Reminder',
        content: 'Reminder: ABA session with {{clientName}} {{reminderTime}} at {{sessionTime}}. Location: {{location}}. RBT: {{rbtName}}',
        variables: ['clientName', 'reminderTime', 'sessionTime', 'location', 'rbtName'],
        isActive: true,
      },

      // RBT Assignment Changed Templates
      {
        type: 'rbt_assignment_changed',
        channel: 'email',
        subject: 'RBT Assignment Update - {{clientName}}',
        content: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #6f42c1;">RBT Assignment Update</h2>
            <p>Dear {{recipientName}},</p>
            <p>There has been a change in RBT assignment for {{clientName}}:</p>
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              {{#previousRbt}}
              <p><strong>Previous RBT:</strong> {{previousRbt}}</p>
              {{/previousRbt}}
              <p><strong>New RBT:</strong> {{newRbt}}</p>
              <p><strong>Effective Date:</strong> {{effectiveDate}}</p>
              <p><strong>Reason:</strong> {{reason}}</p>
            </div>
            <p>The new RBT will maintain continuity of care and has been briefed on {{clientName}}'s treatment plan.</p>
            <p>If you have any questions or concerns, please contact your coordinator.</p>
            <p>Best regards,<br>ABA Scheduling Team</p>
          </div>
        `,
        variables: ['recipientName', 'clientName', 'previousRbt', 'newRbt', 'effectiveDate', 'reason'],
        isActive: true,
      },
      {
        type: 'rbt_assignment_changed',
        channel: 'sms',
        subject: 'RBT Assignment Update',
        content: 'RBT change for {{clientName}}: {{newRbt}} will be the new therapist starting {{effectiveDate}}. Contact coordinator with questions.',
        variables: ['clientName', 'newRbt', 'effectiveDate'],
        isActive: true,
      },

      // Team Updated Templates
      {
        type: 'team_updated',
        channel: 'email',
        subject: 'Team Update - {{clientName}}',
        content: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #28a745;">Team Update</h2>
            <p>Dear {{recipientName}},</p>
            <p>The therapy team for {{clientName}} has been updated:</p>
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Primary RBT:</strong> {{primaryRbt}}</p>
              <p><strong>Team Members:</strong></p>
              <ul>
                {{#teamMembers}}
                <li>{{name}} - {{role}}</li>
                {{/teamMembers}}
              </ul>
              <p><strong>Effective Date:</strong> {{effectiveDate}}</p>
            </div>
            <p>This change ensures optimal care coordination and service delivery for {{clientName}}.</p>
            <p>Best regards,<br>ABA Scheduling Team</p>
          </div>
        `,
        variables: ['recipientName', 'clientName', 'primaryRbt', 'teamMembers', 'effectiveDate'],
        isActive: true,
      },

      // System Alert Templates
      {
        type: 'system_alert',
        channel: 'email',
        subject: 'System Alert - {{alertType}}',
        content: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc3545;">System Alert</h2>
            <p>Dear {{recipientName}},</p>
            <div style="background-color: #f8d7da; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc3545;">
              <p><strong>Alert Type:</strong> {{alertType}}</p>
              <p><strong>Message:</strong> {{message}}</p>
              <p><strong>Time:</strong> {{timestamp}}</p>
              {{#affectedSessions}}
              <p><strong>Affected Sessions:</strong> {{affectedSessions}}</p>
              {{/affectedSessions}}
            </div>
            <p>{{actionRequired}}</p>
            <p>Please contact support if you need assistance.</p>
            <p>Best regards,<br>ABA Scheduling System</p>
          </div>
        `,
        variables: ['recipientName', 'alertType', 'message', 'timestamp', 'affectedSessions', 'actionRequired'],
        isActive: true,
      },
    ];

    defaultTemplates.forEach(template => {
      const id = uuidv4();
      const templateKey = `${template.type}_${template.channel}`;
      this.templates.set(templateKey, {
        ...template,
        id,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    logger.info(`Initialized ${defaultTemplates.length} notification templates`);
  }

  /**
   * Get template by type and channel
   */
  getTemplate(type: NotificationType, channel: NotificationChannel): NotificationTemplate | undefined {
    const key = `${type}_${channel}`;
    return this.templates.get(key);
  }

  /**
   * Get all templates for a specific type
   */
  getTemplatesByType(type: NotificationType): NotificationTemplate[] {
    return Array.from(this.templates.values())
      .filter(template => template.type === type && template.isActive);
  }

  /**
   * Get all templates for a specific channel
   */
  getTemplatesByChannel(channel: NotificationChannel): NotificationTemplate[] {
    return Array.from(this.templates.values())
      .filter(template => template.channel === channel && template.isActive);
  }

  /**
   * Create or update a template
   */
  upsertTemplate(template: Omit<NotificationTemplate, 'id' | 'createdAt' | 'updatedAt'>): NotificationTemplate {
    const key = `${template.type}_${template.channel}`;
    const existingTemplate = this.templates.get(key);
    
    if (existingTemplate) {
      // Update existing template
      const updatedTemplate: NotificationTemplate = {
        ...existingTemplate,
        ...template,
        updatedAt: new Date(),
      };
      this.templates.set(key, updatedTemplate);
      logger.info(`Updated template: ${key}`);
      return updatedTemplate;
    } else {
      // Create new template
      const newTemplate: NotificationTemplate = {
        ...template,
        id: uuidv4(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.templates.set(key, newTemplate);
      logger.info(`Created template: ${key}`);
      return newTemplate;
    }
  }

  /**
   * Delete a template
   */
  deleteTemplate(type: NotificationType, channel: NotificationChannel): boolean {
    const key = `${type}_${channel}`;
    const deleted = this.templates.delete(key);
    if (deleted) {
      logger.info(`Deleted template: ${key}`);
    }
    return deleted;
  }

  /**
   * Activate or deactivate a template
   */
  setTemplateStatus(type: NotificationType, channel: NotificationChannel, isActive: boolean): boolean {
    const key = `${type}_${channel}`;
    const template = this.templates.get(key);
    if (template) {
      template.isActive = isActive;
      template.updatedAt = new Date();
      logger.info(`${isActive ? 'Activated' : 'Deactivated'} template: ${key}`);
      return true;
    }
    return false;
  }

  /**
   * Get all templates
   */
  getAllTemplates(): NotificationTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Validate template variables
   */
  validateTemplate(template: NotificationTemplate, data: Record<string, any>): {
    isValid: boolean;
    missingVariables: string[];
  } {
    const missingVariables: string[] = [];
    
    template.variables.forEach(variable => {
      if (!(variable in data)) {
        missingVariables.push(variable);
      }
    });

    return {
      isValid: missingVariables.length === 0,
      missingVariables,
    };
  }

  /**
   * Render template with data
   */
  renderTemplate(template: string, data: Record<string, any>): string {
    let rendered = template;
    
    // Handle array iterations first {{#array}}...{{/array}}
    rendered = rendered.replace(/{{#(\w+)}}(.*?){{\/\1}}/gs, (match, arrayName, content) => {
      const array = data[arrayName];
      if (Array.isArray(array)) {
        return array.map(item => {
          let itemContent = content;
          if (typeof item === 'object') {
            Object.keys(item).forEach(key => {
              const regex = new RegExp(`{{${key}}}`, 'g');
              itemContent = itemContent.replace(regex, String(item[key] || ''));
            });
          }
          return itemContent;
        }).join('');
      }
      // Handle conditional blocks for non-arrays
      return data[arrayName] ? content : '';
    });

    // Replace simple variables {{variable}}
    Object.keys(data).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      rendered = rendered.replace(regex, String(data[key] || ''));
    });

    // Replace any remaining variables with empty strings
    rendered = rendered.replace(/{{[^}]+}}/g, '');

    return rendered;
  }
}

// Export singleton instance
export const notificationTemplateService = new NotificationTemplateService();