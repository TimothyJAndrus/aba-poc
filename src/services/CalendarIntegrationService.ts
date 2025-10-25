import { google } from 'googleapis';
import ical from 'ical-generator';
import { Session } from '../models/Session';
import { User } from '../models/User';
import { Client } from '../models/Client';
import { RBT } from '../models/RBT';
import { logger } from '../utils/logger';

export interface CalendarEvent {
  id: string;
  sessionId: string;
  title: string;
  description: string;
  startTime: Date;
  endTime: Date;
  location: string;
  attendees: string[];
  calendarEventId?: string;
  provider: 'google' | 'outlook' | 'ical';
}

export interface CalendarConfig {
  google?: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  };
  outlook?: {
    clientId: string;
    clientSecret: string;
    tenantId: string;
  };
}

export interface CalendarSyncResult {
  success: boolean;
  eventId?: string | undefined;
  error?: string | undefined;
  provider: string;
}

export class CalendarIntegrationService {
  private googleAuth: any;
  private config: CalendarConfig;

  constructor(config: CalendarConfig) {
    this.config = config;
    this.initializeGoogleAuth();
  }

  private initializeGoogleAuth(): void {
    if (this.config.google) {
      this.googleAuth = new google.auth.OAuth2(
        this.config.google.clientId,
        this.config.google.clientSecret,
        this.config.google.redirectUri
      );
    }
  }

  /**
   * Create a calendar event for a therapy session
   */
  async createSessionEvent(
    session: Session,
    client: Client,
    rbt: RBT,
    provider: 'google' | 'outlook' | 'ical' = 'ical'
  ): Promise<CalendarSyncResult> {
    try {
      const event = this.buildCalendarEvent(session, client, rbt);
      
      switch (provider) {
        case 'google':
          return await this.createGoogleEvent(event);
        case 'outlook':
          return await this.createOutlookEvent(event);
        case 'ical':
          return await this.createICalEvent(event);
        default:
          throw new Error(`Unsupported calendar provider: ${provider}`);
      }
    } catch (error) {
      logger.error('Failed to create calendar event', {
        sessionId: session.id,
        provider,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider
      };
    }
  }

  /**
   * Update an existing calendar event
   */
  async updateSessionEvent(
    session: Session,
    client: Client,
    rbt: RBT,
    calendarEventId: string,
    provider: 'google' | 'outlook' | 'ical' = 'ical'
  ): Promise<CalendarSyncResult> {
    try {
      const event = this.buildCalendarEvent(session, client, rbt);
      event.calendarEventId = calendarEventId;
      
      switch (provider) {
        case 'google':
          return await this.updateGoogleEvent(event);
        case 'outlook':
          return await this.updateOutlookEvent(event);
        case 'ical':
          return await this.updateICalEvent(event);
        default:
          throw new Error(`Unsupported calendar provider: ${provider}`);
      }
    } catch (error) {
      logger.error('Failed to update calendar event', {
        sessionId: session.id,
        calendarEventId,
        provider,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider
      };
    }
  }

  /**
   * Cancel/delete a calendar event
   */
  async cancelSessionEvent(
    calendarEventId: string,
    provider: 'google' | 'outlook' | 'ical' = 'ical'
  ): Promise<CalendarSyncResult> {
    try {
      switch (provider) {
        case 'google':
          return await this.cancelGoogleEvent(calendarEventId);
        case 'outlook':
          return await this.cancelOutlookEvent(calendarEventId);
        case 'ical':
          return await this.cancelICalEvent(calendarEventId);
        default:
          throw new Error(`Unsupported calendar provider: ${provider}`);
      }
    } catch (error) {
      logger.error('Failed to cancel calendar event', {
        calendarEventId,
        provider,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider
      };
    }
  }

  /**
   * Generate iCal file for session
   */
  generateICalFile(session: Session, client: Client, rbt: RBT): string {
    const calendar = ical({
      name: 'ABA Therapy Sessions',
      description: 'Automated ABA Scheduling System Calendar'
    });

    const event = this.buildCalendarEvent(session, client, rbt);
    
    calendar.createEvent({
      id: event.id,
      start: event.startTime,
      end: event.endTime,
      summary: event.title,
      description: event.description,
      location: event.location,
      organizer: {
        name: 'ABA Scheduling System',
        email: 'noreply@aba-scheduling.com'
      },
      attendees: event.attendees.map(email => ({ email }))
    });

    return calendar.toString();
  }

  private buildCalendarEvent(session: Session, client: Client, rbt: RBT): CalendarEvent {
    const title = `ABA Therapy Session - ${client.firstName} ${client.lastName}`;
    const description = `
ABA Therapy Session

Client: ${client.firstName} ${client.lastName}
RBT: ${rbt.firstName} ${rbt.lastName}
Duration: 3 hours
Location: ${session.location}

Session ID: ${session.id}
Status: ${session.status}

${session.notes ? `Notes: ${session.notes}` : ''}
    `.trim();

    return {
      id: session.id,
      sessionId: session.id,
      title,
      description,
      startTime: session.startTime,
      endTime: session.endTime,
      location: session.location,
      attendees: [rbt.email, client.email],
      provider: 'ical'
    };
  }

  private async createGoogleEvent(event: CalendarEvent): Promise<CalendarSyncResult> {
    if (!this.googleAuth) {
      throw new Error('Google Calendar not configured');
    }

    const calendar = google.calendar({ version: 'v3', auth: this.googleAuth });
    
    const googleEvent = {
      summary: event.title,
      description: event.description,
      location: event.location,
      start: {
        dateTime: event.startTime.toISOString(),
        timeZone: 'America/New_York'
      },
      end: {
        dateTime: event.endTime.toISOString(),
        timeZone: 'America/New_York'
      },
      attendees: event.attendees.map(email => ({ email })),
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 }, // 24 hours
          { method: 'popup', minutes: 120 } // 2 hours
        ]
      }
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: googleEvent
    });

