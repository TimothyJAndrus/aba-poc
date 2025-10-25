import { ContinuityScore } from '../types';
import { Session } from '../models/Session';
import { Team } from '../models/Team';

export interface RBTClientHistory {
  rbtId: string;
  clientId: string;
  sessionCount: number;
  lastSessionDate?: Date | undefined;
  firstSessionDate?: Date | undefined;
  recentSessionCount: number; // Sessions in last 30 days
  weeklyFrequency: number; // Average sessions per week
  continuityStreak: number; // Consecutive weeks with sessions
}

export interface ContinuityMetrics {
  clientId: string;
  totalSessions: number;
  uniqueRBTs: number;
  primaryRBTId?: string | undefined; // RBT with most sessions
  primaryRBTPercentage: number; // Percentage of sessions with primary RBT
  averageContinuityScore: number;
  continuityTrend: 'improving' | 'stable' | 'declining';
}

export interface RBTSelectionResult {
  selectedRBTId: string;
  continuityScore: number;
  selectionReason: string;
  alternativeRBTs: Array<{
    rbtId: string;
    continuityScore: number;
    reason: string;
  }>;
}

/**
 * Service for managing RBT-client continuity preferences and history tracking
 * Implements algorithms to maintain therapeutic relationships and optimize RBT selection
 */
export class ContinuityPreferenceService {
  
  /**
   * Calculates comprehensive continuity score for an RBT-client pairing
   */
  calculateContinuityScore(
    rbtId: string,
    clientId: string,
    sessionHistory: Session[]
  ): ContinuityScore {
    const rbtClientSessions = sessionHistory.filter(
      session => session.rbtId === rbtId && 
                 session.clientId === clientId &&
                 session.status === 'completed'
    );

    if (rbtClientSessions.length === 0) {
      return {
        rbtId,
        clientId,
        score: 0,
        totalSessions: 0,
        recentSessions: 0
      };
    }

    // Sort sessions by date
    const sortedSessions = rbtClientSessions.sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime()
    );

    const totalSessions = sortedSessions.length;
    const lastSessionDate = sortedSessions[sortedSessions.length - 1]?.startTime;
    const firstSessionDate = sortedSessions[0]?.startTime;

