import { 
  SchedulingResult, 
  SchedulingConflict, 
  AlternativeOption,
  SchedulingConstraints 
} from '../types';
import { Session, CreateSessionRequest } from '../models/Session';
import { AvailabilitySlot } from '../models/AvailabilitySlot';
import { Team } from '../models/Team';
import { 
  SchedulingConstraintService, 
  SchedulingContext,
  ConstraintValidationResult 
} from './SchedulingConstraintService';
import { 
  ContinuityPreferenceService,
  RBTSelectionResult 
} from './ContinuityPreferenceService';
import { CalendarIntegrationService } from './CalendarIntegrationService';
import { SessionRepository } from '../database/repositories/SessionRepository';
import { TeamRepository } from '../database/repositories/TeamRepository';
import { RBTRepository } from '../database/repositories/RBTRepository';
import { ClientRepository } from '../database/repositories/ClientRepository';
import { getCacheService } from './CacheService';
import { getWebSocketService } from './WebSocketService';
import { addHours, isBusinessDay } from '../utils/dateTime';
import { generateAlternativeTimeSlots } from '../utils/scheduling';
import { logger } from '../utils/logger';
const { v4: uuidv4 } = require('uuid');

export interface ScheduleSessionRequest {
  clientId: string;
  preferredStartTime: Date;
  location: string;
  createdBy: string;
  rbtId?: string; // Optional - system will auto-assign if not provided
  allowAlternatives?: boolean; // Whether to return alternatives if preferred time unavailable
  maxAlternatives?: number; // Maximum number of alternatives to return
}

export interface ScheduleSessionResponse extends SchedulingResult {
  session?: Session | undefined;
  rbtSelectionDetails?: RBTSelectionResult | undefined;
  constraintValidation?: ConstraintValidationResult | undefined;
}

export interface BulkScheduleRequest {
  clientId: string;
  dateRange: {
    startDate: Date;
    endDate: Date;
  };
  preferredTimes: Array<{
    dayOfWeek: number; // 0-6
    startTime: string; // HH:MM
  }>;
  sessionsPerWeek: number;
  location: string;
  createdBy: string;
}

export interface BulkScheduleResponse {
  totalRequested: number;
  successfullyScheduled: number;
  failed: number;
  scheduledSessions: Session[];
  failures: Array<{
    date: Date;
    reason: string;
    conflicts: SchedulingConflict[];
  }>;
}

/**
 * Core session scheduling service that orchestrates constraint validation,
 * RBT selection, and session creation with continuity preferences
 */
export class SessionSchedulingService {
  constructor(
    private constraintService: SchedulingConstraintService,
    private continuityService: ContinuityPreferenceService,
    private sessionRepository: SessionRepository,
    private teamRepository: TeamRepository,
    private rbtRepository: RBTRepository,
    private clientRepository: ClientRepository,
    private calendarService?: CalendarIntegrationService
  ) {}

