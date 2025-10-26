import { Request, Response } from 'express';
import { CalendarIntegrationService } from '../services/CalendarIntegrationService';
import { SessionRepository } from '../database/repositories/SessionRepository';
import { UserRepository } from '../database/repositories/UserRepository';
import { ClientRepository } from '../database/repositories/ClientRepository';
import { RBTRepository } from '../database/repositories/RBTRepository';
import { logger } from '../utils/logger';
import { validateUUID } from '../utils/validation';

export class CalendarController {
  private calendarService: CalendarIntegrationService;
  private sessionRepository: SessionRepository;
  private userRepository: UserRepository;
  private clientRepository: ClientRepository;
  private rbtRepository: RBTRepository;

  constructor(
    calendarService: CalendarIntegrationService,
    sessionRepository: SessionRepository,
    userRepository: UserRepository,
    clientRepository: ClientRepository,
    rbtRepository: RBTRepository
  ) {
    this.calendarService = calendarService;
    this.sessionRepository = sessionRepository;
    this.userRepository = userRepository;
    this.clientRepository = clientRepository;
    this.rbtRepository = rbtRepository;
  }

  /**
   * Create calendar event for a session
   */
  createSessionEvent = async (req: Request, res: Response): Promise<void> => {
    try {
      const { sessionId } = req.params;
      const { provider = 'ical' } = req.body;

      if (!validateUUID(sessionId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid session ID format'
        });
        return;
      }

      // Get session details
      const session = await this.sessionRepository.findById(sessionId);
      if (!session) {
        res.status(404).json({
          success: false,
          error: 'Session not found'
        });
        return;
      }

      // Get client and RBT details
      const [client, rbt] = await Promise.all([
        this.clientRepository.findById(session.clientId),
        this.rbtRepository.findById(session.rbtId)
      ]);

      if (!client || !rbt) {
        res.status(404).json({
          success: false,
          error: 'Client or RBT not found'
        });
        return;
      }

      const result = await this.calendarService.createSessionEvent(
        session,
        client,
        rbt,
        provider
      );

      if (result.success) {
        logger.info('Calendar event created successfully', {
          sessionId,
          eventId: result.eventId,
          provider: result.provider
        });

        res.status(201).json({
          success: true,
          eventId: result.eventId,
          provider: result.provider,
          message: 'Calendar event created successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error,
          provider: result.provider
        });
      }
    } catch (error) {
      logger.error('Error creating calendar event', {
        sessionId: req.params.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  /**
   * Update calendar event for a session
   */
  updateSessionEvent = async (req: Request, res: Response): Promise<void> => {
    try {
      const { sessionId } = req.params;
      const { calendarEventId, provider = 'ical' } = req.body;

      if (!validateUUID(sessionId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid session ID format'
        });
        return;
      }

      if (!calendarEventId) {
        res.status(400).json({
          success: false,
          error: 'Calendar event ID is required'
        });
        return;
      }

      // Get session details
      const session = await this.sessionRepository.findById(sessionId);
      if (!session) {
        res.status(404).json({
          success: false,
          error: 'Session not found'
        });
        return;
      }

      // Get client and RBT details
      const [client, rbt] = await Promise.all([
        this.clientRepository.findById(session.clientId),
        this.rbtRepository.findById(session.rbtId)
      ]);

      if (!client || !rbt) {
        res.status(404).json({
          success: false,
          error: 'Client or RBT not found'
        });
        return;
      }

      const result = await this.calendarService.updateSessionEvent(
        session,
        client,
        rbt,
        calendarEventId,
        provider
      );

      if (result.success) {
        logger.info('Calendar event updated successfully', {
          sessionId,
          calendarEventId,
          provider: result.provider
        });

        res.json({
          success: true,
          eventId: result.eventId,
          provider: result.provider,
          message: 'Calendar event updated successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error,
          provider: result.provider
        });
      }
    } catch (error) {
      logger.error('Error updating calendar event', {
        sessionId: req.params.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  /**
   * Cancel calendar event for a session
   */
  cancelSessionEvent = async (req: Request, res: Response): Promise<void> => {
    try {
      const { calendarEventId, provider = 'ical' } = req.body;

      if (!calendarEventId) {
        res.status(400).json({
          success: false,
          error: 'Calendar event ID is required'
        });
        return;
      }

      const result = await this.calendarService.cancelSessionEvent(
        calendarEventId,
        provider
      );

      if (result.success) {
        logger.info('Calendar event cancelled successfully', {
          calendarEventId,
          provider: result.provider
        });

        res.json({
          success: true,
          provider: result.provider,
          message: 'Calendar event cancelled successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error,
          provider: result.provider
        });
      }
    } catch (error) {
      logger.error('Error cancelling calendar event', {
        calendarEventId: req.body.calendarEventId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  /**
   * Generate and download iCal file for a session
   */
  downloadICalFile = async (req: Request, res: Response): Promise<void> => {
    try {
      const { sessionId } = req.params;

      if (!validateUUID(sessionId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid session ID format'
        });
        return;
      }

      // Get session details
      const session = await this.sessionRepository.findById(sessionId);
      if (!session) {
        res.status(404).json({
          success: false,
          error: 'Session not found'
        });
        return;
      }

      // Get client and RBT details
      const [client, rbt] = await Promise.all([
        this.clientRepository.findById(session.clientId),
        this.rbtRepository.findById(session.rbtId)
      ]);

      if (!client || !rbt) {
        res.status(404).json({
          success: false,
          error: 'Client or RBT not found'
        });
        return;
      }

      const icalContent = this.calendarService.generateICalFile(session, client, rbt);
      
      const filename = `aba-session-${sessionId}.ics`;
      
      res.setHeader('Content-Type', 'text/calendar');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(icalContent);

      logger.info('iCal file generated and downloaded', {
        sessionId,
        filename
      });
    } catch (error) {
      logger.error('Error generating iCal file', {
        sessionId: req.params.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  /**
   * Get calendar integration status for a session
   */
  getCalendarStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { sessionId } = req.params;

      if (!validateUUID(sessionId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid session ID format'
        });
        return;
      }

      // Get session details
      const session = await this.sessionRepository.findById(sessionId);
      if (!session) {
        res.status(404).json({
          success: false,
          error: 'Session not found'
        });
        return;
      }

      // In a real implementation, you would store calendar event IDs
      // and sync status in the database
      res.json({
        success: true,
        sessionId,
        calendarIntegration: {
          enabled: true,
          providers: ['ical', 'google'],
          lastSync: new Date().toISOString(),
          status: 'active'
        }
      });
    } catch (error) {
      logger.error('Error getting calendar status', {
        sessionId: req.params.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };
}