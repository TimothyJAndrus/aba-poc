import { Request, Response } from 'express';
import { 
  SessionSchedulingService,
  ScheduleSessionRequest,
  BulkScheduleRequest 
} from '../services/SessionSchedulingService';
import { SchedulingConstraintService } from '../services/SchedulingConstraintService';
import { ContinuityPreferenceService } from '../services/ContinuityPreferenceService';
import { SessionRepository } from '../database/repositories/SessionRepository';
import { TeamRepository } from '../database/repositories/TeamRepository';
import { RBTRepository } from '../database/repositories/RBTRepository';
import { ClientRepository } from '../database/repositories/ClientRepository';
import { validateUUID, validateDateString, validateTimeString } from '../utils/validation';
import { isBusinessDay, addHours } from '../utils/dateTime';

export interface ScheduleSessionRequestBody {
  clientId: string;
  preferredStartTime: string; // ISO string
  location: string;
  rbtId?: string;
  allowAlternatives?: boolean;
  maxAlternatives?: number;
}

export interface BulkScheduleRequestBody {
  clientId: string;
  dateRange: {
    startDate: string; // ISO string
    endDate: string; // ISO string
  };
  preferredTimes: Array<{
    dayOfWeek: number;
    startTime: string; // HH:MM
  }>;
  sessionsPerWeek: number;
  location: string;
}

export interface FindAlternativesRequestBody {
  clientId: string;
  preferredDate: string; // ISO string
  daysToSearch?: number;
}

export interface RescheduleSessionRequestBody {
  newStartTime: string; // ISO string
  reason?: string;
}

export interface GenerateScheduleRequestBody {
  clientIds: string[];
  dateRange: {
    startDate: string; // ISO string
    endDate: string; // ISO string
  };
  preferences?: {
    prioritizeContinuity?: boolean;
    maxSessionsPerDay?: number;
    preferredTimeSlots?: Array<{
      dayOfWeek: number;
      startTime: string;
      endTime: string;
    }>;
  };
}

/**
 * Controller for scheduling-related API endpoints
 * Handles session scheduling, rescheduling, and schedule generation
 */
export class SchedulingController {
  private schedulingService: SessionSchedulingService;

  constructor(
    sessionRepository: SessionRepository,
    teamRepository: TeamRepository,
    rbtRepository: RBTRepository,
    clientRepository: ClientRepository
  ) {
    const constraintService = new SchedulingConstraintService();
    const continuityService = new ContinuityPreferenceService();
    
    this.schedulingService = new SessionSchedulingService(
      constraintService,
      continuityService,
      sessionRepository,
      teamRepository,
      rbtRepository,
      clientRepository
    );
  }