  /**
   * Schedules a single session with automatic RBT selection and constraint validation
   */
  async scheduleSession(request: ScheduleSessionRequest): Promise<ScheduleSessionResponse> {
    try {
      // 1. Build scheduling context
      const context = await this.buildSchedulingContext(request.clientId);
      
      // 2. Calculate session end time
      const endTime = addHours(request.preferredStartTime, context.constraints.sessionDuration);
      
      // 3. Create session request
      let sessionRequest: CreateSessionRequest;
      if (request.rbtId) {
        sessionRequest = {
          clientId: request.clientId,
          rbtId: request.rbtId,
          startTime: request.preferredStartTime,
          endTime,
          location: request.location,
          createdBy: request.createdBy
        };
      } else {
        // Will be set after RBT selection
        sessionRequest = {
          clientId: request.clientId,
          startTime: request.preferredStartTime,
          endTime,
          location: request.location,
          createdBy: request.createdBy
        } as CreateSessionRequest;
      }

      // 4. If no RBT specified, auto-select based on continuity
      let rbtSelectionDetails: RBTSelectionResult | undefined;
      if (!sessionRequest.rbtId) {
        const availableRBTs = await this.findAvailableRBTs(
          context.teamMembers,
          request.preferredStartTime,
          endTime,
          context
        );

        if (availableRBTs.length === 0) {
          const alternatives = request.allowAlternatives ? 
            await this.generateAlternatives(request, context) : [];
          
          return {
            success: false,
            message: 'No available RBTs found for the requested time',
            conflicts: [{
              type: 'rbt_unavailable',
              description: 'No team members are available at the requested time',
              suggestedResolution: 'Try a different time or add more RBTs to the team'
            }],
            alternatives
          };
        }

        // Get session history for continuity calculation
        const sessionHistory = await this.sessionRepository.findByClientId(request.clientId);
        const team = await this.teamRepository.findActiveByClientId(request.clientId);
        
        rbtSelectionDetails = this.continuityService.selectOptimalRBT(
          availableRBTs,
          request.clientId,
          sessionHistory,
          team || undefined
        );

        sessionRequest.rbtId = rbtSelectionDetails.selectedRBTId;
      }

      // 5. Validate all constraints
      const validation = await this.constraintService.validateSessionConstraints(
        sessionRequest,
        context
      );

      if (!validation.isValid) {
        const alternatives = request.allowAlternatives ? 
          await this.generateAlternatives(request, context) : [];
          
        return {
          success: false,
          message: 'Session violates scheduling constraints',
          conflicts: validation.violations,
          constraintValidation: validation,
          rbtSelectionDetails,
          alternatives
        };
      }

      // 6. Create the session
      const session = await this.createSession(sessionRequest);

      return {
        success: true,
        sessionId: session.id,
        session,
        message: 'Session scheduled successfully',
        rbtSelectionDetails,
        constraintValidation: validation
      };

    } catch (error) {
      return {
        success: false,
        message: `Failed to schedule session: ${error instanceof Error ? error.message : 'Unknown error'}`,
        conflicts: [{
          type: 'rbt_unavailable',
          description: 'System error occurred during scheduling',
          suggestedResolution: 'Please try again or contact support'
        }]
      };
    }
  }

  /**
   * Schedules multiple sessions across a date range
   */
  async bulkScheduleSessions(request: BulkScheduleRequest): Promise<BulkScheduleResponse> {
    const response: BulkScheduleResponse = {
      totalRequested: 0,
      successfullyScheduled: 0,
      failed: 0,
      scheduledSessions: [],
      failures: []
    };

    // Generate target dates based on preferences
    const targetDates = this.generateTargetDates(request);
    response.totalRequested = targetDates.length;

    // Schedule each session
    for (const targetDate of targetDates) {
      try {
        const scheduleRequest: ScheduleSessionRequest = {
          clientId: request.clientId,
          preferredStartTime: targetDate,
          location: request.location,
          createdBy: request.createdBy,
          allowAlternatives: false // Don't generate alternatives for bulk scheduling
        };

        const result = await this.scheduleSession(scheduleRequest);
        
        if (result.success && result.session) {
          response.scheduledSessions.push(result.session);
          response.successfullyScheduled++;
        } else {
          response.failures.push({
            date: targetDate,
            reason: result.message || 'Unknown error',
            conflicts: result.conflicts || []
          });
          response.failed++;
        }
      } catch (error) {
        response.failures.push({
          date: targetDate,
          reason: error instanceof Error ? error.message : 'Unknown error',
          conflicts: []
        });
        response.failed++;
      }
    }

    return response;
  }

