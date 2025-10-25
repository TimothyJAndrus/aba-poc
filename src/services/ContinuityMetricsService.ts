import { PoolClient } from 'pg';
import { SessionRepository } from '../database/repositories/SessionRepository';
import { ContinuityScore } from '../types';
import { logger } from '../utils/logger';

export interface ContinuityMetrics {
  clientId: string;
  totalSessions: number;
  uniqueRbts: number;
  averageContinuityScore: number;
  primaryRbtId: string | undefined;
  primaryRbtPercentage: number;
  continuityTrend: 'improving' | 'stable' | 'declining';
}

export interface RbtClientPairingFrequency {
  rbtId: string;
  clientId: string;
  totalSessions: number;
  percentage: number;
  lastSessionDate?: Date;
  firstSessionDate?: Date;
  averageSessionsPerWeek: number;
}

export interface ContinuityReport {
  clientId: string;
  reportPeriod: {
    startDate: Date;
    endDate: Date;
  };
  metrics: ContinuityMetrics;
  pairingFrequencies: RbtClientPairingFrequency[];
  continuityScores: ContinuityScore[];
  recommendations: string[];
}

export class ContinuityMetricsService {
  private sessionRepository: SessionRepository;

  constructor() {
    this.sessionRepository = new SessionRepository();
  }