  /**
   * POST /api/schedule/session
   * Schedules a single therapy session
   */
  async scheduleSession(req: Request, res: Response): Promise<void> {
    try {
      const body = req.body as ScheduleSessionRequestBody;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      // Validate request body
      const validation = this.validateScheduleSessionRequest(body);
      if (!validation.isValid) {
        res.status(400).json({ 
          error: 'Invalid request', 
          details: validation.errors 
        });
        return;
      }

      // Convert to service request
      const serviceRequest: ScheduleSessionRequest = {
        clientId: body.clientId,
        preferredStartTime: new Date(body.preferredStartTime),
        location: body.location,
        createdBy: userId,
        rbtId: body.rbtId,
        allowAlternatives: body.allowAlternatives ?? true,
        maxAlternatives: body.maxAlternatives ?? 5
      };

      // Schedule the session
      const result = await this.schedulingService.scheduleSession(serviceRequest);

      if (result.success) {
        res.status(201).json({
          success: true,
          session: result.session,
          rbtSelection: result.rbtSelectionDetails,
          message: result.message
        });
      } else {
        res.status(409).json({
          success: false,
          message: result.message,
          conflicts: result.conflicts,
          alternatives: result.alternatives
        });
      }

    } catch (error) {
      console.error('Error scheduling session:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * POST /api/schedule/bulk
   * Schedules multiple sessions across a date range
   */
  async bulkScheduleSessions(req: Request, res: Response): Promise<void> {
    try {
      const body = req.body as BulkScheduleRequestBody;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      // Validate request body
      const validation = this.validateBulkScheduleRequest(body);
      if (!validation.isValid) {
        res.status(400).json({ 
          error: 'Invalid request', 
          details: validation.errors 
        });
        return;
      }

      // Convert to service request
      const serviceRequest: BulkScheduleRequest = {
        clientId: body.clientId,
        dateRange: {
          startDate: new Date(body.dateRange.startDate),
          endDate: new Date(body.dateRange.endDate)
        },
        preferredTimes: body.preferredTimes,
        sessionsPerWeek: body.sessionsPerWeek,
        location: body.location,
        createdBy: userId
      };

      // Schedule the sessions
      const result = await this.schedulingService.bulkScheduleSessions(serviceRequest);

      res.status(200).json({
        success: true,
        summary: {
          totalRequested: result.totalRequested,
          successfullyScheduled: result.successfullyScheduled,
          failed: result.failed
        },
        scheduledSessions: result.scheduledSessions,
        failures: result.failures
      });

    } catch (error) {
      console.error('Error bulk scheduling sessions:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/schedule/alternatives
   * Finds alternative time slots for scheduling
   */
  async findAlternatives(req: Request, res: Response): Promise<void> {
    try {
      const { clientId, preferredDate, daysToSearch } = req.query;

      if (!clientId || typeof clientId !== 'string' || !validateUUID(clientId)) {
        res.status(400).json({ error: 'Valid client ID is required' });
        return;
      }

      if (!preferredDate || typeof preferredDate !== 'string') {
        res.status(400).json({ error: 'Preferred date is required' });
        return;
      }

      const searchDate = new Date(preferredDate);
      if (isNaN(searchDate.getTime())) {
        res.status(400).json({ error: 'Invalid date format' });
        return;
      }

      const searchDays = daysToSearch ? parseInt(daysToSearch as string) : 7;
      if (searchDays < 1 || searchDays > 30) {
        res.status(400).json({ error: 'Days to search must be between 1 and 30' });
        return;
      }

      // Find alternatives
      const alternatives = await this.schedulingService.findAlternativeTimeSlots(
        clientId,
        searchDate,
        searchDays
      );

      res.status(200).json({
        success: true,
        alternatives,
        searchCriteria: {
          clientId,
          preferredDate: searchDate,
          daysSearched: searchDays
        }
      });

    } catch (error) {
      console.error('Error finding alternatives:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * PUT /api/schedule/session/:sessionId/reschedule
   * Reschedules an existing session
   */
  async rescheduleSession(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const body = req.body as RescheduleSessionRequestBody;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      if (!validateUUID(sessionId)) {
        res.status(400).json({ error: 'Valid session ID is required' });
        return;
      }

      // Validate request body
      const validation = this.validateRescheduleRequest(body);
      if (!validation.isValid) {
        res.status(400).json({ 
          error: 'Invalid request', 
          details: validation.errors 
        });
        return;
      }

      const newStartTime = new Date(body.newStartTime);

      // Reschedule the session
      const result = await this.schedulingService.rescheduleSession(
        sessionId,
        newStartTime,
        userId,
        body.reason
      );

      if (result.success) {
        res.status(200).json({
          success: true,
          sessionId: result.sessionId,
          message: result.message
        });
      } else {
        res.status(409).json({
          success: false,
          message: result.message,
          conflicts: result.conflicts
        });
      }

    } catch (error) {
      console.error('Error rescheduling session:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/schedule/conflicts
   * Checks for scheduling conflicts in a date range
   */
  async checkConflicts(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate, rbtId, clientId } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({ error: 'Start date and end date are required' });
        return;
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        res.status(400).json({ error: 'Invalid date format' });
        return;
      }

      if (start >= end) {
        res.status(400).json({ error: 'Start date must be before end date' });
        return;
      }

      // Get session repository to check conflicts
      const sessionRepository = new SessionRepository();
      let sessions = await sessionRepository.findActiveByDateRange(start, end);

      // Filter by RBT or client if specified
      if (rbtId && typeof rbtId === 'string') {
        if (!validateUUID(rbtId)) {
          res.status(400).json({ error: 'Invalid RBT ID format' });
          return;
        }
        sessions = sessions.filter(s => s.rbtId === rbtId);
      }

      if (clientId && typeof clientId === 'string') {
        if (!validateUUID(clientId)) {
          res.status(400).json({ error: 'Invalid client ID format' });
          return;
        }
        sessions = sessions.filter(s => s.clientId === clientId);
      }

      // Analyze conflicts
      const conflicts = this.analyzeConflicts(sessions);

      res.status(200).json({
        success: true,
        dateRange: { startDate: start, endDate: end },
        totalSessions: sessions.length,
        conflicts,
        sessions: sessions.map(s => ({
          id: s.id,
          clientId: s.clientId,
          rbtId: s.rbtId,
          startTime: s.startTime,
          endTime: s.endTime,
          status: s.status
        }))
      });

    } catch (error) {
      console.error('Error checking conflicts:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * POST /api/schedule/generate
   * Generates optimized schedules for multiple clients
   */
  async generateSchedule(req: Request, res: Response): Promise<void> {
    try {
      const body = req.body as GenerateScheduleRequestBody;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      // Validate request body
      const validation = this.validateGenerateScheduleRequest(body);
      if (!validation.isValid) {
        res.status(400).json({ 
          error: 'Invalid request', 
          details: validation.errors 
        });
        return;
      }

      // This would implement a more complex scheduling algorithm
      // For now, return a placeholder response
      res.status(501).json({
        error: 'Not implemented',
        message: 'Schedule generation is not yet implemented'
      });

    } catch (error) {
      console.error('Error generating schedule:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Validates schedule session request
   */
  private validateScheduleSessionRequest(body: ScheduleSessionRequestBody): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!body.clientId || !validateUUID(body.clientId)) {
      errors.push('Valid client ID is required');
    }

    if (!body.preferredStartTime) {
      errors.push('Preferred start time is required');
    } else {
      const startTime = new Date(body.preferredStartTime);
      if (isNaN(startTime.getTime())) {
        errors.push('Invalid start time format');
      } else if (startTime < new Date()) {
        errors.push('Start time cannot be in the past');
      } else if (!isBusinessDay(startTime)) {
        errors.push('Sessions can only be scheduled on business days');
      }
    }

    if (!body.location || body.location.trim().length === 0) {
      errors.push('Location is required');
    } else if (body.location.length > 200) {
      errors.push('Location cannot exceed 200 characters');
    }

    if (body.rbtId && !validateUUID(body.rbtId)) {
      errors.push('Invalid RBT ID format');
    }

    if (body.maxAlternatives !== undefined && (body.maxAlternatives < 0 || body.maxAlternatives > 20)) {
      errors.push('Max alternatives must be between 0 and 20');
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validates bulk schedule request
   */
  private validateBulkScheduleRequest(body: BulkScheduleRequestBody): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!body.clientId || !validateUUID(body.clientId)) {
      errors.push('Valid client ID is required');
    }

    if (!body.dateRange || !body.dateRange.startDate || !body.dateRange.endDate) {
      errors.push('Date range with start and end dates is required');
    } else {
      const startDate = new Date(body.dateRange.startDate);
      const endDate = new Date(body.dateRange.endDate);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        errors.push('Invalid date format in date range');
      } else if (startDate >= endDate) {
        errors.push('Start date must be before end date');
      } else if (startDate < new Date()) {
        errors.push('Start date cannot be in the past');
      }
    }

    if (!Array.isArray(body.preferredTimes) || body.preferredTimes.length === 0) {
      errors.push('At least one preferred time is required');
    } else {
      body.preferredTimes.forEach((pref, index) => {
        if (typeof pref.dayOfWeek !== 'number' || pref.dayOfWeek < 0 || pref.dayOfWeek > 6) {
          errors.push(`Preferred time ${index + 1}: Day of week must be 0-6`);
        }
        if (!pref.startTime || !validateTimeString(pref.startTime)) {
          errors.push(`Preferred time ${index + 1}: Valid start time (HH:MM) is required`);
        }
      });
    }

    if (typeof body.sessionsPerWeek !== 'number' || body.sessionsPerWeek < 1 || body.sessionsPerWeek > 10) {
      errors.push('Sessions per week must be between 1 and 10');
    }

    if (!body.location || body.location.trim().length === 0) {
      errors.push('Location is required');
    } else if (body.location.length > 200) {
      errors.push('Location cannot exceed 200 characters');
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validates reschedule request
   */
  private validateRescheduleRequest(body: RescheduleSessionRequestBody): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!body.newStartTime) {
      errors.push('New start time is required');
    } else {
      const newStartTime = new Date(body.newStartTime);
      if (isNaN(newStartTime.getTime())) {
        errors.push('Invalid start time format');
      } else if (newStartTime < new Date()) {
        errors.push('New start time cannot be in the past');
      } else if (!isBusinessDay(newStartTime)) {
        errors.push('Sessions can only be scheduled on business days');
      }
    }

    if (body.reason && body.reason.length > 500) {
      errors.push('Reason cannot exceed 500 characters');
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validates generate schedule request
   */
  private validateGenerateScheduleRequest(body: GenerateScheduleRequestBody): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!Array.isArray(body.clientIds) || body.clientIds.length === 0) {
      errors.push('At least one client ID is required');
    } else {
      body.clientIds.forEach((clientId, index) => {
        if (!validateUUID(clientId)) {
          errors.push(`Client ID ${index + 1} is not a valid UUID`);
        }
      });
    }

    if (!body.dateRange || !body.dateRange.startDate || !body.dateRange.endDate) {
      errors.push('Date range with start and end dates is required');
    } else {
      const startDate = new Date(body.dateRange.startDate);
      const endDate = new Date(body.dateRange.endDate);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        errors.push('Invalid date format in date range');
      } else if (startDate >= endDate) {
        errors.push('Start date must be before end date');
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Analyzes sessions for conflicts
   */
  private analyzeConflicts(sessions: any[]): any[] {
    const conflicts: any[] = [];
    
    // Group sessions by RBT and check for overlaps
    const rbtSessions = new Map<string, any[]>();
    sessions.forEach(session => {
      if (!rbtSessions.has(session.rbtId)) {
        rbtSessions.set(session.rbtId, []);
      }
      rbtSessions.get(session.rbtId)!.push(session);
    });

    // Check for overlapping sessions for each RBT
    rbtSessions.forEach((rbtSessionList, rbtId) => {
      const sortedSessions = rbtSessionList.sort(
        (a, b) => a.startTime.getTime() - b.startTime.getTime()
      );

      for (let i = 0; i < sortedSessions.length - 1; i++) {
        const current = sortedSessions[i];
        const next = sortedSessions[i + 1];

        if (current.endTime > next.startTime) {
          conflicts.push({
            type: 'rbt_double_booked',
            rbtId,
            conflictingSessions: [current.id, next.id],
            description: `RBT has overlapping sessions`,
            sessions: [
              {
                id: current.id,
                startTime: current.startTime,
                endTime: current.endTime,
                clientId: current.clientId
              },
              {
                id: next.id,
                startTime: next.startTime,
                endTime: next.endTime,
                clientId: next.clientId
              }
            ]
          });
        }
      }
    });

    return conflicts;
  }
}