  /**
   * Finds alternative time slots when preferred time is unavailable
   */
  async findAlternativeTimeSlots(
    clientId: string,
    preferredDate: Date,
    daysToSearch: number = 7
  ): Promise<AlternativeOption[]> {
    const context = await this.buildSchedulingContext(clientId);
    const alternatives: AlternativeOption[] = [];
    
    // Search for alternatives within the specified number of days
    for (let dayOffset = 0; dayOffset <= daysToSearch; dayOffset++) {
      const searchDate = new Date(preferredDate);
      searchDate.setDate(searchDate.getDate() + dayOffset);
      
      if (!isBusinessDay(searchDate)) continue;

      // Find available slots for this date
      const availableSlots = await this.constraintService.findAvailableTimeSlots(
        clientId,
        searchDate,
        context
      );

      // Convert to alternative options with continuity scores
      for (const [rbtId, timeSlots] of availableSlots) {
        const sessionHistory = await this.sessionRepository.findByClientId(clientId);
        const continuityScore = this.continuityService.calculateContinuityScore(
          rbtId,
          clientId,
          sessionHistory
        );

        for (const slot of timeSlots) {
          const startTime = new Date(searchDate);
          const [hours, minutes] = slot.startTime.split(':').map(Number);
          startTime.setHours(hours || 0, minutes || 0, 0, 0);
          
          const endTime = new Date(startTime);
          endTime.setHours(endTime.getHours() + context.constraints.sessionDuration);

          alternatives.push({
            rbtId,
            startTime,
            endTime,
            continuityScore: continuityScore.score,
            availability: dayOffset === 0 ? 'preferred' : 
                         dayOffset <= 3 ? 'available' : 'possible'
          });
        }
      }
    }

    // Sort by continuity score and availability preference
    alternatives.sort((a, b) => {
      const availabilityScore = (opt: AlternativeOption) => 
        opt.availability === 'preferred' ? 3 : 
        opt.availability === 'available' ? 2 : 1;
      
      const scoreA = availabilityScore(a) * 100 + a.continuityScore;
      const scoreB = availabilityScore(b) * 100 + b.continuityScore;
      
      return scoreB - scoreA;
    });

    return alternatives.slice(0, 10); // Return top 10 alternatives
  }

