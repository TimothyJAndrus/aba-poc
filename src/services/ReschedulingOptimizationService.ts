import { Session } from '../models/Session';
import { AlternativeOption, SchedulingResult, ContinuityScore } from '../types';
import { SessionRepository } from '../database/repositories/SessionRepository';
import { TeamRepository } from '../database/repositories/TeamRepository';
import { RBTRepository } from '../database/repositories/RBTRepository';
import { ContinuityPreferenceService } from './ContinuityPreferenceService';
import { SchedulingConstraintService } from './SchedulingConstraintService';

export interface ReschedulingRequest {
  sessionId: string;
  reason: string;
  requestedBy: string;
  preferences?: ReschedulingPreferences;
  constraints?: ReschedulingConstraints;
}

export interface ReschedulingPreferences {
  preferredDates?: Date[];
  preferredTimes?: Array<{ startTime: string; endTime: string }>;
  preferredRBTs?: string[];
  maxDaysFromOriginal?: number;
  allowDifferentRBT?: boolean;
  prioritizeContinuity?: boolean;
}

export interface ReschedulingConstraints {
  mustMaintainRBT?: boolean;
  mustMaintainDate?: boolean;
  mustMaintainTime?: boolean;
  minNoticeHours?: number;
  maxReschedulingAttempts?: number;
}

export interface OptimizedReschedulingResult extends SchedulingResult {
  originalSession?: Session;
  recommendedOptions: ReschedulingOption[];
  optimizationMetrics: OptimizationMetrics;
}

export interface ReschedulingOption {
  rank: number;
  rbtId: string;
  rbtName: string;
  startTime: Date;
  endTime: Date;
  optimizationScore: number;
  continuityScore: number;
  impactScore: number;
  feasibilityScore: number;
  reasonForRecommendation: string;
  potentialConflicts: string[];
  requiredNotifications: string[];
}

export interface OptimizationMetrics {
  totalOptionsEvaluated: number;
  continuityPreservationRate: number;
  averageTimeDeviation: number; // Hours from original time
  averageDateDeviation: number; // Days from original date
  conflictResolutionRate: number;
  processingTimeMs: number;
}

export interface ReschedulingImpact {
  affectedSessions: Session[];
  cascadingChanges: number;
  notificationCount: number;
  continuityDisruption: number; // 0-100 scale
  operationalComplexity: number; // 0-100 scale
}

/**
 * Service for optimizing session rescheduling with continuity preferences and constraint satisfaction
 */
export class ReschedulingOptimizationService {
  constructor(
    private sessionRepository: SessionRepository,
    private teamRepository: TeamRepository,
    private rbtRepository: RBTRepository,
    private continuityService: ContinuityPreferenceService,
    private constraintService: SchedulingConstraintService
  ) {}

