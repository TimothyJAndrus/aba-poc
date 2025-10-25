import { Session, UpdateSessionRequest } from '../models/Session';
import { ScheduleEvent } from '../models/ScheduleEvent';
import { AlternativeOption, SchedulingResult } from '../types';
import { SessionRepository } from '../database/repositories/SessionRepository';
import { ScheduleEventRepository } from '../database/repositories/ScheduleEventRepository';
import { TeamRepository } from '../database/repositories/TeamRepository';
import { RBTRepository } from '../database/repositories/RBTRepository';
import { SessionSchedulingService } from './SessionSchedulingService';
import { ContinuityPreferenceService } from './ContinuityPreferenceService';
import { getDatabase } from '../database/connection';

export interface CancelSessionRequest {
  sessionId: string;
  reason: string;
  cancelledBy: string;
  findAlternatives?: boolean;
  maxAlternatives?: number;
}

export interface CancelSessionResponse extends SchedulingResult {
  cancelledSession?: Session;
  alternativeOpportunities?: AlternativeOpportunity[];
  scheduleEvent?: ScheduleEvent;
}

export interface AlternativeOpportunity {
  availableTimeSlot: {
    startTime: Date;
    endTime: Date;
    rbtId: string;
  };
  potentialClients: Array<{
    clientId: string;
    clientName: string;
    continuityScore: number;
    lastSessionDate?: Date;
  }>;
  opportunityScore: number; // Higher score = better opportunity
}

export interface RescheduleOpportunity {
  originalSessionId: string;
  newTimeSlot: AlternativeOption;
  impactScore: number; // Lower score = less disruptive
}

/**
 * Service for handling session cancellations and identifying rescheduling opportunities
 */
export class SessionCancellationService {
  constructor(
    private sessionRepository: SessionRepository,
    private scheduleEventRepository: ScheduleEventRepository,
    private teamRepository: TeamRepository,
    private rbtRepository: RBTRepository,
    private schedulingService: SessionSchedulingService,
    private continuityService: ContinuityPreferenceService
  ) {}