  /**
   * Reschedules an existing session to a new time
   */
  async rescheduleSession(
    sessionId: string,
    newStartTime: Date,
    updatedBy: string,
    reason?: string
  ): Promise<SchedulingResult> {
    try {
      // Get existing session
      const existingSession = await this.sessionRepository.findById(sessionId);
      if (!existingSession) {
        return {
          success: false,
          message: 'Session not found'
        };
      }

      // Build context for validation
      const context = await this.buildSchedulingContext(existingSession.clientId);
      
      // Calculate new end time
      const newEndTime = addHours(newStartTime, context.constraints.sessionDuration);
      
      // Create update request
      const updateRequest: CreateSessionRequest = {
        clientId: existingSession.clientId,
        rbtId: existingSession.rbtId,
        startTime: newStartTime,
        endTime: newEndTime,
        location: existingSession.location,
        createdBy: updatedBy
      };

      // Validate constraints (excluding the current session from conflicts)
      const filteredContext = {
        ...context,
        existingSessions: context.existingSessions.filter(s => s.id !== sessionId)
      };
      
      const validation = await this.constraintService.validateSessionConstraints(
        updateRequest,
        filteredContext
      );

      if (!validation.isValid) {
        return {
          success: false,
          message: 'New time violates scheduling constraints',
          conflicts: validation.violations
        };
      }

      // Update the session
      const updatedSession = await this.sessionRepository.update(sessionId, {
        startTime: newStartTime,
        endTime: newEndTime,
        updatedBy
      });

      return {
        success: true,
        sessionId: updatedSession?.id || sessionId,
        message: 'Session rescheduled successfully'
      };

    } catch (error) {
      return {
        success: false,
        message: `Failed to reschedule session: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Builds scheduling context with all necessary data
   */
  private async buildSchedulingContext(clientId: string): Promise<SchedulingContext> {
    // Get client's team
    const team = await this.teamRepository.findActiveByClientId(clientId);
    if (!team) {
      throw new Error('No active team found for client');
    }

    // Get existing sessions
    const existingSessions = await this.sessionRepository.findActiveByDateRange(
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)   // 90 days ahead
    );

    // Get RBT availability
    const rbtAvailability = await this.getRBTAvailability(team.rbtIds);

    // Get session history for continuity calculations
    const sessionHistory = await this.sessionRepository.findByClientId(clientId);

    return {
      clientId,
      teamMembers: team.rbtIds,
      existingSessions,
      rbtAvailability,
      sessionHistory: sessionHistory.map(s => ({
        rbtId: s.rbtId,
        clientId: s.clientId,
        sessionDate: s.startTime
      })),
      constraints: this.constraintService.getDefaultConstraints()
    };
  }

  /**
   * Gets availability slots for multiple RBTs
   */
  private async getRBTAvailability(rbtIds: string[]): Promise<AvailabilitySlot[]> {
    const availability: AvailabilitySlot[] = [];
    
    for (const rbtId of rbtIds) {
      const rbt = await this.rbtRepository.findById(rbtId);
      if (rbt && rbt.isActive) {
        // In a real implementation, this would fetch from an AvailabilitySlotRepository
        // For now, we'll create default business hours availability
        const defaultSlots = this.createDefaultAvailability(rbtId);
        availability.push(...defaultSlots);
      }
    }
    
    return availability;
  }

  /**
   * Creates default availability slots for an RBT (business hours, Monday-Friday)
   */
  private createDefaultAvailability(rbtId: string): AvailabilitySlot[] {
    const slots: AvailabilitySlot[] = [];
    
    // Create availability for Monday-Friday, 9 AM - 7 PM
    for (let dayOfWeek = 1; dayOfWeek <= 5; dayOfWeek++) {
      slots.push({
        id: uuidv4(),
        rbtId,
        dayOfWeek,
        startTime: '09:00',
        endTime: '19:00',
        isRecurring: true,
        effectiveDate: new Date(),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    
    return slots;
  }

  /**
   * Finds RBTs available for a specific time slot with caching
   */
  private async findAvailableRBTs(
    teamMembers: string[],
    startTime: Date,
    endTime: Date,
    context: SchedulingContext
  ): Promise<string[]> {
    // Try to get from cache first
    const cacheService = getCacheService();
    const cacheKey = `available_rbts:${teamMembers.join(',')}_${startTime.toISOString()}_${endTime.toISOString()}`;
    
    try {
      const cachedResult = await cacheService.get<string[]>(cacheKey, { 
        prefix: 'scheduling', 
        ttl: 300 // 5 minutes TTL for availability data
      });
      
      if (cachedResult) {
        logger.debug('Using cached available RBTs', { 
          teamMembers: teamMembers.length,
          startTime,
          availableCount: cachedResult.length 
        });
        return cachedResult;
      }
    } catch (error) {
      logger.warn('Failed to get cached available RBTs', { error: error.message });
    }

    // Calculate available RBTs
    const availableRBTs: string[] = [];
    
    for (const rbtId of teamMembers) {
      const rbtCheck = await this.constraintService['checkRBTAvailability'](
        rbtId,
        startTime,
        endTime,
        context
      );
      
      if (rbtCheck.isAvailable) {
        availableRBTs.push(rbtId);
      }
    }

    // Cache the result
    try {
      await cacheService.set(cacheKey, availableRBTs, { 
        prefix: 'scheduling', 
        ttl: 300 
      });
      
      logger.debug('Cached available RBTs result', { 
        teamMembers: teamMembers.length,
        startTime,
        availableCount: availableRBTs.length 
      });
    } catch (error) {
      logger.warn('Failed to cache available RBTs', { error: error.message });
    }
    
    return availableRBTs;
  }

  /**
   * Generates alternative time slots for a scheduling request
   */
  private async generateAlternatives(
    request: ScheduleSessionRequest,
    context: SchedulingContext
  ): Promise<AlternativeOption[]> {
    return this.findAlternativeTimeSlots(
      request.clientId,
      request.preferredStartTime,
      7 // Search 7 days ahead
    );
  }

  /**
   * Creates a new session in the database with cache invalidation and real-time updates
   */
  private async createSession(request: CreateSessionRequest): Promise<Session> {
    const session: Session = {
      id: uuidv4(),
      clientId: request.clientId,
      rbtId: request.rbtId!,
      startTime: request.startTime,
      endTime: request.endTime,
      status: 'scheduled',
      location: request.location,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: request.createdBy
    };

    // Create session in database
    const createdSession = await this.sessionRepository.create(session);

    // Invalidate relevant cache entries
    try {
      const cacheService = getCacheService();
      await cacheService.invalidateScheduleCache(session.clientId, session.rbtId);
      await cacheService.invalidateAvailabilityCache(session.clientId, session.startTime);
      
      logger.info('Cache invalidated after session creation', { 
        sessionId: createdSession.id,
        clientId: session.clientId,
        rbtId: session.rbtId 
      });
    } catch (error) {
      logger.warn('Failed to invalidate cache after session creation', { 
        sessionId: createdSession.id,
        error: error.message 
      });
    }

    // Send real-time update via WebSocket
    try {
      const webSocketService = getWebSocketService();
      webSocketService.broadcastScheduleUpdate({
        type: 'session_created',
        sessionId: createdSession.id,
        clientId: session.clientId,
        rbtId: session.rbtId,
        data: {
          session: createdSession,
          startTime: session.startTime,
          endTime: session.endTime,
          location: session.location
        },
        timestamp: new Date()
      });

      logger.info('Real-time update sent for session creation', { 
        sessionId: createdSession.id 
      });
    } catch (error) {
      logger.warn('Failed to send real-time update for session creation', { 
        sessionId: createdSession.id,
        error: error.message 
      });
    }

    // Create calendar event if calendar service is available
    if (this.calendarService) {
      try {
        const [client, rbt] = await Promise.all([
          this.clientRepository.findById(session.clientId),
          this.rbtRepository.findById(session.rbtId!)
        ]);

        if (client && rbt) {
          const calendarResult = await this.calendarService.createSessionEvent(
            createdSession,
            client,
            rbt,
            'ical'
          );

          if (calendarResult.success) {
            logger.info('Calendar event created for session', {
              sessionId: createdSession.id,
              eventId: calendarResult.eventId,
              provider: calendarResult.provider
            });
          } else {
            logger.warn('Failed to create calendar event for session', {
              sessionId: createdSession.id,
              error: calendarResult.error,
              provider: calendarResult.provider
            });
          }
        }
      } catch (error) {
        logger.warn('Error creating calendar event for session', {
          sessionId: createdSession.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return createdSession;
  }

  /**
   * Generates target dates for bulk scheduling based on preferences
   */
  private generateTargetDates(request: BulkScheduleRequest): Date[] {
    const targetDates: Date[] = [];
    const currentDate = new Date(request.dateRange.startDate);
    const endDate = new Date(request.dateRange.endDate);
    
    let weekCount = 0;
    let sessionsThisWeek = 0;
    let currentWeekStart = this.getWeekStart(currentDate);
    
    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      
      // Check if this day matches any preferred times
      const matchingPreference = request.preferredTimes.find(
        pref => pref.dayOfWeek === dayOfWeek
      );
      
      if (matchingPreference && isBusinessDay(currentDate)) {
        // Check if we haven't exceeded sessions per week
        const weekStart = this.getWeekStart(currentDate);
        if (weekStart.getTime() !== currentWeekStart.getTime()) {
          // New week
          currentWeekStart = weekStart;
          sessionsThisWeek = 0;
          weekCount++;
        }
        
        if (sessionsThisWeek < request.sessionsPerWeek) {
          const targetDate = new Date(currentDate);
          const [hours, minutes] = matchingPreference.startTime.split(':').map(Number);
          targetDate.setHours(hours || 0, minutes || 0, 0, 0);
          
          targetDates.push(targetDate);
          sessionsThisWeek++;
        }
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return targetDates;
  }

  /**
   * Gets the start of the week (Monday) for a given date
   */
  private getWeekStart(date: Date): Date {
    const result = new Date(date);
    const dayOfWeek = result.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    result.setDate(result.getDate() + diff);
    result.setHours(0, 0, 0, 0);
    return result;
  }
}