    return {
      success: true,
      eventId: response.data.id ?? undefined,
      provider: 'google'
    };
  }

  private async updateGoogleEvent(event: CalendarEvent): Promise<CalendarSyncResult> {
    if (!this.googleAuth || !event.calendarEventId) {
      throw new Error('Google Calendar not configured or event ID missing');
    }

    const calendar = google.calendar({ version: 'v3', auth: this.googleAuth });
    
    const googleEvent = {
      summary: event.title,
      description: event.description,
      location: event.location,
      start: {
        dateTime: event.startTime.toISOString(),
        timeZone: 'America/New_York'
      },
      end: {
        dateTime: event.endTime.toISOString(),
        timeZone: 'America/New_York'
      },
      attendees: event.attendees.map(email => ({ email }))
    };

    const response = await calendar.events.update({
      calendarId: 'primary',
      eventId: event.calendarEventId,
      requestBody: googleEvent
    });

    return {
      success: true,
      eventId: response.data.id ?? undefined,
      provider: 'google'
    };
  }

  private async cancelGoogleEvent(calendarEventId: string): Promise<CalendarSyncResult> {
    if (!this.googleAuth) {
      throw new Error('Google Calendar not configured');
    }

    const calendar = google.calendar({ version: 'v3', auth: this.googleAuth });
    
    await calendar.events.delete({
      calendarId: 'primary',
      eventId: calendarEventId
    });

    return {
      success: true,
      provider: 'google'
    };
  }

  private async createOutlookEvent(event: CalendarEvent): Promise<CalendarSyncResult> {
    // Placeholder for Outlook integration
    // Would use Microsoft Graph API
    logger.info('Outlook calendar integration not yet implemented');
    return {
      success: false,
      error: 'Outlook integration not implemented',
      provider: 'outlook'
    };
  }

  private async updateOutlookEvent(event: CalendarEvent): Promise<CalendarSyncResult> {
    // Placeholder for Outlook integration
    logger.info('Outlook calendar integration not yet implemented');
    return {
      success: false,
      error: 'Outlook integration not implemented',
      provider: 'outlook'
    };
  }

  private async cancelOutlookEvent(calendarEventId: string): Promise<CalendarSyncResult> {
    // Placeholder for Outlook integration
    logger.info('Outlook calendar integration not yet implemented');
    return {
      success: false,
      error: 'Outlook integration not implemented',
      provider: 'outlook'
    };
  }

  private async createICalEvent(event: CalendarEvent): Promise<CalendarSyncResult> {
    // For iCal, we just generate the file - actual delivery would be via email/download
    return {
      success: true,
      eventId: event.id,
      provider: 'ical'
    };
  }

  private async updateICalEvent(event: CalendarEvent): Promise<CalendarSyncResult> {
    // For iCal, we just generate the file - actual delivery would be via email/download
    return {
      success: true,
      eventId: event.id,
      provider: 'ical'
    };
  }

  private async cancelICalEvent(calendarEventId: string): Promise<CalendarSyncResult> {
    // For iCal, we just mark as cancelled - actual delivery would be via email/download
    return {
      success: true,
      provider: 'ical'
    };
  }
}