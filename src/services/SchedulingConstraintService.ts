import { 
  SchedulingConstraints, 
  SchedulingConflict, 
  ContinuityScore,
  AlternativeOption,
  SchedulingResult 
} from '../types';
import { Session, CreateSessionRequest } from '../models/Session';
import { AvailabilitySlot, TimeSlot } from '../models/AvailabilitySlot';
import { Team } from '../models/Team';
import { 
  isWithinBusinessHours, 
  getDurationInHours, 
  isTimeSlotAvailable,
  isBusinessDay,
  addHours 
} from '../utils/dateTime';
import { 
  validateSchedulingConstraints,
  calculateContinuityScore,
  detectSchedulingConflicts 
} from '../utils/scheduling';

export interface ConstraintValidationResult {
  isValid: boolean;
  violations: SchedulingConflict[];
  score: number; // Overall scheduling quality score (0-100)
}

export interface RBTAvailabilityCheck {
  rbtId: string;
  isAvailable: boolean;
  conflicts: SchedulingConflict[];
  availabilitySlots: AvailabilitySlot[];
}

export interface ClientAvailabilityCheck {
  clientId: string;
  isAvailable: boolean;
  conflicts: SchedulingConflict[];
  existingSessions: Session[];
}

export interface SchedulingContext {
  clientId: string;
  teamMembers: string[]; // RBT IDs
  existingSessions: Session[];
  rbtAvailability: AvailabilitySlot[];
  sessionHistory: Array<{ rbtId: string; clientId: string; sessionDate: Date }>;
  constraints: SchedulingConstraints;
}

/**
 * Core constraint satisfaction service for ABA scheduling
 * Implements business rules and validation logic for session scheduling
 */
export class SchedulingConstraintService {
  private readonly DEFAULT_CONSTRAINTS: SchedulingConstraints = {
    businessHours: {
      startTime: '09:00',
      endTime: '19:00',
      validDays: [1, 2, 3, 4, 5] // Monday-Friday
    },
    sessionDuration: 3, // 3 hours for ABA sessions
    maxSessionsPerDay: 2, // Maximum sessions per RBT per day
    minBreakBetweenSessions: 30 // 30 minutes minimum break
  };

  /**
   * Validates all scheduling constraints for a proposed session
   */
  async validateSessionConstraints(
    request: CreateSessionRequest,
    context: SchedulingContext
  ): Promise<ConstraintValidationResult> {
    const violations: SchedulingConflict[] = [];
    let score = 100; // Start with perfect score

    // 1. Validate basic time constraints
    const timeValidation = this.validateTimeConstraints(
      request.startTime,
      request.endTime,
      context.constraints
    );
    violations.push(...timeValidation.violations);
    score -= timeValidation.violations.length * 20;

    // 2. Check RBT availability and conflicts
    if (request.rbtId) {
      const rbtCheck = await this.checkRBTAvailability(
        request.rbtId,
        request.startTime,
        request.endTime,
        context
      );
      violations.push(...rbtCheck.conflicts);
      score -= rbtCheck.conflicts.length * 15;
    }

    // 3. Check client availability and conflicts
    const clientCheck = await this.checkClientAvailability(
      request.clientId,
      request.startTime,
      request.endTime,
      context
    );
    violations.push(...clientCheck.conflicts);
    score -= clientCheck.conflicts.length * 15;

    // 4. Validate team membership (if RBT specified)
    if (request.rbtId && !context.teamMembers.includes(request.rbtId)) {
      violations.push({
        type: 'rbt_unavailable',
        description: 'RBT is not a member of the client\'s team',
        suggestedResolution: 'Select an RBT from the client\'s assigned team'
      });
      score -= 25;
    }

    // 5. Check daily session limits
    const dailyLimitCheck = this.validateDailySessionLimits(
      request.rbtId || '',
      request.startTime,
      context
    );
    violations.push(...dailyLimitCheck);
    score -= dailyLimitCheck.length * 10;

    return {
      isValid: violations.length === 0,
      violations,
      score: Math.max(0, score)
    };
  }

  /**
   * Validates basic time constraints (business hours, duration, business days)
   */
  private validateTimeConstraints(
    startTime: Date,
    endTime: Date,
    constraints: SchedulingConstraints
  ): { violations: SchedulingConflict[] } {
    const violations: SchedulingConflict[] = [];

    // Check business hours
    if (!isWithinBusinessHours(startTime) || !isWithinBusinessHours(endTime)) {
      violations.push({
        type: 'business_hours_violation',
        description: 'Session must be within business hours (9:00 AM - 7:00 PM)',
        suggestedResolution: 'Schedule session between 9:00 AM and 7:00 PM'
      });
    }

    // Check session duration
    const duration = getDurationInHours(startTime, endTime);
    if (Math.abs(duration - constraints.sessionDuration) > 0.1) { // Allow small floating point differences
      violations.push({
        type: 'business_hours_violation',
        description: `Session duration must be exactly ${constraints.sessionDuration} hours`,
        suggestedResolution: `Adjust session to be ${constraints.sessionDuration} hours long`
      });
    }

    // Check business days
    if (!isBusinessDay(startTime)) {
      violations.push({
        type: 'business_hours_violation',
        description: 'Sessions can only be scheduled on business days (Monday-Friday)',
        suggestedResolution: 'Schedule session on a weekday'
      });
    }

    // Check if session is in the past
    if (startTime < new Date()) {
      violations.push({
        type: 'business_hours_violation',
        description: 'Session cannot be scheduled in the past',
        suggestedResolution: 'Select a future date and time'
      });
    }

    return { violations };
  }

