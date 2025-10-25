import { Request, Response } from 'express';
import { SessionCancellationService, CancelSessionRequest, CancelSessionResponse } from '../services/SessionCancellationService';
import { RBTUnavailabilityService, RBTUnavailabilityRequest, RBTUnavailabilityResponse } from '../services/RBTUnavailabilityService';
import { ReschedulingOptimizationService, ReschedulingRequest, OptimizedReschedulingResult } from '../services/ReschedulingOptimizationService';
import { SessionSchedulingService } from '../services/SessionSchedulingService';
import { validateUUID } from '../utils/validation';
import { logger } from '../utils/logger';

export interface CancelSessionRequestBody {
  reason: string;
  findAlternatives?: boolean;
  maxAlternatives?: number;
}

export interface RBTUnavailabilityRequestBody {
  startDate: string;
  endDate: string;
  reason: string;
  unavailabilityType: 'sick_leave' | 'vacation' | 'emergency' | 'other';
  autoReassign?: boolean;
  notifyAffectedParties?: boolean;
}

export interface ReschedulingRequestBody {
  reason: string;
  preferences?: {
    preferredDates?: string[];
    preferredTimes?: Array<{ startTime: string; endTime: string }>;
    preferredRBTs?: string[];
    maxDaysFromOriginal?: number;
    allowDifferentRBT?: boolean;
    prioritizeContinuity?: boolean;
  };
  constraints?: {
    mustMaintainRBT?: boolean;
    mustMaintainDate?: boolean;
    mustMaintainTime?: boolean;
    minNoticeHours?: number;
    maxReschedulingAttempts?: number;
  };
}

export interface ExecuteReschedulingRequestBody {
  optionRank: number;
  confirmationNotes?: string;
}

/**
 * Controller for handling rescheduling and disruption management endpoints
 */
export class ReschedulingController {
  constructor(
    private cancellationService: SessionCancellationService,
    private unavailabilityService: RBTUnavailabilityService,
    private optimizationService: ReschedulingOptimizationService,
    private schedulingService: SessionSchedulingService
  ) {}