  /**
   * Cancels a session and optionally finds alternative scheduling opportunities
   */
  async cancelSession(request: CancelSessionRequest): Promise<CancelSessionResponse> {
    const connection = await getDatabase().getClient();
    
    try {
      await connection.query('BEGIN');

      // 1. Get the session to be cancelled
      const session = await this.sessionRepository.findById(request.sessionId, connection);
      if (!session) {
        await connection.query('ROLLBACK');
        return {
          success: false,
          message: 'Session not found'
        };
      }

      // 2. Validate that session can be cancelled
      if (session.status === 'cancelled') {
        await connection.query('ROLLBACK');
        return {
          success: false,
          message: 'Session is already cancelled'
        };
      }

      if (session.status === 'completed') {
        await connection.query('ROLLBACK');
        return {
          success: false,
          message: 'Cannot cancel a completed session'
        };
      }

      // 3. Store original session data for audit trail
      const originalSessionData = {
        status: session.status,
        startTime: session.startTime,
        endTime: session.endTime,
        rbtId: session.rbtId,
        clientId: session.clientId,
        location: session.location
      };

      // 4. Cancel the session
      const cancelledSession = await this.sessionRepository.update(
        request.sessionId,
        {
          status: 'cancelled',
          cancellationReason: request.reason,
          updatedBy: request.cancelledBy
        },
        connection
      );

      if (!cancelledSession) {
        await connection.query('ROLLBACK');
        return {
          success: false,
          message: 'Failed to cancel session'
        };
      }

      // 5. Log the cancellation event
      const scheduleEvent = await this.scheduleEventRepository.logSessionCancelled(
        request.sessionId,
        session.clientId,
        session.rbtId,
        request.reason,
        originalSessionData,
        request.cancelledBy,
        connection
      );

      // 6. Find alternative opportunities if requested
      let alternativeOpportunities: AlternativeOpportunity[] = [];
      if (request.findAlternatives) {
        alternativeOpportunities = await this.findAlternativeOpportunities(
          session,
          request.maxAlternatives || 5
        );
      }

      await connection.query('COMMIT');

      return {
        success: true,
        message: 'Session cancelled successfully',
        sessionId: request.sessionId,
        cancelledSession,
        alternativeOpportunities,
        scheduleEvent
      };

    } catch (error) {
      await connection.query('ROLLBACK');
      return {
        success: false,
        message: `Failed to cancel session: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    } finally {
      connection.release();
    }
  }

  /**
   * Finds alternative scheduling opportunities when a session is cancelled
   */
  async findAlternativeOpportunities(
    cancelledSession: Session,
    maxOpportunities: number = 5
  ): Promise<AlternativeOpportunity[]> {
    const opportunities: AlternativeOpportunity[] = [];

    try {
      // 1. Get the RBT who was assigned to the cancelled session
      const rbt = await this.rbtRepository.findById(cancelledSession.rbtId);
      if (!rbt || !rbt.isActive) {
        return opportunities;
      }

      // 2. Find other clients who could benefit from this time slot
      const availableTimeSlot = {
        startTime: cancelledSession.startTime,
        endTime: cancelledSession.endTime,
        rbtId: cancelledSession.rbtId
      };

      // 3. Get all teams where this RBT is a member
      const teams = await this.teamRepository.findByRbtId(cancelledSession.rbtId);
      const potentialClientIds = new Set<string>();
      
      for (const team of teams) {
        if (team.clientId !== cancelledSession.clientId) {
          potentialClientIds.add(team.clientId);
        }
      }

      // 4. For each potential client, check if they need sessions and calculate opportunity score
      for (const clientId of potentialClientIds) {
        const clientOpportunity = await this.evaluateClientOpportunity(
          clientId,
          availableTimeSlot,
          cancelledSession.startTime
        );

        if (clientOpportunity) {
          opportunities.push({
            availableTimeSlot,
            potentialClients: [clientOpportunity],
            opportunityScore: clientOpportunity.continuityScore
          });
        }
      }

      // 5. Sort by opportunity score (highest first) and limit results
      opportunities.sort((a, b) => b.opportunityScore - a.opportunityScore);
      return opportunities.slice(0, maxOpportunities);

    } catch (error) {
      console.error('Error finding alternative opportunities:', error);
      return opportunities;
    }
  }

  /**
   * Evaluates if a client would benefit from a newly available time slot
   */
  private async evaluateClientOpportunity(
    clientId: string,
    timeSlot: { startTime: Date; endTime: Date; rbtId: string },
    originalSessionDate: Date
  ): Promise<{ clientId: string; clientName: string; continuityScore: number; lastSessionDate?: Date } | null> {
    try {
      // 1. Check if client has any conflicts at this time
      const conflicts = await this.sessionRepository.checkConflicts(
        clientId,
        timeSlot.rbtId,
        timeSlot.startTime,
        timeSlot.endTime
      );

      if (conflicts.length > 0) {
        return null; // Client is not available
      }

      // 2. Get client's session history with this RBT
      const clientSessions = await this.sessionRepository.findByClientId(clientId);
      const continuityScore = this.continuityService.calculateContinuityScore(
        timeSlot.rbtId,
        clientId,
        clientSessions
      );

      // 3. Get client name (simplified - in real implementation would join with users table)
      const clientName = `Client ${clientId.substring(0, 8)}`;

      // 4. Find last session date
      const lastSession = clientSessions
        .filter(s => s.rbtId === timeSlot.rbtId && s.status === 'completed')
        .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())[0];

      // 5. Calculate opportunity score based on:
      // - Continuity score (higher is better)
      // - Time since last session (longer gap = higher priority)
      // - How close to the original session date (closer = better for consistency)
      let opportunityScore = continuityScore.score;

      if (lastSession) {
        const daysSinceLastSession = Math.floor(
          (originalSessionDate.getTime() - lastSession.startTime.getTime()) / (1000 * 60 * 60 * 24)
        );
        // Add bonus for clients who haven't had sessions recently
        if (daysSinceLastSession > 7) {
          opportunityScore += 20;
        } else if (daysSinceLastSession > 3) {
          opportunityScore += 10;
        }
      } else {
        // New client-RBT pairing gets moderate priority
        opportunityScore += 15;
      }

      const result: { clientId: string; clientName: string; continuityScore: number; lastSessionDate?: Date } = {
        clientId,
        clientName,
        continuityScore: opportunityScore
      };
      
      if (lastSession?.startTime) {
        result.lastSessionDate = lastSession.startTime;
      }
      
      return result;

    } catch (error) {
      console.error(`Error evaluating opportunity for client ${clientId}:`, error);
      return null;
    }
  }

  /**
   * Finds sessions that could be rescheduled to utilize a cancelled session's time slot
   */
  async findRescheduleOpportunities(
    cancelledSession: Session,
    searchDays: number = 7
  ): Promise<RescheduleOpportunity[]> {
    const opportunities: RescheduleOpportunity[] = [];

    try {
      // 1. Find sessions in the next few days that could be moved to the cancelled slot
      const searchEndDate = new Date(cancelledSession.startTime);
      searchEndDate.setDate(searchEndDate.getDate() + searchDays);

      const futureSessions = await this.sessionRepository.findActiveByDateRange(
        cancelledSession.startTime,
        searchEndDate
      );

      // 2. Filter sessions that involve the same RBT and could benefit from moving
      const candidateSessions = futureSessions.filter(session => 
        session.rbtId === cancelledSession.rbtId &&
        session.id !== cancelledSession.id &&
        session.status === 'scheduled'
      );

      // 3. For each candidate, evaluate the impact of rescheduling
      for (const session of candidateSessions) {
        const alternativeOption: AlternativeOption = {
          rbtId: cancelledSession.rbtId,
          startTime: cancelledSession.startTime,
          endTime: cancelledSession.endTime,
          continuityScore: 100, // Same RBT, so continuity is maintained
          availability: 'available'
        };

        // Calculate impact score (lower is better)
        const daysDifference = Math.abs(
          (cancelledSession.startTime.getTime() - session.startTime.getTime()) / (1000 * 60 * 60 * 24)
        );
        
        const impactScore = daysDifference * 10; // Prefer minimal time changes

        opportunities.push({
          originalSessionId: session.id,
          newTimeSlot: alternativeOption,
          impactScore
        });
      }

      // 4. Sort by impact score (lowest first)
      opportunities.sort((a, b) => a.impactScore - b.impactScore);
      return opportunities.slice(0, 5); // Return top 5 opportunities

    } catch (error) {
      console.error('Error finding reschedule opportunities:', error);
      return opportunities;
    }
  }

  /**
   * Gets cancellation statistics for reporting
   */
  async getCancellationStats(
    startDate: Date,
    endDate: Date,
    rbtId?: string,
    clientId?: string
  ): Promise<{
    totalCancellations: number;
    cancellationsByReason: Record<string, number>;
    cancellationsByRbt: Record<string, number>;
    cancellationsByClient: Record<string, number>;
    averageNoticeTime: number; // Hours between cancellation and original session time
  }> {
    try {
      // Get all cancellation events in the date range
      const queryParams: any = {
        eventType: 'session_cancelled',
        startDate,
        endDate
      };
      
      if (rbtId) queryParams.rbtId = rbtId;
      if (clientId) queryParams.clientId = clientId;
      
      const cancellationEvents = await this.scheduleEventRepository.query(queryParams);

      const stats = {
        totalCancellations: cancellationEvents.length,
        cancellationsByReason: {} as Record<string, number>,
        cancellationsByRbt: {} as Record<string, number>,
        cancellationsByClient: {} as Record<string, number>,
        averageNoticeTime: 0
      };

      let totalNoticeTime = 0;
      let validNoticeTimeCount = 0;

      for (const event of cancellationEvents) {
        // Count by reason
        const reason = event.reason || 'Unknown';
        stats.cancellationsByReason[reason] = (stats.cancellationsByReason[reason] || 0) + 1;

        // Count by RBT
        if (event.rbtId) {
          stats.cancellationsByRbt[event.rbtId] = (stats.cancellationsByRbt[event.rbtId] || 0) + 1;
        }

        // Count by client
        if (event.clientId) {
          stats.cancellationsByClient[event.clientId] = (stats.cancellationsByClient[event.clientId] || 0) + 1;
        }

        // Calculate notice time
        if (event.oldValues && event.oldValues.startTime) {
          const originalStartTime = new Date(event.oldValues.startTime);
          const cancellationTime = event.createdAt;
          const noticeTimeHours = (originalStartTime.getTime() - cancellationTime.getTime()) / (1000 * 60 * 60);
          
          if (noticeTimeHours >= 0) {
            totalNoticeTime += noticeTimeHours;
            validNoticeTimeCount++;
          }
        }
      }

      if (validNoticeTimeCount > 0) {
        stats.averageNoticeTime = totalNoticeTime / validNoticeTimeCount;
      }

      return stats;

    } catch (error) {
      console.error('Error getting cancellation stats:', error);
      throw error;
    }
  }

  /**
   * Bulk cancels multiple sessions (e.g., when RBT becomes unavailable)
   */
  async bulkCancelSessions(
    sessionIds: string[],
    reason: string,
    cancelledBy: string,
    findAlternatives: boolean = true
  ): Promise<{
    successful: CancelSessionResponse[];
    failed: Array<{ sessionId: string; error: string }>;
  }> {
    const results = {
      successful: [] as CancelSessionResponse[],
      failed: [] as Array<{ sessionId: string; error: string }>
    };

    for (const sessionId of sessionIds) {
      try {
        const result = await this.cancelSession({
          sessionId,
          reason,
          cancelledBy,
          findAlternatives,
          maxAlternatives: 3
        });

        if (result.success) {
          results.successful.push(result);
        } else {
          results.failed.push({
            sessionId,
            error: result.message || 'Unknown error'
          });
        }
      } catch (error) {
        results.failed.push({
          sessionId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }
}