  /**
   * Checks RBT availability for the proposed time slot
   */
  public async checkRBTAvailability(
    rbtId: string,
    startTime: Date,
    endTime: Date,
    context: SchedulingContext
  ): Promise<RBTAvailabilityCheck> {
    const conflicts: SchedulingConflict[] = [];
    
    // Get RBT's availability slots for the day
    const dayOfWeek = startTime.getDay();
    const rbtSlots = context.rbtAvailability.filter(
      slot => slot.rbtId === rbtId && 
              slot.dayOfWeek === dayOfWeek &&
              slot.isActive &&
              (!slot.endDate || slot.endDate >= startTime)
    );

    // Check if RBT has availability during requested time
    const hasAvailability = rbtSlots.some(slot => {
      const slotStart = new Date(startTime);
      const [startHour, startMin] = slot.startTime.split(':').map(Number);
      slotStart.setHours(startHour || 0, startMin || 0, 0, 0);
      
      const slotEnd = new Date(startTime);
      const [endHour, endMin] = slot.endTime.split(':').map(Number);
      slotEnd.setHours(endHour || 0, endMin || 0, 0, 0);

      return startTime >= slotStart && endTime <= slotEnd;
    });

    if (!hasAvailability) {
      conflicts.push({
        type: 'rbt_unavailable',
        description: 'RBT is not available during the requested time slot',
        suggestedResolution: 'Select a time when the RBT is available'
      });
    }

    // Check for existing session conflicts
    const existingRBTSessions = context.existingSessions.filter(
      session => session.rbtId === rbtId &&
                 session.status !== 'cancelled' &&
                 session.status !== 'no_show'
    );

    const sessionConflicts = detectSchedulingConflicts(
      startTime,
      endTime,
      existingRBTSessions.map(s => ({
        startTime: s.startTime,
        endTime: s.endTime,
        sessionId: s.id
      }))
    );

    sessionConflicts.forEach(conflict => {
      conflicts.push({
        type: 'rbt_unavailable',
        description: 'RBT has a conflicting session at this time',
        conflictingSessionId: conflict.sessionId,
        suggestedResolution: 'Select a different time slot'
      });
    });

    return {
      rbtId,
      isAvailable: conflicts.length === 0,
      conflicts,
      availabilitySlots: rbtSlots
    };
  }

  /**
   * Checks client availability for the proposed time slot
   */
  private async checkClientAvailability(
    clientId: string,
    startTime: Date,
    endTime: Date,
    context: SchedulingContext
  ): Promise<ClientAvailabilityCheck> {
    const conflicts: SchedulingConflict[] = [];
    
    // Check for existing session conflicts for the client
    const existingClientSessions = context.existingSessions.filter(
      session => session.clientId === clientId &&
                 session.status !== 'cancelled' &&
                 session.status !== 'no_show'
    );

    const sessionConflicts = detectSchedulingConflicts(
      startTime,
      endTime,
      existingClientSessions.map(s => ({
        startTime: s.startTime,
        endTime: s.endTime,
        sessionId: s.id
      }))
    );

    sessionConflicts.forEach(conflict => {
      conflicts.push({
        type: 'client_unavailable',
        description: 'Client has a conflicting session at this time',
        conflictingSessionId: conflict.sessionId,
        suggestedResolution: 'Select a different time slot'
      });
    });

    return {
      clientId,
      isAvailable: conflicts.length === 0,
      conflicts,
      existingSessions: existingClientSessions
    };
  }