  /**
   * Calculate continuity score for a specific RBT-client pairing
   * Requirements: 2.2 - Track frequency of RBT-Client pairings
   */
  public async calculateContinuityScore(
    rbtId: string,
    clientId: string,
    referenceDate: Date = new Date(),
    client?: PoolClient
  ): Promise<ContinuityScore> {
    try {
      // Get all completed sessions for this RBT-client pair
      const query = `
        SELECT 
          start_time,
          end_time,
          status
        FROM sessions 
        WHERE rbt_id = $1 
          AND client_id = $2 
          AND status IN ('completed', 'confirmed')
          AND start_time <= $3
        ORDER BY start_time DESC
      `;

      const sessions = await this.sessionRepository['executeQuery']<{
        start_time: Date;
        end_time: Date;
        status: string;
      }>(query, [rbtId, clientId, referenceDate], client);

      const totalSessions = sessions.length;
      
      if (totalSessions === 0) {
        return {
          rbtId,
          clientId,
          score: 0,
          totalSessions: 0,
          recentSessions: 0
        };
      }

      // Calculate recent sessions (last 30 days)
      const thirtyDaysAgo = new Date(referenceDate);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentSessions = sessions.filter(
        session => new Date(session.start_time) >= thirtyDaysAgo
      ).length;

      // Get last session date (sessions are ordered DESC, so first is most recent)
      const lastSessionDate = sessions.length > 0 ? new Date(sessions[0]!.start_time) : undefined;

      // Calculate continuity score based on:
      // - Total sessions (40% weight)
      // - Recent activity (30% weight)
      // - Recency of last session (30% weight)
      
      let score = 0;

      // Total sessions component (0-40 points)
      const sessionScore = Math.min(totalSessions * 2, 40);
      score += sessionScore;

      // Recent activity component (0-30 points)
      const recentScore = Math.min(recentSessions * 5, 30);
      score += recentScore;

      // Recency component (0-30 points)
      if (lastSessionDate) {
        const daysSinceLastSession = Math.floor(
          (referenceDate.getTime() - lastSessionDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        
        let recencyScore = 30;
        if (daysSinceLastSession > 7) {
          recencyScore = Math.max(0, 30 - (daysSinceLastSession - 7) * 2);
        }
        score += recencyScore;
      }

      return {
        rbtId,
        clientId,
        score: Math.min(score, 100),
        lastSessionDate,
        totalSessions,
        recentSessions
      };
    } catch (error) {
      logger.error('Error calculating continuity score:', {
        rbtId,
        clientId,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  /**
   * Get continuity scores for all RBTs working with a specific client
   * Requirements: 2.2 - Track frequency of RBT-Client pairings
   */
  public async getClientContinuityScores(
    clientId: string,
    referenceDate: Date = new Date(),
    client?: PoolClient
  ): Promise<ContinuityScore[]> {
    try {
      // Get all RBTs who have worked with this client
      const query = `
        SELECT DISTINCT rbt_id
        FROM sessions 
        WHERE client_id = $1 
          AND status IN ('completed', 'confirmed')
          AND start_time <= $2
      `;

      const rbtRows = await this.sessionRepository['executeQuery']<{ rbt_id: string }>(
        query, 
        [clientId, referenceDate], 
        client
      );

      const continuityScores: ContinuityScore[] = [];

      for (const row of rbtRows || []) {
        const score = await this.calculateContinuityScore(
          row.rbt_id,
          clientId,
          referenceDate,
          client
        );
        continuityScores.push(score);
      }

      // Sort by score descending
      return continuityScores.sort((a, b) => b.score - a.score);
    } catch (error) {
      logger.error('Error getting client continuity scores:', {
        clientId,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  /**
   * Calculate RBT-client pairing frequencies
   * Requirements: 2.2 - Track frequency of RBT-Client pairings
   */
  public async calculatePairingFrequencies(
    clientId: string,
    startDate: Date,
    endDate: Date,
    client?: PoolClient
  ): Promise<RbtClientPairingFrequency[]> {
    try {
      const query = `
        SELECT 
          rbt_id,
          COUNT(*) as total_sessions,
          MIN(start_time) as first_session_date,
          MAX(start_time) as last_session_date
        FROM sessions 
        WHERE client_id = $1 
          AND status IN ('completed', 'confirmed')
          AND start_time >= $2 
          AND start_time <= $3
        GROUP BY rbt_id
        ORDER BY total_sessions DESC
      `;

      const rows = await this.sessionRepository['executeQuery']<{
        rbt_id: string;
        total_sessions: string;
        first_session_date: Date;
        last_session_date: Date;
      }>(query, [clientId, startDate, endDate], client);

      // Calculate total sessions for percentage calculation
      const totalSessions = rows?.reduce((sum, row) => sum + parseInt(row.total_sessions, 10), 0) || 0;

      const frequencies: RbtClientPairingFrequency[] = (rows || []).map(row => {
        const sessionCount = parseInt(row.total_sessions, 10);
        const percentage = totalSessions > 0 ? (sessionCount / totalSessions) * 100 : 0;
        
        // Calculate average sessions per week
        const firstDate = new Date(row.first_session_date);
        const lastDate = new Date(row.last_session_date);
        const weeksDiff = Math.max(1, (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
        const averageSessionsPerWeek = sessionCount / weeksDiff;

        return {
          rbtId: row.rbt_id,
          clientId,
          totalSessions: sessionCount,
          percentage: Math.round(percentage * 100) / 100,
          firstSessionDate: firstDate,
          lastSessionDate: lastDate,
          averageSessionsPerWeek: Math.round(averageSessionsPerWeek * 100) / 100
        };
      });

      return frequencies;
    } catch (error) {
      logger.error('Error calculating pairing frequencies:', {
        clientId,
        startDate,
        endDate,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  /**
   * Generate comprehensive continuity metrics for a client
   * Requirements: 2.2, 2.3 - Track frequency and generate reports
   */
  public async generateContinuityMetrics(
    clientId: string,
    startDate: Date,
    endDate: Date,
    client?: PoolClient
  ): Promise<ContinuityMetrics> {
    try {
      const pairingFrequencies = await this.calculatePairingFrequencies(
        clientId,
        startDate,
        endDate,
        client
      );

      const continuityScores = await this.getClientContinuityScores(clientId, endDate, client);

      const totalSessions = pairingFrequencies.reduce((sum, freq) => sum + freq.totalSessions, 0);
      const uniqueRbts = pairingFrequencies.length;

      // Calculate average continuity score
      const averageContinuityScore = continuityScores.length > 0
        ? continuityScores.reduce((sum, score) => sum + score.score, 0) / continuityScores.length
        : 0;

      // Identify primary RBT (highest frequency)
      const primaryRbt = pairingFrequencies.length > 0 ? pairingFrequencies[0] : null;
      const primaryRbtPercentage = primaryRbt ? primaryRbt.percentage : 0;

      // Determine continuity trend by comparing recent vs older periods
      const continuityTrend = await this.calculateContinuityTrend(
        clientId,
        startDate,
        endDate,
        client
      );

      return {
        clientId,
        totalSessions,
        uniqueRbts,
        averageContinuityScore: Math.round(averageContinuityScore * 100) / 100,
        primaryRbtId: primaryRbt?.rbtId,
        primaryRbtPercentage,
        continuityTrend
      };
    } catch (error) {
      logger.error('Error generating continuity metrics:', {
        clientId,
        startDate,
        endDate,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  /**
   * Calculate continuity trend (improving, stable, declining)
   */
  private async calculateContinuityTrend(
    clientId: string,
    startDate: Date,
    endDate: Date,
    client?: PoolClient
  ): Promise<'improving' | 'stable' | 'declining'> {
    try {
      const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (totalDays < 14) {
        return 'stable'; // Not enough data to determine trend
      }

      const midPoint = new Date(startDate.getTime() + (totalDays / 2) * 24 * 60 * 60 * 1000);

      // Get metrics for first half and second half
      const firstHalfMetrics = await this.generateContinuityMetrics(clientId, startDate, midPoint, client);
      const secondHalfMetrics = await this.generateContinuityMetrics(clientId, midPoint, endDate, client);

      const firstHalfScore = firstHalfMetrics.averageContinuityScore;
      const secondHalfScore = secondHalfMetrics.averageContinuityScore;

      const scoreDifference = secondHalfScore - firstHalfScore;

      if (scoreDifference > 5) {
        return 'improving';
      } else if (scoreDifference < -5) {
        return 'declining';
      } else {
        return 'stable';
      }
    } catch (error) {
      logger.error('Error calculating continuity trend:', {
        clientId,
        error: error instanceof Error ? error.message : error
      });
      return 'stable';
    }
  }

  /**
   * Generate comprehensive continuity report
   * Requirements: 2.3 - Generate reports showing continuity preference metrics
   */
  public async generateContinuityReport(
    clientId: string,
    startDate: Date,
    endDate: Date,
    client?: PoolClient
  ): Promise<ContinuityReport> {
    try {
      const [metrics, pairingFrequencies, continuityScores] = await Promise.all([
        this.generateContinuityMetrics(clientId, startDate, endDate, client),
        this.calculatePairingFrequencies(clientId, startDate, endDate, client),
        this.getClientContinuityScores(clientId, endDate, client)
      ]);

      // Generate recommendations based on metrics
      const recommendations = this.generateRecommendations(metrics, pairingFrequencies);

      return {
        clientId,
        reportPeriod: { startDate, endDate },
        metrics,
        pairingFrequencies,
        continuityScores,
        recommendations
      };
    } catch (error) {
      logger.error('Error generating continuity report:', {
        clientId,
        startDate,
        endDate,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  /**
   * Generate recommendations based on continuity metrics
   */
  private generateRecommendations(
    metrics: ContinuityMetrics,
    pairingFrequencies: RbtClientPairingFrequency[]
  ): string[] {
    const recommendations: string[] = [];

    // Check primary RBT percentage
    if (metrics.primaryRbtPercentage < 60) {
      recommendations.push(
        'Consider increasing sessions with the primary RBT to improve continuity of care'
      );
    }

    // Check number of unique RBTs
    if (metrics.uniqueRbts > 4) {
      recommendations.push(
        'Consider reducing the number of different RBTs working with this client to improve consistency'
      );
    }

    // Check continuity trend
    if (metrics.continuityTrend === 'declining') {
      recommendations.push(
        'Continuity scores are declining. Review recent scheduling changes and consider adjustments'
      );
    }

    // Check average continuity score
    if (metrics.averageContinuityScore < 50) {
      recommendations.push(
        'Low continuity scores detected. Consider prioritizing consistent RBT assignments'
      );
    }

    // Check for fragmented care
    const lowFrequencyRbts = pairingFrequencies.filter(freq => freq.percentage < 10).length;
    if (lowFrequencyRbts > 2) {
      recommendations.push(
        'Multiple RBTs with low session frequency detected. Consider consolidating care with fewer RBTs'
      );
    }

    return recommendations;
  }

  /**
   * Get continuity metrics for multiple clients
   */
  public async getBulkContinuityMetrics(
    clientIds: string[],
    startDate: Date,
    endDate: Date,
    client?: PoolClient
  ): Promise<ContinuityMetrics[]> {
    try {
      const metrics: ContinuityMetrics[] = [];

      for (const clientId of clientIds) {
        const clientMetrics = await this.generateContinuityMetrics(
          clientId,
          startDate,
          endDate,
          client
        );
        metrics.push(clientMetrics);
      }

      return metrics;
    } catch (error) {
      logger.error('Error getting bulk continuity metrics:', {
        clientIds,
        startDate,
        endDate,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }
}