  /**
   * Finds optimal rescheduling options for a session
   */
  async findOptimalReschedulingOptions(
    request: ReschedulingRequest
  ): Promise<OptimizedReschedulingResult> {
    const startTime = Date.now();
    
    try {
      // 1. Get the original session
      const originalSession = await this.sessionRepository.findById(request.sessionId);
      if (!originalSession) {
        return {
          success: false,
          message: 'Session not found',
          recommendedOptions: [],
          optimizationMetrics: this.createEmptyMetrics(Date.now() - startTime)
        };
      }

      // 2. Validate rescheduling constraints
      const constraintValidation = await this.validateReschedulingConstraints(
        originalSession,
        request.constraints
      );

      if (!constraintValidation.isValid) {
        return {
          success: false,
          message: `Rescheduling constraints not met: ${constraintValidation.violations.join(', ')}`,
          originalSession,
          recommendedOptions: [],
          optimizationMetrics: this.createEmptyMetrics(Date.now() - startTime)
        };
      }

      // 3. Generate candidate options
      const candidateOptions = await this.generateCandidateOptions(
        originalSession,
        request.preferences || {}
      );

      // 4. Evaluate and score each option
      const evaluatedOptions = await this.evaluateReschedulingOptions(
        originalSession,
        candidateOptions,
        request.preferences || {}
      );

      // 5. Optimize and rank options
      const optimizedOptions = await this.optimizeAndRankOptions(
        evaluatedOptions,
        request.preferences || {}
      );

      // 6. Calculate optimization metrics
      const metrics = this.calculateOptimizationMetrics(
        originalSession,
        candidateOptions,
        optimizedOptions,
        Date.now() - startTime
      );

      return {
        success: true,
        message: `Found ${optimizedOptions.length} optimal rescheduling options`,
        originalSession,
        recommendedOptions: optimizedOptions.slice(0, 5), // Return top 5 options
        optimizationMetrics: metrics
      };

    } catch (error) {
      return {
        success: false,
        message: `Optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        recommendedOptions: [],
        optimizationMetrics: this.createEmptyMetrics(Date.now() - startTime)
      };
    }
  }

  /**
   * Validates rescheduling constraints
   */
  private async validateReschedulingConstraints(
    session: Session,
    constraints?: ReschedulingConstraints
  ): Promise<{ isValid: boolean; violations: string[] }> {
    const violations: string[] = [];

    if (!constraints) {
      return { isValid: true, violations: [] };
    }

    // Check minimum notice requirement
    if (constraints.minNoticeHours) {
      const hoursUntilSession = (session.startTime.getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursUntilSession < constraints.minNoticeHours) {
        violations.push(`Insufficient notice: ${hoursUntilSession.toFixed(1)} hours, minimum ${constraints.minNoticeHours} required`);
      }
    }

    // Check if session can be rescheduled (not completed or in progress)
    if (['completed', 'no_show'].includes(session.status)) {
      violations.push('Cannot reschedule completed or no-show sessions');
    }

    return {
      isValid: violations.length === 0,
      violations
    };
  }

  /**
   * Generates candidate rescheduling options
   */
  private async generateCandidateOptions(
    originalSession: Session,
    preferences: ReschedulingPreferences
  ): Promise<AlternativeOption[]> {
    const candidates: AlternativeOption[] = [];
    const maxDays = preferences.maxDaysFromOriginal || 14;
    const originalDate = new Date(originalSession.startTime);

    // 1. Get client's team
    const team = await this.teamRepository.findActiveByClientId(originalSession.clientId);
    if (!team) {
      return candidates;
    }

    // 2. Determine which RBTs to consider
    let candidateRBTs = team.rbtIds;
    if (preferences.preferredRBTs && preferences.preferredRBTs.length > 0) {
      candidateRBTs = candidateRBTs.filter(rbtId => preferences.preferredRBTs!.includes(rbtId));
    }
    if (!preferences.allowDifferentRBT) {
      candidateRBTs = [originalSession.rbtId];
    }

    // 3. Generate time slots for each candidate RBT
    for (const rbtId of candidateRBTs) {
      const rbt = await this.rbtRepository.findById(rbtId);
      if (!rbt || !rbt.isActive) continue;

      // Generate options for each day within the range
      for (let dayOffset = 0; dayOffset <= maxDays; dayOffset++) {
        const candidateDate = new Date(originalDate);
        candidateDate.setDate(candidateDate.getDate() + dayOffset);

        // Skip weekends
        const dayOfWeek = candidateDate.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) continue;

        // Generate time slots for this day
        const timeSlots = await this.generateTimeSlots(
          candidateDate,
          preferences.preferredTimes
        );

        for (const timeSlot of timeSlots) {
          const startTime = new Date(candidateDate);
          const [hours, minutes] = timeSlot.startTime.split(':').map(Number);
          startTime.setHours(hours || 0, minutes || 0, 0, 0);

          const endTime = new Date(startTime);
          endTime.setHours(endTime.getHours() + 3); // 3-hour sessions

          // Check basic availability
          const conflicts = await this.sessionRepository.checkConflicts(
            originalSession.clientId,
            rbtId,
            startTime,
            endTime,
            undefined,
            originalSession.id
          );

          if (conflicts.length === 0) {
            candidates.push({
              rbtId,
              startTime,
              endTime,
              continuityScore: 0, // Will be calculated later
              availability: dayOffset === 0 ? 'preferred' : dayOffset <= 3 ? 'available' : 'possible'
            });
          }
        }
      }
    }

    return candidates;
  }

  /**
   * Generates time slots for a given date
   */
  private generateTimeSlots(
    date: Date,
    preferredTimes?: Array<{ startTime: string; endTime: string }>
  ): Array<{ startTime: string; endTime: string }> {
    if (preferredTimes && preferredTimes.length > 0) {
      return preferredTimes;
    }

    // Default business hour slots (9 AM to 4 PM for 3-hour sessions)
    const defaultSlots = [];
    for (let hour = 9; hour <= 16; hour++) {
      defaultSlots.push({
        startTime: `${hour.toString().padStart(2, '0')}:00`,
        endTime: `${(hour + 3).toString().padStart(2, '0')}:00`
      });
    }

    return defaultSlots;
  }

  /**
   * Evaluates and scores rescheduling options
   */
  private async evaluateReschedulingOptions(
    originalSession: Session,
    candidates: AlternativeOption[],
    preferences: ReschedulingPreferences
  ): Promise<ReschedulingOption[]> {
    const evaluatedOptions: ReschedulingOption[] = [];

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i]!;
      
      try {
        // 1. Calculate continuity score
        const clientSessions = await this.sessionRepository.findByClientId(originalSession.clientId);
        const continuityResult = this.continuityService.calculateContinuityScore(
          candidate.rbtId,
          originalSession.clientId,
          clientSessions
        );

        // 2. Calculate impact score (lower is better)
        const impactScore = await this.calculateImpactScore(
          originalSession,
          candidate
        );

        // 3. Calculate feasibility score
        const feasibilityScore = await this.calculateFeasibilityScore(
          originalSession,
          candidate,
          preferences
        );

        // 4. Calculate overall optimization score
        const optimizationScore = this.calculateOptimizationScore(
          continuityResult.score,
          impactScore,
          feasibilityScore,
          preferences
        );

        // 5. Get RBT name
        const rbt = await this.rbtRepository.findById(candidate.rbtId);
        const rbtName = rbt ? `${rbt.firstName} ${rbt.lastName}` : 'Unknown RBT';

        // 6. Generate recommendation reason
        const reasonForRecommendation = this.generateRecommendationReason(
          continuityResult.score,
          impactScore,
          feasibilityScore,
          candidate.rbtId === originalSession.rbtId
        );

        evaluatedOptions.push({
          rank: 0, // Will be set during ranking
          rbtId: candidate.rbtId,
          rbtName,
          startTime: candidate.startTime,
          endTime: candidate.endTime,
          optimizationScore,
          continuityScore: continuityResult.score,
          impactScore,
          feasibilityScore,
          reasonForRecommendation,
          potentialConflicts: [],
          requiredNotifications: this.calculateRequiredNotifications(originalSession, candidate)
        });

      } catch (error) {
        console.error(`Error evaluating candidate ${i}:`, error);
        continue;
      }
    }

    return evaluatedOptions;
  }

  /**
   * Calculates impact score for a rescheduling option
   */
  private async calculateImpactScore(
    originalSession: Session,
    candidate: AlternativeOption
  ): Promise<number> {
    let impactScore = 100; // Start with perfect score

    // Time deviation penalty
    const originalTime = originalSession.startTime.getHours() + (originalSession.startTime.getMinutes() / 60);
    const candidateTime = candidate.startTime.getHours() + (candidate.startTime.getMinutes() / 60);
    const timeDeviation = Math.abs(originalTime - candidateTime);
    impactScore -= timeDeviation * 5; // 5 points per hour deviation

    // Date deviation penalty
    const originalDate = new Date(originalSession.startTime.getFullYear(), originalSession.startTime.getMonth(), originalSession.startTime.getDate());
    const candidateDate = new Date(candidate.startTime.getFullYear(), candidate.startTime.getMonth(), candidate.startTime.getDate());
    const daysDifference = Math.abs((candidateDate.getTime() - originalDate.getTime()) / (1000 * 60 * 60 * 24));
    impactScore -= daysDifference * 3; // 3 points per day deviation

    // RBT change penalty
    if (candidate.rbtId !== originalSession.rbtId) {
      impactScore -= 15; // 15 point penalty for changing RBT
    }

    return Math.max(0, Math.min(100, impactScore));
  }

  /**
   * Calculates feasibility score for a rescheduling option
   */
  private async calculateFeasibilityScore(
    originalSession: Session,
    candidate: AlternativeOption,
    preferences: ReschedulingPreferences
  ): Promise<number> {
    let feasibilityScore = 100;

    // Check if it's a preferred time
    if (preferences.preferredTimes) {
      const candidateTimeStr = `${candidate.startTime.getHours().toString().padStart(2, '0')}:${candidate.startTime.getMinutes().toString().padStart(2, '0')}`;
      const isPreferredTime = preferences.preferredTimes.some(pt => pt.startTime === candidateTimeStr);
      if (!isPreferredTime) {
        feasibilityScore -= 10;
      }
    }

    // Check if it's a preferred RBT
    if (preferences.preferredRBTs && !preferences.preferredRBTs.includes(candidate.rbtId)) {
      feasibilityScore -= 15;
    }

    // Check notice time
    const hoursNotice = (candidate.startTime.getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursNotice < 24) {
      feasibilityScore -= 20; // Short notice penalty
    } else if (hoursNotice > 168) { // More than a week
      feasibilityScore -= 5; // Slight penalty for very far future
    }

    return Math.max(0, Math.min(100, feasibilityScore));
  }

  /**
   * Calculates overall optimization score
   */
  private calculateOptimizationScore(
    continuityScore: number,
    impactScore: number,
    feasibilityScore: number,
    preferences: ReschedulingPreferences
  ): number {
    // Default weights
    let continuityWeight = 0.4;
    let impactWeight = 0.4;
    let feasibilityWeight = 0.2;

    // Adjust weights based on preferences
    if (preferences.prioritizeContinuity) {
      continuityWeight = 0.6;
      impactWeight = 0.3;
      feasibilityWeight = 0.1;
    }

    return (continuityScore * continuityWeight) + 
           (impactScore * impactWeight) + 
           (feasibilityScore * feasibilityWeight);
  }

  /**
   * Optimizes and ranks the rescheduling options
   */
  private async optimizeAndRankOptions(
    options: ReschedulingOption[],
    preferences: ReschedulingPreferences
  ): Promise<ReschedulingOption[]> {
    // Sort by optimization score (highest first)
    const sortedOptions = options.sort((a, b) => b.optimizationScore - a.optimizationScore);

    // Assign ranks
    sortedOptions.forEach((option, index) => {
      option.rank = index + 1;
    });

    // Apply additional optimization rules
    return this.applyOptimizationRules(sortedOptions, preferences);
  }

  /**
   * Applies additional optimization rules
   */
  private applyOptimizationRules(
    options: ReschedulingOption[],
    preferences: ReschedulingPreferences
  ): ReschedulingOption[] {
    // Rule 1: Prefer same RBT if continuity is prioritized
    if (preferences.prioritizeContinuity) {
      const sameRbtOptions = options.filter(opt => opt.reasonForRecommendation.includes('same RBT'));
      const otherOptions = options.filter(opt => !opt.reasonForRecommendation.includes('same RBT'));
      return [...sameRbtOptions, ...otherOptions];
    }

    // Rule 2: Prefer closer dates
    return options.sort((a, b) => {
      if (Math.abs(a.optimizationScore - b.optimizationScore) < 5) {
        // If scores are close, prefer earlier dates
        return a.startTime.getTime() - b.startTime.getTime();
      }
      return b.optimizationScore - a.optimizationScore;
    });
  }

  /**
   * Generates recommendation reason
   */
  private generateRecommendationReason(
    continuityScore: number,
    impactScore: number,
    feasibilityScore: number,
    sameRBT: boolean
  ): string {
    const reasons: string[] = [];

    if (sameRBT) {
      reasons.push('maintains same RBT');
    }

    if (continuityScore > 80) {
      reasons.push('excellent continuity match');
    } else if (continuityScore > 60) {
      reasons.push('good continuity match');
    }

    if (impactScore > 80) {
      reasons.push('minimal schedule disruption');
    }

    if (feasibilityScore > 80) {
      reasons.push('highly feasible');
    }

    return reasons.length > 0 ? reasons.join(', ') : 'available option';
  }

  /**
   * Calculates required notifications for a rescheduling option
   */
  private calculateRequiredNotifications(
    originalSession: Session,
    candidate: AlternativeOption
  ): string[] {
    const notifications: string[] = [];

    notifications.push('Client/Guardian');
    notifications.push('Assigned RBT');

    if (candidate.rbtId !== originalSession.rbtId) {
      notifications.push('Original RBT');
      notifications.push('New RBT');
    }

    // Check if it's a significant time change
    const hoursDifference = Math.abs(
      (candidate.startTime.getTime() - originalSession.startTime.getTime()) / (1000 * 60 * 60)
    );

    if (hoursDifference > 24) {
      notifications.push('Scheduling Coordinator');
    }

    return notifications;
  }

  /**
   * Calculates optimization metrics
   */
  private calculateOptimizationMetrics(
    originalSession: Session,
    candidates: AlternativeOption[],
    optimizedOptions: ReschedulingOption[],
    processingTimeMs: number
  ): OptimizationMetrics {
    const continuityPreservationRate = optimizedOptions.length > 0 ? 
      (optimizedOptions.filter(opt => opt.rbtId === originalSession.rbtId).length / optimizedOptions.length) * 100 : 0;

    const timeDeviations = optimizedOptions.map(opt => 
      Math.abs((opt.startTime.getTime() - originalSession.startTime.getTime()) / (1000 * 60 * 60))
    );
    const averageTimeDeviation = timeDeviations.length > 0 ? 
      timeDeviations.reduce((sum, dev) => sum + dev, 0) / timeDeviations.length : 0;

    const dateDeviations = optimizedOptions.map(opt => {
      const originalDate = new Date(originalSession.startTime.getFullYear(), originalSession.startTime.getMonth(), originalSession.startTime.getDate());
      const optionDate = new Date(opt.startTime.getFullYear(), opt.startTime.getMonth(), opt.startTime.getDate());
      return Math.abs((optionDate.getTime() - originalDate.getTime()) / (1000 * 60 * 60 * 24));
    });
    const averageDateDeviation = dateDeviations.length > 0 ? 
      dateDeviations.reduce((sum, dev) => sum + dev, 0) / dateDeviations.length : 0;

    const conflictResolutionRate = candidates.length > 0 ? 
      (optimizedOptions.length / candidates.length) * 100 : 0;

    return {
      totalOptionsEvaluated: candidates.length,
      continuityPreservationRate,
      averageTimeDeviation,
      averageDateDeviation,
      conflictResolutionRate,
      processingTimeMs
    };
  }

  /**
   * Creates empty metrics for error cases
   */
  private createEmptyMetrics(processingTimeMs: number): OptimizationMetrics {
    return {
      totalOptionsEvaluated: 0,
      continuityPreservationRate: 0,
      averageTimeDeviation: 0,
      averageDateDeviation: 0,
      conflictResolutionRate: 0,
      processingTimeMs
    };
  }

  /**
   * Analyzes the impact of rescheduling on the overall schedule
   */
  async analyzeReschedulingImpact(
    sessionId: string,
    newStartTime: Date,
    newRbtId?: string
  ): Promise<ReschedulingImpact> {
    try {
      const originalSession = await this.sessionRepository.findById(sessionId);
      if (!originalSession) {
        throw new Error('Session not found');
      }

      const effectiveRbtId = newRbtId || originalSession.rbtId;
      const newEndTime = new Date(newStartTime);
      newEndTime.setHours(newEndTime.getHours() + 3);

      // Find potentially affected sessions
      const affectedSessions = await this.findAffectedSessions(
        originalSession,
        newStartTime,
        newEndTime,
        effectiveRbtId
      );

      // Calculate cascading changes
      const cascadingChanges = await this.calculateCascadingChanges(affectedSessions);

      // Calculate notification count
      const notificationCount = this.calculateNotificationCount(
        originalSession,
        effectiveRbtId !== originalSession.rbtId
      );

      // Calculate continuity disruption
      const continuityDisruption = await this.calculateContinuityDisruption(
        originalSession,
        effectiveRbtId
      );

      // Calculate operational complexity
      const operationalComplexity = this.calculateOperationalComplexity(
        affectedSessions.length,
        cascadingChanges,
        effectiveRbtId !== originalSession.rbtId
      );

      return {
        affectedSessions,
        cascadingChanges,
        notificationCount,
        continuityDisruption,
        operationalComplexity
      };

    } catch (error) {
      console.error('Error analyzing rescheduling impact:', error);
      return {
        affectedSessions: [],
        cascadingChanges: 0,
        notificationCount: 0,
        continuityDisruption: 0,
        operationalComplexity: 0
      };
    }
  }

  /**
   * Finds sessions that might be affected by the rescheduling
   */
  private async findAffectedSessions(
    originalSession: Session,
    newStartTime: Date,
    newEndTime: Date,
    newRbtId: string
  ): Promise<Session[]> {
    const searchStart = new Date(Math.min(originalSession.startTime.getTime(), newStartTime.getTime()));
    const searchEnd = new Date(Math.max(originalSession.endTime.getTime(), newEndTime.getTime()));

    // Extend search range by a day on each side
    searchStart.setDate(searchStart.getDate() - 1);
    searchEnd.setDate(searchEnd.getDate() + 1);

    const allSessions = await this.sessionRepository.findActiveByDateRange(searchStart, searchEnd);

    return allSessions.filter(session => 
      session.id !== originalSession.id &&
      (session.rbtId === originalSession.rbtId || session.rbtId === newRbtId || session.clientId === originalSession.clientId)
    );
  }

  /**
   * Calculates potential cascading changes
   */
  private async calculateCascadingChanges(affectedSessions: Session[]): Promise<number> {
    // Simple heuristic: each affected session might cause 0.5 additional changes on average
    return Math.floor(affectedSessions.length * 0.5);
  }

  /**
   * Calculates notification count
   */
  private calculateNotificationCount(originalSession: Session, rbtChanged: boolean): number {
    let count = 2; // Client and original RBT

    if (rbtChanged) {
      count += 2; // New RBT and coordinator
    }

    return count;
  }

  /**
   * Calculates continuity disruption score
   */
  private async calculateContinuityDisruption(
    originalSession: Session,
    newRbtId: string
  ): Promise<number> {
    if (newRbtId === originalSession.rbtId) {
      return 0; // No disruption if same RBT
    }

    // Get continuity scores for both RBTs
    const clientSessions = await this.sessionRepository.findByClientId(originalSession.clientId);
    
    const originalContinuity = this.continuityService.calculateContinuityScore(
      originalSession.rbtId,
      originalSession.clientId,
      clientSessions
    );

    const newContinuity = this.continuityService.calculateContinuityScore(
      newRbtId,
      originalSession.clientId,
      clientSessions
    );

    // Calculate disruption as the difference in continuity scores
    const disruption = Math.max(0, originalContinuity.score - newContinuity.score);
    return Math.min(100, disruption);
  }

  /**
   * Calculates operational complexity score
   */
  private calculateOperationalComplexity(
    affectedSessionCount: number,
    cascadingChanges: number,
    rbtChanged: boolean
  ): number {
    let complexity = 0;

    // Base complexity from affected sessions
    complexity += affectedSessionCount * 10;

    // Additional complexity from cascading changes
    complexity += cascadingChanges * 15;

    // Additional complexity if RBT changes
    if (rbtChanged) {
      complexity += 20;
    }

    return Math.min(100, complexity);
  }
}