  /**
   * POST /api/reschedule/cancel-session/:sessionId
   * Cancels a session and optionally finds alternative opportunities
   */
  public cancelSession = async (req: Request, res: Response): Promise<void> => {
    try {
      const { sessionId } = req.params;
      const { reason, findAlternatives = false, maxAlternatives = 5 }: CancelSessionRequestBody = req.body;
      const cancelledBy = req.user?.userId;

      // Validate inputs
      if (!validateUUID(sessionId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid session ID format'
        });
        return;
      }

      if (!reason || reason.trim().length === 0) {
        res.status(400).json({
          success: false,
          message: 'Cancellation reason is required'
        });
        return;
      }

      if (!cancelledBy) {
        res.status(401).json({
          success: false,
          message: 'User authentication required'
        });
        return;
      }

      const cancelRequest: CancelSessionRequest = {
        sessionId,
        reason: reason.trim(),
        cancelledBy: cancelledBy!,
        findAlternatives,
        maxAlternatives: Math.min(maxAlternatives, 10) // Cap at 10
      };

      const result = await this.cancellationService.cancelSession(cancelRequest);

      if (result.success) {
        logger.info(`Session ${sessionId} cancelled successfully`, {
          sessionId,
          cancelledBy,
          reason,
          alternativesFound: result.alternativeOpportunities?.length || 0
        });

        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }

    } catch (error) {
      logger.error('Error cancelling session:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while cancelling session'
      });
    }
  };

  /**
   * POST /api/reschedule/rbt-unavailable/:rbtId
   * Reports RBT unavailability and handles affected sessions
   */
  public reportRBTUnavailability = async (req: Request, res: Response): Promise<void> => {
    try {
      const { rbtId } = req.params;
      const {
        startDate,
        endDate,
        reason,
        unavailabilityType,
        autoReassign = true,
        notifyAffectedParties = true
      }: RBTUnavailabilityRequestBody = req.body;
      const reportedBy = req.user?.userId;

      // Validate inputs
      if (!validateUUID(rbtId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid RBT ID format'
        });
        return;
      }

      if (!startDate || !endDate || !reason || !unavailabilityType) {
        res.status(400).json({
          success: false,
          message: 'Start date, end date, reason, and unavailability type are required'
        });
        return;
      }

      if (!reportedBy) {
        res.status(401).json({
          success: false,
          message: 'User authentication required'
        });
        return;
      }

      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);

      if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
        res.status(400).json({
          success: false,
          message: 'Invalid date format'
        });
        return;
      }

      if (startDateObj >= endDateObj) {
        res.status(400).json({
          success: false,
          message: 'Start date must be before end date'
        });
        return;
      }

      const unavailabilityRequest: RBTUnavailabilityRequest = {
        rbtId,
        startDate: startDateObj,
        endDate: endDateObj,
        reason: reason.trim(),
        unavailabilityType,
        reportedBy: reportedBy!,
        autoReassign,
        notifyAffectedParties
      };

      const result = await this.unavailabilityService.processRBTUnavailability(unavailabilityRequest);

      if (result.success) {
        logger.info(`RBT unavailability processed successfully`, {
          rbtId,
          startDate,
          endDate,
          affectedSessions: result.affectedSessions.length,
          successfulReassignments: result.reassignmentResults.filter(r => r.reassignmentStatus === 'successful').length
        });

        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }

    } catch (error) {
      logger.error('Error processing RBT unavailability:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while processing RBT unavailability'
      });
    }
  };

  /**
   * POST /api/reschedule/optimize/:sessionId
   * Finds optimal rescheduling options for a session
   */
  public findReschedulingOptions = async (req: Request, res: Response): Promise<void> => {
    try {
      const { sessionId } = req.params;
      const { reason, preferences, constraints }: ReschedulingRequestBody = req.body;
      const requestedBy = req.user?.userId;

      // Validate inputs
      if (!validateUUID(sessionId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid session ID format'
        });
        return;
      }

      if (!reason || reason.trim().length === 0) {
        res.status(400).json({
          success: false,
          message: 'Rescheduling reason is required'
        });
        return;
      }

      if (!requestedBy) {
        res.status(401).json({
          success: false,
          message: 'User authentication required'
        });
        return;
      }

      // Validate and convert preferred dates
      let processedPreferences = preferences;
      if (preferences?.preferredDates) {
        try {
          const preferredDates = preferences.preferredDates.map(dateStr => {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) {
              throw new Error(`Invalid date format: ${dateStr}`);
            }
            return date;
          });
          processedPreferences = { ...preferences, preferredDates } as any;
        } catch (error) {
          res.status(400).json({
            success: false,
            message: `Invalid preferred date format: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
          return;
        }
      }

      const reschedulingRequest: ReschedulingRequest = {
        sessionId,
        reason: reason.trim(),
        requestedBy: requestedBy!,
        preferences: processedPreferences as any,
        constraints
      };

      const result = await this.optimizationService.findOptimalReschedulingOptions(reschedulingRequest);

      if (result.success) {
        logger.info(`Rescheduling options found for session ${sessionId}`, {
          sessionId,
          optionsCount: result.recommendedOptions.length,
          processingTime: result.optimizationMetrics.processingTimeMs
        });

        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }

    } catch (error) {
      logger.error('Error finding rescheduling options:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while finding rescheduling options'
      });
    }
  };

  /**
   * POST /api/reschedule/execute/:sessionId
   * Executes a selected rescheduling option
   */
  public executeRescheduling = async (req: Request, res: Response): Promise<void> => {
    try {
      const { sessionId } = req.params;
      const { optionRank, confirmationNotes }: ExecuteReschedulingRequestBody = req.body;
      const updatedBy = req.user?.userId;

      // Validate inputs
      if (!validateUUID(sessionId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid session ID format'
        });
        return;
      }

      if (!optionRank || optionRank < 1) {
        res.status(400).json({
          success: false,
          message: 'Valid option rank is required (starting from 1)'
        });
        return;
      }

      if (!updatedBy) {
        res.status(401).json({
          success: false,
          message: 'User authentication required'
        });
        return;
      }

      // First, get the rescheduling options to find the selected one
      // In a real implementation, you might cache these or require them to be passed
      const optionsRequest: ReschedulingRequest = {
        sessionId,
        reason: 'Executing previously selected rescheduling option',
        requestedBy: updatedBy
      };

      const optionsResult = await this.optimizationService.findOptimalReschedulingOptions(optionsRequest);

      if (!optionsResult.success || optionsResult.recommendedOptions.length < optionRank) {
        res.status(400).json({
          success: false,
          message: 'Selected rescheduling option not found or no longer available'
        });
        return;
      }

      const selectedOption = optionsResult.recommendedOptions[optionRank - 1]!;

      // Execute the rescheduling
      const result = await this.schedulingService.rescheduleSession(
        sessionId,
        selectedOption.startTime,
        updatedBy!,
        `Rescheduled using optimization option ${optionRank}${confirmationNotes ? `: ${confirmationNotes}` : ''}`
      );

      if (result.success) {
        logger.info(`Session ${sessionId} rescheduled successfully`, {
          sessionId,
          newStartTime: selectedOption.startTime,
          newRbtId: selectedOption.rbtId,
          optionRank,
          updatedBy
        });

        res.status(200).json({
          ...result,
          rescheduledTo: {
            startTime: selectedOption.startTime,
            endTime: selectedOption.endTime,
            rbtId: selectedOption.rbtId,
            rbtName: selectedOption.rbtName
          },
          optimizationScore: selectedOption.optimizationScore,
          continuityScore: selectedOption.continuityScore
        });
      } else {
        res.status(400).json(result);
      }

    } catch (error) {
      logger.error('Error executing rescheduling:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while executing rescheduling'
      });
    }
  };

  /**
   * GET /api/reschedule/impact/:sessionId
   * Analyzes the impact of rescheduling a session
   */
  public analyzeReschedulingImpact = async (req: Request, res: Response): Promise<void> => {
    try {
      const { sessionId } = req.params;
      const { newStartTime, newRbtId } = req.query;

      // Validate inputs
      if (!validateUUID(sessionId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid session ID format'
        });
        return;
      }

      if (!newStartTime) {
        res.status(400).json({
          success: false,
          message: 'New start time is required'
        });
        return;
      }

      const newStartTimeObj = new Date(newStartTime as string);
      if (isNaN(newStartTimeObj.getTime())) {
        res.status(400).json({
          success: false,
          message: 'Invalid new start time format'
        });
        return;
      }

      let newRbtIdValidated: string | undefined;
      if (newRbtId) {
        if (!validateUUID(newRbtId as string)) {
          res.status(400).json({
            success: false,
            message: 'Invalid new RBT ID format'
          });
          return;
        }
        newRbtIdValidated = newRbtId as string;
      }

      const impact = await this.optimizationService.analyzeReschedulingImpact(
        sessionId,
        newStartTimeObj,
        newRbtIdValidated
      );

      logger.info(`Rescheduling impact analyzed for session ${sessionId}`, {
        sessionId,
        affectedSessions: impact.affectedSessions.length,
        continuityDisruption: impact.continuityDisruption,
        operationalComplexity: impact.operationalComplexity
      });

      res.status(200).json({
        success: true,
        impact
      });

    } catch (error) {
      logger.error('Error analyzing rescheduling impact:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while analyzing rescheduling impact'
      });
    }
  };

  /**
   * GET /api/reschedule/stats/cancellations
   * Gets cancellation statistics for reporting
   */
  public getCancellationStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const { startDate, endDate, rbtId, clientId } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          message: 'Start date and end date are required'
        });
        return;
      }

      const startDateObj = new Date(startDate as string);
      const endDateObj = new Date(endDate as string);

      if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
        res.status(400).json({
          success: false,
          message: 'Invalid date format'
        });
        return;
      }

      if (startDateObj >= endDateObj) {
        res.status(400).json({
          success: false,
          message: 'Start date must be before end date'
        });
        return;
      }

      const stats = await this.cancellationService.getCancellationStats(
        startDateObj,
        endDateObj,
        rbtId as string | undefined,
        clientId as string | undefined
      );

      res.status(200).json({
        success: true,
        stats,
        dateRange: {
          startDate: startDateObj,
          endDate: endDateObj
        }
      });

    } catch (error) {
      logger.error('Error getting cancellation stats:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while getting cancellation statistics'
      });
    }
  };

  /**
   * GET /api/reschedule/stats/unavailability
   * Gets RBT unavailability statistics for reporting
   */
  public getUnavailabilityStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const { startDate, endDate, rbtId } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          message: 'Start date and end date are required'
        });
        return;
      }

      const startDateObj = new Date(startDate as string);
      const endDateObj = new Date(endDate as string);

      if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
        res.status(400).json({
          success: false,
          message: 'Invalid date format'
        });
        return;
      }

      if (startDateObj >= endDateObj) {
        res.status(400).json({
          success: false,
          message: 'Start date must be before end date'
        });
        return;
      }

      const stats = await this.unavailabilityService.getUnavailabilityStats(
        startDateObj,
        endDateObj,
        rbtId as string | undefined
      );

      res.status(200).json({
        success: true,
        stats,
        dateRange: {
          startDate: startDateObj,
          endDate: endDateObj
        }
      });

    } catch (error) {
      logger.error('Error getting unavailability stats:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while getting unavailability statistics'
      });
    }
  };

  /**
   * POST /api/reschedule/bulk-cancel
   * Bulk cancels multiple sessions
   */
  public bulkCancelSessions = async (req: Request, res: Response): Promise<void> => {
    try {
      const { sessionIds, reason, findAlternatives = false } = req.body;
      const cancelledBy = req.user?.userId;

      // Validate inputs
      if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Session IDs array is required and cannot be empty'
        });
        return;
      }

      if (sessionIds.length > 50) {
        res.status(400).json({
          success: false,
          message: 'Cannot cancel more than 50 sessions at once'
        });
        return;
      }

      for (const sessionId of sessionIds) {
        if (!validateUUID(sessionId)) {
          res.status(400).json({
            success: false,
            message: `Invalid session ID format: ${sessionId}`
          });
          return;
        }
      }

      if (!reason || reason.trim().length === 0) {
        res.status(400).json({
          success: false,
          message: 'Cancellation reason is required'
        });
        return;
      }

      if (!cancelledBy) {
        res.status(401).json({
          success: false,
          message: 'User authentication required'
        });
        return;
      }

      const result = await this.cancellationService.bulkCancelSessions(
        sessionIds,
        reason.trim(),
        cancelledBy!,
        findAlternatives
      );

      logger.info(`Bulk cancellation completed`, {
        totalSessions: sessionIds.length,
        successful: result.successful.length,
        failed: result.failed.length,
        cancelledBy
      });

      res.status(200).json({
        success: true,
        message: `Bulk cancellation completed: ${result.successful.length} successful, ${result.failed.length} failed`,
        results: result
      });

    } catch (error) {
      logger.error('Error in bulk cancellation:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during bulk cancellation'
      });
    }
  };
}