  /**
   * Validates daily session limits for RBTs
   */
  private validateDailySessionLimits(
    rbtId: string,
    sessionDate: Date,
    context: SchedulingContext
  ): SchedulingConflict[] {
    const conflicts: SchedulingConflict[] = [];
    
    if (!rbtId) return conflicts;

    // Count existing sessions for the RBT on the same day
    const dayStart = new Date(sessionDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(sessionDate);
    dayEnd.setHours(23, 59, 59, 999);

    const dailySessions = context.existingSessions.filter(
      session => session.rbtId === rbtId &&
                 session.status !== 'cancelled' &&
                 session.status !== 'no_show' &&
                 session.startTime >= dayStart &&
                 session.startTime <= dayEnd
    );

    if (dailySessions.length >= context.constraints.maxSessionsPerDay) {
      conflicts.push({
        type: 'rbt_unavailable',
        description: `RBT has reached maximum sessions per day (${context.constraints.maxSessionsPerDay})`,
        suggestedResolution: 'Select a different RBT or schedule on a different day'
      });
    }

    // Check minimum break between sessions
    const proposedStart = sessionDate;
    const proposedEnd = addHours(sessionDate, context.constraints.sessionDuration);

    for (const existingSession of dailySessions) {
      const timeBetween = Math.min(
        Math.abs(proposedStart.getTime() - existingSession.endTime.getTime()),
        Math.abs(existingSession.startTime.getTime() - proposedEnd.getTime())
      ) / (1000 * 60); // Convert to minutes

      if (timeBetween < context.constraints.minBreakBetweenSessions) {
        conflicts.push({
          type: 'rbt_unavailable',
          description: `Insufficient break time between sessions (minimum ${context.constraints.minBreakBetweenSessions} minutes required)`,
          conflictingSessionId: existingSession.id,
          suggestedResolution: 'Allow more time between sessions'
        });
      }
    }

    return conflicts;
  }

  /**
   * Finds all available time slots for a client's team members
   */
  async findAvailableTimeSlots(
    clientId: string,
    date: Date,
    context: SchedulingContext
  ): Promise<Map<string, TimeSlot[]>> {
    const availableSlots = new Map<string, TimeSlot[]>();
    
    for (const rbtId of context.teamMembers) {
      const slots = await this.getRBTAvailableSlots(rbtId, date, context);
      if (slots.length > 0) {
        availableSlots.set(rbtId, slots);
      }
    }

    return availableSlots;
  }

  /**
   * Gets available time slots for a specific RBT on a given date
   */
  private async getRBTAvailableSlots(
    rbtId: string,
    date: Date,
    context: SchedulingContext
  ): Promise<TimeSlot[]> {
    const dayOfWeek = date.getDay();
    const availableSlots: TimeSlot[] = [];

    // Get RBT's availability for the day
    const rbtAvailability = context.rbtAvailability.filter(
      slot => slot.rbtId === rbtId && 
              slot.dayOfWeek === dayOfWeek &&
              slot.isActive &&
              (!slot.endDate || slot.endDate >= date)
    );

    // Get existing sessions for the RBT on this date
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const existingSessions = context.existingSessions.filter(
      session => session.rbtId === rbtId &&
                 session.status !== 'cancelled' &&
                 session.status !== 'no_show' &&
                 session.startTime >= dayStart &&
                 session.startTime <= dayEnd
    );

    // For each availability slot, find free time periods
    for (const availability of rbtAvailability) {
      const slotStart = new Date(date);
      const [startHour, startMin] = availability.startTime.split(':').map(Number);
      slotStart.setHours(startHour || 0, startMin || 0, 0, 0);
      
      const slotEnd = new Date(date);
      const [endHour, endMin] = availability.endTime.split(':').map(Number);
      slotEnd.setHours(endHour || 0, endMin || 0, 0, 0);

      // Find gaps between existing sessions
      const freeSlots = this.findFreeTimeSlots(
        slotStart,
        slotEnd,
        existingSessions,
        context.constraints.sessionDuration
      );

      availableSlots.push(...freeSlots);
    }

    return availableSlots;
  }

  /**
   * Finds free time slots within a given time range, avoiding existing sessions
   */
  private findFreeTimeSlots(
    rangeStart: Date,
    rangeEnd: Date,
    existingSessions: Session[],
    sessionDuration: number
  ): TimeSlot[] {
    const freeSlots: TimeSlot[] = [];
    const sessionDurationMs = sessionDuration * 60 * 60 * 1000; // Convert to milliseconds

    // Sort existing sessions by start time
    const sortedSessions = existingSessions
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    let currentTime = new Date(rangeStart);

    for (const session of sortedSessions) {
      // Check if there's a gap before this session
      const gapDuration = session.startTime.getTime() - currentTime.getTime();
      
      if (gapDuration >= sessionDurationMs) {
        const slotEnd = new Date(currentTime.getTime() + sessionDurationMs);
        
        // Ensure the slot doesn't exceed the range end
        if (slotEnd <= rangeEnd) {
          freeSlots.push({
            startTime: currentTime.toTimeString().substring(0, 5),
            endTime: slotEnd.toTimeString().substring(0, 5),
            duration: sessionDuration * 60, // in minutes
            isAvailable: true
          });
        }
      }

      // Move current time to after this session
      currentTime = new Date(Math.max(currentTime.getTime(), session.endTime.getTime()));
    }

    // Check for a gap after the last session
    const finalGapDuration = rangeEnd.getTime() - currentTime.getTime();
    if (finalGapDuration >= sessionDurationMs) {
      const slotEnd = new Date(currentTime.getTime() + sessionDurationMs);
      
      if (slotEnd <= rangeEnd) {
        freeSlots.push({
          startTime: currentTime.toTimeString().substring(0, 5),
          endTime: slotEnd.toTimeString().substring(0, 5),
          duration: sessionDuration * 60, // in minutes
          isAvailable: true
        });
      }
    }

    return freeSlots;
  }

  /**
   * Gets default scheduling constraints
   */
  getDefaultConstraints(): SchedulingConstraints {
    return { ...this.DEFAULT_CONSTRAINTS };
  }
}