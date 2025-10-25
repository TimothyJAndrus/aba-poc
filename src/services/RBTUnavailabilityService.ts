import { Session } from '../models/Session';
import { ScheduleEvent } from '../models/ScheduleEvent';
import { AlternativeOption, SchedulingResult } from '../types';
import { SessionRepository } from '../database/repositories/SessionRepository';
import { ScheduleEventRepository } from '../database/repositories/ScheduleEventRepository';
import { TeamRepository } from '../database/repositories/TeamRepository';
import { RBTRepository } from '../database/repositories/RBTRepository';
import { SessionSchedulingService } from './SessionSchedulingService';
import { ContinuityPreferenceService } from './ContinuityPreferenceService';
import { SessionCancellationService } from './SessionCancellationService';
import { getDatabase } from '../database/connection';

export interface RBTUnavailabilityRequest {
  rbtId: string;
  startDate: Date;
  endDate: Date;
  reason: string;
  unavailabilityType: 'sick_leave' | 'vacation' | 'emergency' | 'other';
  reportedBy: string;
  autoReassign?: boolean;
  notifyAffectedParties?: boolean;
}

export interface RBTUnavailabilityResponse extends SchedulingResult {
  affectedSessions: Session[];
  reassignmentResults: SessionReassignmentResult[];
  scheduleEvent?: ScheduleEvent;
  unavailabilityId?: string;
}

export interface SessionReassignmentResult {
  originalSession: Session;
  reassignmentStatus: 'successful' | 'failed' | 'pending';
  newRbtId?: string;
  newStartTime?: Date;
  newEndTime?: Date;
  reassignmentReason?: string;
  errorMessage?: string;
  continuityScore?: number;
}

export interface UnavailabilityPeriod {
  id: string;
  rbtId: string;
  startDate: Date;
  endDate: Date;
  reason: string;
  unavailabilityType: 'sick_leave' | 'vacation' | 'emergency' | 'other';
  status: 'active' | 'resolved' | 'cancelled';
  reportedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReassignmentStrategy {
  prioritizeTeamMembers: boolean;
  maintainContinuity: boolean;
  allowTimeChanges: boolean;
  maxDaysToReschedule: number;
  notificationLeadTime: number; // Hours before session
}

/**
 * Service for handling RBT unavailability and automatic session reassignment
 */
export class RBTUnavailabilityService {
  private defaultStrategy: ReassignmentStrategy = {
    prioritizeTeamMembers: true,
    maintainContinuity: true,
    allowTimeChanges: false,
    maxDaysToReschedule: 7,
    notificationLeadTime: 2
  };

  constructor(
    private sessionRepository: SessionRepository,
    private scheduleEventRepository: ScheduleEventRepository,
    private teamRepository: TeamRepository,
    private rbtRepository: RBTRepository,
    private schedulingService: SessionSchedulingService,
    private continuityService: ContinuityPreferenceService,
    private cancellationService: SessionCancellationService
  ) {}