    // Calculate recent sessions (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentSessions = sortedSessions.filter(
      session => session.startTime >= thirtyDaysAgo
    ).length;

    // Calculate score components
    let score = 0;

    // 1. Historical relationship strength (0-40 points)
    const historyScore = Math.min(totalSessions * 2, 40);
    score += historyScore;

    // 2. Recent activity bonus (0-25 points)
    const recentActivityScore = Math.min(recentSessions * 5, 25);
    score += recentActivityScore;

    // 3. Recency bonus (0-20 points)
    const daysSinceLastSession = lastSessionDate ? Math.floor(
      (Date.now() - lastSessionDate.getTime()) / (1000 * 60 * 60 * 24)
    ) : Infinity;
    
    let recencyScore = 0;
    if (daysSinceLastSession <= 7) {
      recencyScore = 20;
    } else if (daysSinceLastSession <= 14) {
      recencyScore = 15;
    } else if (daysSinceLastSession <= 30) {
      recencyScore = 10;
    } else if (daysSinceLastSession <= 60) {
      recencyScore = 5;
    }
    score += recencyScore;

    // 4. Consistency bonus (0-15 points)
    const consistencyScore = this.calculateConsistencyBonus(sortedSessions);
    score += consistencyScore;

    return {
      rbtId,
      clientId,
      score: Math.min(score, 100),
      lastSessionDate,
      totalSessions,
      recentSessions
    };
  }

  /**
   * Calculates consistency bonus based on regular session patterns
   */
  private calculateConsistencyBonus(sessions: Session[]): number {
    if (sessions.length < 3) return 0;

    // Calculate average days between sessions
    const intervals: number[] = [];
    for (let i = 1; i < sessions.length; i++) {
      const daysBetween = Math.floor(
        (sessions[i]!.startTime.getTime() - sessions[i-1]!.startTime.getTime()) / 
        (1000 * 60 * 60 * 24)
      );
      intervals.push(daysBetween);
    }

    // Calculate standard deviation of intervals
    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);

    // Lower standard deviation = more consistent = higher bonus
    // Ideal interval is 7 days (weekly sessions)
    const idealInterval = 7;
    const intervalScore = Math.max(0, 10 - Math.abs(avgInterval - idealInterval));
    const consistencyScore = Math.max(0, 5 - stdDev);

    return Math.min(intervalScore + consistencyScore, 15);
  }

  /**
   * Builds comprehensive RBT-client history for analysis
   */
  buildRBTClientHistory(
    rbtId: string,
    clientId: string,
    sessionHistory: Session[]
  ): RBTClientHistory {
    const rbtClientSessions = sessionHistory.filter(
      session => session.rbtId === rbtId && 
                 session.clientId === clientId &&
                 session.status === 'completed'
    ).sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    if (rbtClientSessions.length === 0) {
      return {
        rbtId,
        clientId,
        sessionCount: 0,
        recentSessionCount: 0,
        weeklyFrequency: 0,
        continuityStreak: 0
      };
    }

    const firstSessionDate = rbtClientSessions[0]?.startTime;
    const lastSessionDate = rbtClientSessions[rbtClientSessions.length - 1]?.startTime;

    // Calculate recent sessions (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentSessionCount = rbtClientSessions.filter(
      session => session.startTime >= thirtyDaysAgo
    ).length;

    // Calculate weekly frequency
    const totalWeeks = (lastSessionDate && firstSessionDate) ? Math.max(1, Math.ceil(
      (lastSessionDate.getTime() - firstSessionDate.getTime()) / (1000 * 60 * 60 * 24 * 7)
    )) : 1;
    const weeklyFrequency = rbtClientSessions.length / totalWeeks;

    // Calculate continuity streak (consecutive weeks with at least one session)
    const continuityStreak = this.calculateContinuityStreak(rbtClientSessions);

    return {
      rbtId,
      clientId,
      sessionCount: rbtClientSessions.length,
      firstSessionDate,
      lastSessionDate,
      recentSessionCount,
      weeklyFrequency,
      continuityStreak
    };
  }

  /**
   * Calculates continuity streak (consecutive weeks with sessions)
   */
  private calculateContinuityStreak(sessions: Session[]): number {
    if (sessions.length === 0) return 0;

    const weeklyBuckets = new Map<string, number>();
    
    // Group sessions by week
    sessions.forEach(session => {
      const weekStart = this.getWeekStart(session.startTime);
      const weekKey = weekStart.toISOString().split('T')[0];
      if (weekKey) {
        weeklyBuckets.set(weekKey, (weeklyBuckets.get(weekKey) || 0) + 1);
      }
    });

    // Find longest consecutive streak from the most recent week
    const sortedWeeks = Array.from(weeklyBuckets.keys()).sort().reverse();
    let streak = 0;
    
    for (let i = 0; i < sortedWeeks.length; i++) {
      if (i === 0) {
        streak = 1;
      } else {
        const currentWeekStr = sortedWeeks[i];
        const previousWeekStr = sortedWeeks[i-1];
        if (currentWeekStr && previousWeekStr) {
          const currentWeek = new Date(currentWeekStr);
          const previousWeek = new Date(previousWeekStr);
          const weekDiff = Math.floor(
            (previousWeek.getTime() - currentWeek.getTime()) / (1000 * 60 * 60 * 24 * 7)
          );
        
          if (weekDiff === 1) {
            streak++;
          } else {
            break;
          }
        }
      }
    }

    return streak;
  }

  /**
   * Gets the start of the week (Monday) for a given date
   */
  private getWeekStart(date: Date): Date {
    const result = new Date(date);
    const dayOfWeek = result.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Adjust for Sunday (0) to be last day of week
    result.setDate(result.getDate() + diff);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  /**
   * Selects optimal RBT from team based on continuity preferences
   */
  selectOptimalRBT(
    availableRBTs: string[],
    clientId: string,
    sessionHistory: Session[],
    teamInfo?: Team
  ): RBTSelectionResult {
    if (availableRBTs.length === 0) {
      throw new Error('No available RBTs provided');
    }

    if (availableRBTs.length === 1) {
      const rbtId = availableRBTs[0];
      if (!rbtId) {
        throw new Error('No available RBTs provided');
      }
      
      const continuityScore = this.calculateContinuityScore(
        rbtId,
        clientId,
        sessionHistory
      );
      
      return {
        selectedRBTId: rbtId,
        continuityScore: continuityScore.score,
        selectionReason: 'Only available RBT',
        alternativeRBTs: []
      };
    }

    // Calculate continuity scores for all available RBTs
    const rbtScores = availableRBTs.map(rbtId => {
      const continuityScore = this.calculateContinuityScore(rbtId, clientId, sessionHistory);
      const isPrimary = teamInfo?.primaryRbtId === rbtId;
      
      // Boost score for primary RBT
      const adjustedScore = isPrimary ? continuityScore.score + 50 : continuityScore.score;
      
      return {
        rbtId,
        continuityScore: continuityScore.score,
        adjustedScore,
        isPrimary,
        totalSessions: continuityScore.totalSessions,
        recentSessions: continuityScore.recentSessions,
        lastSessionDate: continuityScore.lastSessionDate
      };
    });

    // Sort by adjusted score (highest first)
    rbtScores.sort((a, b) => b.adjustedScore - a.adjustedScore);

    const selected = rbtScores[0];
    if (!selected) {
      throw new Error('No RBT scores calculated');
    }
    
    const alternatives = rbtScores.slice(1).map(rbt => ({
      rbtId: rbt.rbtId,
      continuityScore: rbt.continuityScore,
      reason: this.getSelectionReason(rbt, selected)
    }));

    return {
      selectedRBTId: selected.rbtId,
      continuityScore: selected.continuityScore,
      selectionReason: this.getSelectionReason(selected),
      alternativeRBTs: alternatives
    };
  }

  /**
   * Generates human-readable reason for RBT selection
   */
  private getSelectionReason(rbt: any, comparedTo?: any): string {
    if (rbt.isPrimary) {
      return 'Primary RBT for this client';
    }
    
    if (rbt.totalSessions > 0) {
      if (rbt.recentSessions > 0) {
        return `Strong continuity - ${rbt.totalSessions} total sessions, ${rbt.recentSessions} recent`;
      } else {
        return `Previous experience - ${rbt.totalSessions} total sessions`;
      }
    }
    
    if (comparedTo) {
      return 'Lower continuity score than selected RBT';
    }
    
    return 'New RBT assignment';
  }

  /**
   * Generates continuity metrics for a client
   */
  generateContinuityMetrics(
    clientId: string,
    sessionHistory: Session[],
    teamMembers: string[]
  ): ContinuityMetrics {
    const clientSessions = sessionHistory.filter(
      session => session.clientId === clientId && session.status === 'completed'
    );

    if (clientSessions.length === 0) {
      return {
        clientId,
        totalSessions: 0,
        uniqueRBTs: 0,
        primaryRBTPercentage: 0,
        averageContinuityScore: 0,
        continuityTrend: 'stable'
      };
    }

    // Count sessions by RBT
    const rbtSessionCounts = new Map<string, number>();
    clientSessions.forEach(session => {
      rbtSessionCounts.set(
        session.rbtId,
        (rbtSessionCounts.get(session.rbtId) || 0) + 1
      );
    });

    // Find primary RBT (most sessions)
    let primaryRBTId: string | undefined;
    let maxSessions = 0;
    rbtSessionCounts.forEach((count, rbtId) => {
      if (count > maxSessions) {
        maxSessions = count;
        primaryRBTId = rbtId;
      }
    });

    const primaryRBTPercentage = primaryRBTId ? 
      (maxSessions / clientSessions.length) * 100 : 0;

    // Calculate average continuity score
    const continuityScores = teamMembers.map(rbtId =>
      this.calculateContinuityScore(rbtId, clientId, sessionHistory).score
    );
    const averageContinuityScore = continuityScores.length > 0 ?
      continuityScores.reduce((sum, score) => sum + score, 0) / continuityScores.length : 0;

    // Determine continuity trend
    const continuityTrend = this.calculateContinuityTrend(clientSessions);

    return {
      clientId,
      totalSessions: clientSessions.length,
      uniqueRBTs: rbtSessionCounts.size,
      primaryRBTId: primaryRBTId || undefined,
      primaryRBTPercentage,
      averageContinuityScore,
      continuityTrend
    };
  }

  /**
   * Calculates continuity trend based on recent session patterns
   */
  private calculateContinuityTrend(sessions: Session[]): 'improving' | 'stable' | 'declining' {
    if (sessions.length < 6) return 'stable';

    // Sort sessions by date
    const sortedSessions = sessions.sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime()
    );

    // Split into two halves
    const midpoint = Math.floor(sortedSessions.length / 2);
    const firstHalf = sortedSessions.slice(0, midpoint);
    const secondHalf = sortedSessions.slice(midpoint);

    // Count unique RBTs in each half
    const firstHalfRBTs = new Set(firstHalf.map(s => s.rbtId)).size;
    const secondHalfRBTs = new Set(secondHalf.map(s => s.rbtId)).size;

    // Calculate primary RBT percentage in each half
    const firstHalfPrimary = this.getPrimaryRBTPercentage(firstHalf);
    const secondHalfPrimary = this.getPrimaryRBTPercentage(secondHalf);

    // Determine trend
    if (secondHalfPrimary > firstHalfPrimary + 10 || secondHalfRBTs < firstHalfRBTs) {
      return 'improving';
    } else if (secondHalfPrimary < firstHalfPrimary - 10 || secondHalfRBTs > firstHalfRBTs) {
      return 'declining';
    } else {
      return 'stable';
    }
  }

  /**
   * Calculates primary RBT percentage for a set of sessions
   */
  private getPrimaryRBTPercentage(sessions: Session[]): number {
    if (sessions.length === 0) return 0;

    const rbtCounts = new Map<string, number>();
    sessions.forEach(session => {
      rbtCounts.set(session.rbtId, (rbtCounts.get(session.rbtId) || 0) + 1);
    });

    const maxCount = Math.max(...rbtCounts.values());
    return (maxCount / sessions.length) * 100;
  }

  /**
   * Tracks RBT-client pairing history for reporting
   */
  trackPairingHistory(
    clientId: string,
    sessionHistory: Session[]
  ): Map<string, RBTClientHistory> {
    const pairingHistory = new Map<string, RBTClientHistory>();
    
    // Get unique RBTs who have worked with this client
    const uniqueRBTs = [...new Set(
      sessionHistory
        .filter(session => session.clientId === clientId && session.status === 'completed')
        .map(session => session.rbtId)
    )];

    // Build history for each RBT
    uniqueRBTs.forEach(rbtId => {
      const history = this.buildRBTClientHistory(rbtId, clientId, sessionHistory);
      pairingHistory.set(rbtId, history);
    });

    return pairingHistory;
  }
}