  /**
   * Processes RBT unavailability and handles affected sessions
   */
  async processRBTUnavailability(
    request: RBTUnavailabilityRequest,
    strategy: Partial<ReassignmentStrategy> = {}
  ): Promise<RBTUnavailabilityResponse> {
    const db = getDatabase();
    
    return db.transaction(async (client) => {
      try {
        // 1. Validate RBT exists and is active
        const rbt = await this.rbtRepository.findById(request.rbtId, client);
        if (!rbt) {
          return {
            success: false,
            message: 'RBT not found',
            affectedSessions: [],
            reassignmentResults: []
          };
        }

        if (!rbt.isActive) {
          return {
            success: false,
            message: 'RBT is not active',
            affectedSessions: [],
            reassignmentResults: []
          };
        }

        // 2. Find all affected sessions
        const affectedSessions = await this.findAffectedSessions(
          request.rbtId,
          request.startDate,
          request.endDate,
          client
        );

        // 3. Log the unavailability event
        const unavailabilityData = {
          startDate: request.startDate,
          endDate: request.endDate,
          reason: request.reason,
          unavailabilityType: request.unavailabilityType
        };

        const scheduleEvent = await this.scheduleEventRepository.logRbtUnavailable(
          request.rbtId,
          request.reason,
          unavailabilityData,
          request.reportedBy,
          client
        );

        // 4. Process reassignments if requested
        let reassignmentResults: SessionReassignmentResult[] = [];
        if (request.autoReassign && affectedSessions.length > 0) {
          const mergedStrategy = { ...this.defaultStrategy, ...strategy };
          reassignmentResults = await this.reassignAffectedSessions(
            affectedSessions,
            mergedStrategy,
            request.reportedBy,
            client
          );
        }

        return {
          success: true,
          message: `Processed unavailability for RBT. ${affectedSessions.length} sessions affected.`,
          affectedSessions,
          reassignmentResults,
          scheduleEvent,
          unavailabilityId: scheduleEvent.id
        };

      } catch (error) {
        throw new Error(`Failed to process RBT unavailability: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });
  }

  /**
   * Finds all sessions affected by RBT unavailability
   */
  private async findAffectedSessions(
    rbtId: string,
    startDate: Date,
    endDate: Date,
    client: any
  ): Promise<Session[]> {
    // Find all scheduled or confirmed sessions for this RBT in the date range
    const sessions = await this.sessionRepository.findByRbtId(rbtId, {}, client);
    
    return sessions.filter(session => {
      // Only include active sessions (not cancelled or completed)
      if (!['scheduled', 'confirmed'].includes(session.status)) {
        return false;
      }

      // Check if session falls within unavailability period
      const sessionStart = new Date(session.startTime);
      return sessionStart >= startDate && sessionStart <= endDate;
    });
  }

  /**
   * Reassigns affected sessions to available team members
   */
  private async reassignAffectedSessions(
    affectedSessions: Session[],
    strategy: ReassignmentStrategy,
    updatedBy: string,
    client: any
  ): Promise<SessionReassignmentResult[]> {
    const results: SessionReassignmentResult[] = [];

    for (const session of affectedSessions) {
      try {
        const reassignmentResult = await this.reassignSingleSession(
          session,
          strategy,
          updatedBy,
          client
        );
        results.push(reassignmentResult);
      } catch (error) {
        results.push({
          originalSession: session,
          reassignmentStatus: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  /**
   * Reassigns a single session to an available team member
   */
  private async reassignSingleSession(
    session: Session,
    strategy: ReassignmentStrategy,
    updatedBy: string,
    client: any
  ): Promise<SessionReassignmentResult> {
    // 1. Get client's team
    const team = await this.teamRepository.findActiveByClientId(session.clientId, client);
    if (!team) {
      return {
        originalSession: session,
        reassignmentStatus: 'failed',
        errorMessage: 'No active team found for client'
      };
    }

    // 2. Find available RBTs from the team (excluding the unavailable RBT)
    const availableRBTs = team.rbtIds.filter(rbtId => rbtId !== session.rbtId);
    if (availableRBTs.length === 0) {
      return {
        originalSession: session,
        reassignmentStatus: 'failed',
        errorMessage: 'No other team members available'
      };
    }

    // 3. Find the best replacement RBT
    const bestReplacement = await this.findBestReplacementRBT(
      session,
      availableRBTs,
      strategy,
      client
    );

    if (!bestReplacement) {
      return {
        originalSession: session,
        reassignmentStatus: 'failed',
        errorMessage: 'No suitable replacement RBT found'
      };
    }

    // 4. Check for conflicts with the new RBT
    const conflicts = await this.sessionRepository.checkConflicts(
      session.clientId,
      bestReplacement.rbtId,
      session.startTime,
      session.endTime,
      client,
      session.id
    );

    if (conflicts.length > 0) {
      // Try to find alternative time if strategy allows
      if (strategy.allowTimeChanges) {
        const alternativeTime = await this.findAlternativeTime(
          session,
          bestReplacement.rbtId,
          strategy,
          client
        );

        if (alternativeTime) {
          // Reschedule to new time
          const updatedSession = await this.sessionRepository.update(
            session.id,
            {
              rbtId: bestReplacement.rbtId,
              startTime: alternativeTime.startTime,
              endTime: alternativeTime.endTime,
              updatedBy
            },
            client
          );

          if (updatedSession) {
            // Log the reassignment
            await this.scheduleEventRepository.logSessionRescheduled(
              session.id,
              session.clientId,
              bestReplacement.rbtId,
              {
                originalRbtId: session.rbtId,
                originalStartTime: session.startTime,
                originalEndTime: session.endTime
              },
              {
                newRbtId: bestReplacement.rbtId,
                newStartTime: alternativeTime.startTime,
                newEndTime: alternativeTime.endTime
              },
              'RBT unavailability - reassigned with time change',
              updatedBy,
              client
            );

            return {
              originalSession: session,
              reassignmentStatus: 'successful',
              newRbtId: bestReplacement.rbtId,
              newStartTime: alternativeTime.startTime,
              newEndTime: alternativeTime.endTime,
              reassignmentReason: 'RBT unavailability - reassigned with time change',
              continuityScore: bestReplacement.continuityScore
            };
          }
        }
      }

      return {
        originalSession: session,
        reassignmentStatus: 'failed',
        errorMessage: `Scheduling conflicts with replacement RBT: ${conflicts.map(c => c.description).join(', ')}`
      };
    }

    // 5. Reassign to the new RBT (same time)
    const updatedSession = await this.sessionRepository.update(
      session.id,
      {
        rbtId: bestReplacement.rbtId,
        updatedBy
      },
      client
    );

    if (!updatedSession) {
      return {
        originalSession: session,
        reassignmentStatus: 'failed',
        errorMessage: 'Failed to update session with new RBT'
      };
    }

    // 6. Log the reassignment
    await this.scheduleEventRepository.logSessionRescheduled(
      session.id,
      session.clientId,
      bestReplacement.rbtId,
      {
        originalRbtId: session.rbtId
      },
      {
        newRbtId: bestReplacement.rbtId
      },
      'RBT unavailability - reassigned to team member',
      updatedBy,
      client
    );

    return {
      originalSession: session,
      reassignmentStatus: 'successful',
      newRbtId: bestReplacement.rbtId,
      reassignmentReason: 'RBT unavailability - reassigned to team member',
      continuityScore: bestReplacement.continuityScore
    };
  }

  /**
   * Finds the best replacement RBT based on continuity and availability
   */
  private async findBestReplacementRBT(
    session: Session,
    availableRBTs: string[],
    strategy: ReassignmentStrategy,
    client: any
  ): Promise<{ rbtId: string; continuityScore: number } | null> {
    const candidates: Array<{ rbtId: string; continuityScore: number; isAvailable: boolean }> = [];

    for (const rbtId of availableRBTs) {
      // Check if RBT is active
      const rbt = await this.rbtRepository.findById(rbtId, client);
      if (!rbt || !rbt.isActive) {
        continue;
      }

      // Check availability for the session time
      const conflicts = await this.sessionRepository.checkConflicts(
        session.clientId,
        rbtId,
        session.startTime,
        session.endTime,
        client
      );

      const isAvailable = conflicts.length === 0;

      // Calculate continuity score if strategy prioritizes continuity
      let continuityScore = 0;
      if (strategy.maintainContinuity) {
        const clientSessions = await this.sessionRepository.findByClientId(session.clientId, {}, client);
        const continuityResult = this.continuityService.calculateContinuityScore(
          rbtId,
          session.clientId,
          clientSessions
        );
        continuityScore = continuityResult.score;
      }

      candidates.push({
        rbtId,
        continuityScore,
        isAvailable
      });
    }

    // Filter to only available RBTs
    const availableCandidates = candidates.filter(c => c.isAvailable);
    if (availableCandidates.length === 0) {
      return null;
    }

    // Sort by continuity score (highest first)
    availableCandidates.sort((a, b) => b.continuityScore - a.continuityScore);

    return {
      rbtId: availableCandidates[0]!.rbtId,
      continuityScore: availableCandidates[0]!.continuityScore
    };
  }

  /**
   * Finds an alternative time slot for a session when the original time has conflicts
   */
  private async findAlternativeTime(
    session: Session,
    newRbtId: string,
    strategy: ReassignmentStrategy,
    client: any
  ): Promise<{ startTime: Date; endTime: Date } | null> {
    const originalDate = new Date(session.startTime);
    
    // Search for alternatives within the allowed timeframe
    for (let dayOffset = 0; dayOffset <= strategy.maxDaysToReschedule; dayOffset++) {
      const searchDate = new Date(originalDate);
      searchDate.setDate(searchDate.getDate() + dayOffset);

      // Skip weekends (assuming business days only)
      const dayOfWeek = searchDate.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        continue;
      }

      // Try different time slots throughout the business day
      const businessHours = [
        { start: 9, end: 12 },   // Morning slots
        { start: 13, end: 16 },  // Afternoon slots
        { start: 16, end: 19 }   // Late afternoon slots
      ];

      for (const timeSlot of businessHours) {
        for (let hour = timeSlot.start; hour <= timeSlot.end - 3; hour++) {
          const startTime = new Date(searchDate);
          startTime.setHours(hour, 0, 0, 0);
          
          const endTime = new Date(startTime);
          endTime.setHours(endTime.getHours() + 3); // 3-hour sessions

          // Check if this time works for both client and RBT
          const conflicts = await this.sessionRepository.checkConflicts(
            session.clientId,
            newRbtId,
            startTime,
            endTime,
            client,
            session.id
          );

          if (conflicts.length === 0) {
            return { startTime, endTime };
          }
        }
      }
    }

    return null;
  }

  /**
   * Gets unavailability statistics for reporting
   */
  async getUnavailabilityStats(
    startDate: Date,
    endDate: Date,
    rbtId?: string
  ): Promise<{
    totalUnavailabilityEvents: number;
    unavailabilityByType: Record<string, number>;
    unavailabilityByRbt: Record<string, number>;
    totalAffectedSessions: number;
    successfulReassignments: number;
    failedReassignments: number;
    averageReassignmentTime: number; // Hours
  }> {
    try {
      // Get all RBT unavailability events in the date range
      const queryParams: any = {
        eventType: 'rbt_unavailable',
        startDate,
        endDate
      };
      
      if (rbtId) queryParams.rbtId = rbtId;
      
      const unavailabilityEvents = await this.scheduleEventRepository.query(queryParams);

      const stats = {
        totalUnavailabilityEvents: unavailabilityEvents.length,
        unavailabilityByType: {} as Record<string, number>,
        unavailabilityByRbt: {} as Record<string, number>,
        totalAffectedSessions: 0,
        successfulReassignments: 0,
        failedReassignments: 0,
        averageReassignmentTime: 0
      };

      let totalReassignmentTime = 0;
      let reassignmentCount = 0;

      for (const event of unavailabilityEvents) {
        // Count by type
        const type = event.newValues?.unavailabilityType || 'unknown';
        stats.unavailabilityByType[type] = (stats.unavailabilityByType[type] || 0) + 1;

        // Count by RBT
        if (event.rbtId) {
          stats.unavailabilityByRbt[event.rbtId] = (stats.unavailabilityByRbt[event.rbtId] || 0) + 1;
        }

        // Get related reassignment events
        const reassignmentQuery: any = {
          eventType: 'session_rescheduled',
          startDate: event.createdAt,
          endDate: new Date(event.createdAt.getTime() + 24 * 60 * 60 * 1000) // Within 24 hours
        };
        
        if (event.rbtId) {
          reassignmentQuery.rbtId = event.rbtId;
        }
        
        const reassignmentEvents = await this.scheduleEventRepository.query(reassignmentQuery);

        stats.totalAffectedSessions += reassignmentEvents.length;

        for (const reassignment of reassignmentEvents) {
          if (reassignment.newValues?.newRbtId) {
            stats.successfulReassignments++;
            
            // Calculate reassignment time
            const reassignmentTime = (reassignment.createdAt.getTime() - event.createdAt.getTime()) / (1000 * 60 * 60);
            totalReassignmentTime += reassignmentTime;
            reassignmentCount++;
          } else {
            stats.failedReassignments++;
          }
        }
      }

      if (reassignmentCount > 0) {
        stats.averageReassignmentTime = totalReassignmentTime / reassignmentCount;
      }

      return stats;

    } catch (error) {
      console.error('Error getting unavailability stats:', error);
      throw error;
    }
  }

  /**
   * Bulk processes unavailability for multiple RBTs (e.g., during emergencies)
   */
  async bulkProcessUnavailability(
    requests: RBTUnavailabilityRequest[],
    strategy: Partial<ReassignmentStrategy> = {}
  ): Promise<{
    successful: RBTUnavailabilityResponse[];
    failed: Array<{ rbtId: string; error: string }>;
  }> {
    const results = {
      successful: [] as RBTUnavailabilityResponse[],
      failed: [] as Array<{ rbtId: string; error: string }>
    };

    for (const request of requests) {
      try {
        const result = await this.processRBTUnavailability(request, strategy);

        if (result.success) {
          results.successful.push(result);
        } else {
          results.failed.push({
            rbtId: request.rbtId,
            error: result.message || 'Unknown error'
          });
        }
      } catch (error) {
        results.failed.push({
          rbtId: request.rbtId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  /**
   * Resolves RBT unavailability when they return to work
   */
  async resolveUnavailability(
    unavailabilityId: string,
    resolvedBy: string,
    notes?: string
  ): Promise<SchedulingResult> {
    try {
      // Log the resolution
      const resolutionEvent = await this.scheduleEventRepository.create({
        eventType: 'rbt_unavailable',
        reason: `Unavailability resolved: ${notes || 'RBT returned to work'}`,
        metadata: {
          resolvedUnavailabilityId: unavailabilityId,
          resolutionType: 'resolved'
        },
        createdBy: resolvedBy
      });

      return {
        success: true,
        message: 'RBT unavailability resolved successfully'
      };

    } catch (error) {
      return {
        success: false,
        message: `Failed to resolve unavailability: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}