import { PoolClient } from 'pg';
import { ScheduleEventRepository } from '../database/repositories/ScheduleEventRepository';
import { ScheduleEvent, ScheduleEventQuery, AuditTrail } from '../models/ScheduleEvent';
import { ScheduleEventType } from '../types';
import { logger } from '../utils/logger';

export interface DisruptionMetrics {
  totalDisruptions: number;
  disruptionsByType: Record<ScheduleEventType, number>;
  disruptionRate: number; // Percentage of sessions affected
  averageDisruptionsPerWeek: number;
  mostCommonReason: string;
  trend: 'increasing' | 'stable' | 'decreasing';
}

export interface DisruptionImpactAnalysis {
  affectedSessions: number;
  affectedClients: number;
  affectedRbts: number;
  rescheduleSuccessRate: number;
  averageRescheduleTime: number; // Hours
  clientImpactScore: number; // 0-100, higher is worse
}

export interface DisruptionFrequencyReport {
  period: {
    startDate: Date;
    endDate: Date;
  };
  metrics: DisruptionMetrics;
  impactAnalysis: DisruptionImpactAnalysis;
  topDisruptionReasons: Array<{
    reason: string;
    count: number;
    percentage: number;
  }>;
  disruptionsByTimeOfDay: Array<{
    hour: number;
    count: number;
  }>;
  disruptionsByDayOfWeek: Array<{
    dayOfWeek: number;
    dayName: string;
    count: number;
  }>;
}

export interface ClientDisruptionProfile {
  clientId: string;
  totalSessions: number;
  disruptedSessions: number;
  disruptionRate: number;
  mostCommonDisruptionType: ScheduleEventType;
  averageRescheduleTime: number;
  continuityImpact: number; // 0-100, higher is worse
  recommendations: string[];
}

export interface RbtDisruptionProfile {
  rbtId: string;
  totalSessions: number;
  causedDisruptions: number;
  affectedByDisruptions: number;
  unavailabilityEvents: number;
  disruptionRate: number;
  reliability: number; // 0-100, higher is better
  recommendations: string[];
}

export class ScheduleDisruptionReportingService {
  private scheduleEventRepository: ScheduleEventRepository;

  constructor() {
    this.scheduleEventRepository = new ScheduleEventRepository();
  }

  /**
   * Generate comprehensive disruption frequency report
   * Requirements: 3.5, 4.5 - Maintain log of disruptions and analyze frequency
   */
  public async generateDisruptionFrequencyReport(
    startDate: Date,
    endDate: Date,
    client?: PoolClient
  ): Promise<DisruptionFrequencyReport> {
    try {
      const [metrics, impactAnalysis, topReasons, timeDistribution, dayDistribution] = await Promise.all([
        this.calculateDisruptionMetrics(startDate, endDate, client),
        this.analyzeDisruptionImpact(startDate, endDate, client),
        this.getTopDisruptionReasons(startDate, endDate, client),
        this.getDisruptionsByTimeOfDay(startDate, endDate, client),
        this.getDisruptionsByDayOfWeek(startDate, endDate, client)
      ]);

      return {
        period: { startDate, endDate },
        metrics,
        impactAnalysis,
        topDisruptionReasons: topReasons,
        disruptionsByTimeOfDay: timeDistribution,
        disruptionsByDayOfWeek: dayDistribution
      };
    } catch (error) {
      logger.error('Error generating disruption frequency report:', {
        startDate,
        endDate,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  /**
   * Calculate disruption metrics
   * Requirements: 3.5 - Maintain log of schedule disruptions and resulting changes
   */
  private async calculateDisruptionMetrics(
    startDate: Date,
    endDate: Date,
    client?: PoolClient
  ): Promise<DisruptionMetrics> {
    try {
      // Get all disruption events
      const disruptionTypes: ScheduleEventType[] = [
        'session_cancelled',
        'session_rescheduled',
        'rbt_unavailable'
      ];

      const disruptionEvents = await this.scheduleEventRepository.query({
        startDate,
        endDate
      }, client);

      const disruptions = disruptionEvents.filter(event => 
        disruptionTypes.includes(event.eventType)
      );

      const totalDisruptions = disruptions.length;

      // Count disruptions by type
      const disruptionsByType: Record<ScheduleEventType, number> = {
        session_created: 0,
        session_cancelled: 0,
        session_rescheduled: 0,
        rbt_unavailable: 0,
        team_created: 0,
        team_updated: 0,
        team_ended: 0,
        rbt_added: 0,
        rbt_removed: 0,
        primary_changed: 0
      };

      disruptions.forEach(event => {
        disruptionsByType[event.eventType]++;
      });

      // Calculate total sessions in period for disruption rate
      const totalSessionsQuery = `
        SELECT COUNT(*) as count
        FROM sessions 
        WHERE start_time >= $1 AND start_time <= $2
      `;
      
      const sessionCountResult = await this.scheduleEventRepository['executeQuery']<{ count: string }>(
        totalSessionsQuery,
        [startDate, endDate],
        client
      );
      
      const totalSessions = parseInt(sessionCountResult[0]?.count || '0', 10);
      const disruptionRate = totalSessions > 0 ? (totalDisruptions / totalSessions) * 100 : 0;

      // Calculate average disruptions per week
      const daysDiff = Math.max(1, (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const weeksDiff = daysDiff / 7;
      const averageDisruptionsPerWeek = totalDisruptions / weeksDiff;

      // Find most common reason
      const reasonCounts: Record<string, number> = {};
      disruptions.forEach(event => {
        const reason = event.reason || 'Unknown';
        reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
      });

      const mostCommonReason = Object.entries(reasonCounts)
        .sort(([, a], [, b]) => b - a)[0]?.[0] || 'No disruptions';

      // Calculate trend by comparing first and second half of period
      const trend = await this.calculateDisruptionTrend(startDate, endDate, client);

      return {
        totalDisruptions,
        disruptionsByType,
        disruptionRate: Math.round(disruptionRate * 100) / 100,
        averageDisruptionsPerWeek: Math.round(averageDisruptionsPerWeek * 100) / 100,
        mostCommonReason,
        trend
      };
    } catch (error) {
      logger.error('Error calculating disruption metrics:', {
        startDate,
        endDate,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  /**
   * Analyze disruption impact
   * Requirements: 4.5 - Analyze disruption frequency and impact
   */
  private async analyzeDisruptionImpact(
    startDate: Date,
    endDate: Date,
    client?: PoolClient
  ): Promise<DisruptionImpactAnalysis> {
    try {
      // Get disruption events with session details
      const query = `
        SELECT 
          se.event_type,
          se.session_id,
          se.client_id,
          se.rbt_id,
          se.created_at,
          se.old_values,
          se.new_values,
          s.start_time as original_start_time
        FROM schedule_events se
        LEFT JOIN sessions s ON se.session_id = s.id
        WHERE se.created_at >= $1 
          AND se.created_at <= $2
          AND se.event_type IN ('session_cancelled', 'session_rescheduled', 'rbt_unavailable')
      `;

      const disruptionData = await this.scheduleEventRepository['executeQuery']<{
        event_type: ScheduleEventType;
        session_id: string;
        client_id: string;
        rbt_id: string;
        created_at: Date;
        old_values: string;
        new_values: string;
        original_start_time: Date;
      }>(query, [startDate, endDate], client);

      const affectedSessions = new Set(
        disruptionData.filter(d => d.session_id).map(d => d.session_id)
      ).size;

      const affectedClients = new Set(
        disruptionData.filter(d => d.client_id).map(d => d.client_id)
      ).size;

      const affectedRbts = new Set(
        disruptionData.filter(d => d.rbt_id).map(d => d.rbt_id)
      ).size;

      // Calculate reschedule success rate
      const rescheduledEvents = disruptionData.filter(d => d.event_type === 'session_rescheduled');
      const cancelledEvents = disruptionData.filter(d => d.event_type === 'session_cancelled');
      
      const totalReschedulingAttempts = rescheduledEvents.length + cancelledEvents.length;
      const rescheduleSuccessRate = totalReschedulingAttempts > 0 
        ? (rescheduledEvents.length / totalReschedulingAttempts) * 100 
        : 0;

      // Calculate average reschedule time
      let totalRescheduleTime = 0;
      let rescheduleTimeCount = 0;

      for (const event of rescheduledEvents) {
        if (event.original_start_time && event.new_values) {
          try {
            const newValues = JSON.parse(event.new_values);
            if (newValues.startTime) {
              const originalTime = new Date(event.original_start_time);
              const disruptionTime = new Date(event.created_at);
              const rescheduleHours = (disruptionTime.getTime() - originalTime.getTime()) / (1000 * 60 * 60);
              
              if (rescheduleHours >= 0) {
                totalRescheduleTime += rescheduleHours;
                rescheduleTimeCount++;
              }
            }
          } catch (error) {
            // Skip invalid JSON
          }
        }
      }

      const averageRescheduleTime = rescheduleTimeCount > 0 
        ? totalRescheduleTime / rescheduleTimeCount 
        : 0;

      // Calculate client impact score (0-100, higher is worse)
      const disruptionRate = affectedSessions / Math.max(1, affectedSessions + 100); // Assume baseline
      const clientImpactScore = Math.min(100, (disruptionRate * 100) + (cancelledEvents.length * 5));

      return {
        affectedSessions,
        affectedClients,
        affectedRbts,
        rescheduleSuccessRate: Math.round(rescheduleSuccessRate * 100) / 100,
        averageRescheduleTime: Math.round(averageRescheduleTime * 100) / 100,
        clientImpactScore: Math.round(clientImpactScore * 100) / 100
      };
    } catch (error) {
      logger.error('Error analyzing disruption impact:', {
        startDate,
        endDate,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  /**
   * Get top disruption reasons
   */
  private async getTopDisruptionReasons(
    startDate: Date,
    endDate: Date,
    client?: PoolClient
  ): Promise<Array<{ reason: string; count: number; percentage: number }>> {
    try {
      const query = `
        SELECT 
          COALESCE(reason, 'Unknown') as reason,
          COUNT(*) as count
        FROM schedule_events 
        WHERE created_at >= $1 
          AND created_at <= $2
          AND event_type IN ('session_cancelled', 'session_rescheduled', 'rbt_unavailable')
        GROUP BY reason
        ORDER BY count DESC
        LIMIT 10
      `;

      const results = await this.scheduleEventRepository['executeQuery']<{
        reason: string;
        count: string;
      }>(query, [startDate, endDate], client);

      const totalCount = results.reduce((sum, row) => sum + parseInt(row.count, 10), 0);

      return results.map(row => {
        const count = parseInt(row.count, 10);
        return {
          reason: row.reason,
          count,
          percentage: totalCount > 0 ? Math.round((count / totalCount) * 10000) / 100 : 0
        };
      });
    } catch (error) {
      logger.error('Error getting top disruption reasons:', {
        startDate,
        endDate,
        error: error instanceof Error ? error.message : error
      });
      return [];
    }
  }

  /**
   * Get disruptions by time of day
   */
  private async getDisruptionsByTimeOfDay(
    startDate: Date,
    endDate: Date,
    client?: PoolClient
  ): Promise<Array<{ hour: number; count: number }>> {
    try {
      const query = `
        SELECT 
          EXTRACT(HOUR FROM created_at) as hour,
          COUNT(*) as count
        FROM schedule_events 
        WHERE created_at >= $1 
          AND created_at <= $2
          AND event_type IN ('session_cancelled', 'session_rescheduled', 'rbt_unavailable')
        GROUP BY EXTRACT(HOUR FROM created_at)
        ORDER BY hour
      `;

      const results = await this.scheduleEventRepository['executeQuery']<{
        hour: string;
        count: string;
      }>(query, [startDate, endDate], client);

      return results.map(row => ({
        hour: parseInt(row.hour, 10),
        count: parseInt(row.count, 10)
      }));
    } catch (error) {
      logger.error('Error getting disruptions by time of day:', {
        startDate,
        endDate,
        error: error instanceof Error ? error.message : error
      });
      return [];
    }
  }

  /**
   * Get disruptions by day of week
   */
  private async getDisruptionsByDayOfWeek(
    startDate: Date,
    endDate: Date,
    client?: PoolClient
  ): Promise<Array<{ dayOfWeek: number; dayName: string; count: number }>> {
    try {
      const query = `
        SELECT 
          EXTRACT(DOW FROM created_at) as day_of_week,
          COUNT(*) as count
        FROM schedule_events 
        WHERE created_at >= $1 
          AND created_at <= $2
          AND event_type IN ('session_cancelled', 'session_rescheduled', 'rbt_unavailable')
        GROUP BY EXTRACT(DOW FROM created_at)
        ORDER BY day_of_week
      `;

      const results = await this.scheduleEventRepository['executeQuery']<{
        day_of_week: string;
        count: string;
      }>(query, [startDate, endDate], client);

      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

      return results.map(row => {
        const dayOfWeek = parseInt(row.day_of_week, 10);
        return {
          dayOfWeek,
          dayName: dayNames[dayOfWeek] || 'Unknown',
          count: parseInt(row.count, 10)
        };
      });
    } catch (error) {
      logger.error('Error getting disruptions by day of week:', {
        startDate,
        endDate,
        error: error instanceof Error ? error.message : error
      });
      return [];
    }
  }

  /**
   * Calculate disruption trend
   */
  private async calculateDisruptionTrend(
    startDate: Date,
    endDate: Date,
    client?: PoolClient
  ): Promise<'increasing' | 'stable' | 'decreasing'> {
    try {
      const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (totalDays < 14) {
        return 'stable'; // Not enough data
      }

      const midPoint = new Date(startDate.getTime() + (totalDays / 2) * 24 * 60 * 60 * 1000);

      // Count disruptions in first and second half
      const firstHalfQuery = `
        SELECT COUNT(*) as count
        FROM schedule_events 
        WHERE created_at >= $1 AND created_at < $2
          AND event_type IN ('session_cancelled', 'session_rescheduled', 'rbt_unavailable')
      `;

      const secondHalfQuery = `
        SELECT COUNT(*) as count
        FROM schedule_events 
        WHERE created_at >= $1 AND created_at <= $2
          AND event_type IN ('session_cancelled', 'session_rescheduled', 'rbt_unavailable')
      `;

      const [firstHalfResult, secondHalfResult] = await Promise.all([
        this.scheduleEventRepository['executeQuery']<{ count: string }>(
          firstHalfQuery, 
          [startDate, midPoint], 
          client
        ),
        this.scheduleEventRepository['executeQuery']<{ count: string }>(
          secondHalfQuery, 
          [midPoint, endDate], 
          client
        )
      ]);

      const firstHalfCount = parseInt(firstHalfResult[0]?.count || '0', 10);
      const secondHalfCount = parseInt(secondHalfResult[0]?.count || '0', 10);

      const changePercentage = firstHalfCount > 0 
        ? ((secondHalfCount - firstHalfCount) / firstHalfCount) * 100 
        : 0;

      if (changePercentage > 20) {
        return 'increasing';
      } else if (changePercentage < -20) {
        return 'decreasing';
      } else {
        return 'stable';
      }
    } catch (error) {
      logger.error('Error calculating disruption trend:', {
        startDate,
        endDate,
        error: error instanceof Error ? error.message : error
      });
      return 'stable';
    }
  }

  /**
   * Generate client disruption profile
   * Requirements: 3.5 - Analyze impact of disruptions on individual clients
   */
  public async generateClientDisruptionProfile(
    clientId: string,
    startDate: Date,
    endDate: Date,
    client?: PoolClient
  ): Promise<ClientDisruptionProfile> {
    try {
      // Get total sessions for client
      const totalSessionsQuery = `
        SELECT COUNT(*) as count
        FROM sessions 
        WHERE client_id = $1 AND start_time >= $2 AND start_time <= $3
      `;

      const totalSessionsResult = await this.scheduleEventRepository['executeQuery']<{ count: string }>(
        totalSessionsQuery,
        [clientId, startDate, endDate],
        client
      );

      const totalSessions = parseInt(totalSessionsResult[0]?.count || '0', 10);

      // Get disruption events for client
      const disruptionEvents = await this.scheduleEventRepository.findByClientId(
        clientId,
        { orderBy: 'created_at', orderDirection: 'DESC' },
        client
      );

      const relevantDisruptions = disruptionEvents.filter(event => 
        event.createdAt >= startDate && 
        event.createdAt <= endDate &&
        ['session_cancelled', 'session_rescheduled'].includes(event.eventType)
      );

      const disruptedSessions = new Set(
        relevantDisruptions.filter(d => d.sessionId).map(d => d.sessionId!)
      ).size;

      const disruptionRate = totalSessions > 0 ? (disruptedSessions / totalSessions) * 100 : 0;

      // Find most common disruption type
      const disruptionTypeCounts: Record<ScheduleEventType, number> = {
        session_created: 0,
        session_cancelled: 0,
        session_rescheduled: 0,
        rbt_unavailable: 0,
        team_created: 0,
        team_updated: 0,
        team_ended: 0,
        rbt_added: 0,
        rbt_removed: 0,
        primary_changed: 0
      };

      relevantDisruptions.forEach(event => {
        disruptionTypeCounts[event.eventType]++;
      });

      const mostCommonDisruptionType = Object.entries(disruptionTypeCounts)
        .sort(([, a], [, b]) => b - a)[0]?.[0] as ScheduleEventType || 'session_cancelled';

      // Calculate average reschedule time
      const rescheduledEvents = relevantDisruptions.filter(e => e.eventType === 'session_rescheduled');
      let totalRescheduleTime = 0;
      let rescheduleCount = 0;

      // Calculate continuity impact (simplified)
      const continuityImpact = Math.min(100, disruptionRate * 2);

      // Generate recommendations
      const recommendations = this.generateClientRecommendations(
        disruptionRate,
        mostCommonDisruptionType,
        relevantDisruptions.length
      );

      return {
        clientId,
        totalSessions,
        disruptedSessions,
        disruptionRate: Math.round(disruptionRate * 100) / 100,
        mostCommonDisruptionType,
        averageRescheduleTime: Math.round(totalRescheduleTime * 100) / 100,
        continuityImpact: Math.round(continuityImpact * 100) / 100,
        recommendations
      };
    } catch (error) {
      logger.error('Error generating client disruption profile:', {
        clientId,
        startDate,
        endDate,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  /**
   * Generate RBT disruption profile
   * Requirements: 4.5 - Analyze RBT-related disruptions
   */
  public async generateRbtDisruptionProfile(
    rbtId: string,
    startDate: Date,
    endDate: Date,
    client?: PoolClient
  ): Promise<RbtDisruptionProfile> {
    try {
      // Get total sessions for RBT
      const totalSessionsQuery = `
        SELECT COUNT(*) as count
        FROM sessions 
        WHERE rbt_id = $1 AND start_time >= $2 AND start_time <= $3
      `;

      const totalSessionsResult = await this.scheduleEventRepository['executeQuery']<{ count: string }>(
        totalSessionsQuery,
        [rbtId, startDate, endDate],
        client
      );

      const totalSessions = parseInt(totalSessionsResult[0]?.count || '0', 10);

      // Get disruption events for RBT
      const disruptionEvents = await this.scheduleEventRepository.findByRbtId(
        rbtId,
        { orderBy: 'created_at', orderDirection: 'DESC' },
        client
      );

      const relevantDisruptions = disruptionEvents.filter(event => 
        event.createdAt >= startDate && event.createdAt <= endDate
      );

      const causedDisruptions = relevantDisruptions.filter(event => 
        event.eventType === 'rbt_unavailable'
      ).length;

      const affectedByDisruptions = relevantDisruptions.filter(event => 
        ['session_cancelled', 'session_rescheduled'].includes(event.eventType)
      ).length;

      const unavailabilityEvents = relevantDisruptions.filter(event => 
        event.eventType === 'rbt_unavailable'
      ).length;

      const disruptionRate = totalSessions > 0 
        ? ((causedDisruptions + affectedByDisruptions) / totalSessions) * 100 
        : 0;

      const reliability = Math.max(0, 100 - disruptionRate);

      // Generate recommendations
      const recommendations = this.generateRbtRecommendations(
        disruptionRate,
        unavailabilityEvents,
        causedDisruptions
      );

      return {
        rbtId,
        totalSessions,
        causedDisruptions,
        affectedByDisruptions,
        unavailabilityEvents,
        disruptionRate: Math.round(disruptionRate * 100) / 100,
        reliability: Math.round(reliability * 100) / 100,
        recommendations
      };
    } catch (error) {
      logger.error('Error generating RBT disruption profile:', {
        rbtId,
        startDate,
        endDate,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  /**
   * Get audit trail for schedule changes
   * Requirements: 3.5 - Create audit trail queries for schedule changes
   */
  public async getScheduleChangeAuditTrail(
    entityType: 'session' | 'rbt' | 'client',
    entityId: string,
    startDate?: Date,
    endDate?: Date,
    client?: PoolClient
  ): Promise<AuditTrail> {
    try {
      return await this.scheduleEventRepository.getAuditTrail(
        entityType,
        entityId,
        startDate,
        endDate,
        client
      );
    } catch (error) {
      logger.error('Error getting schedule change audit trail:', {
        entityType,
        entityId,
        startDate,
        endDate,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  /**
   * Generate client-specific recommendations
   */
  private generateClientRecommendations(
    disruptionRate: number,
    mostCommonType: ScheduleEventType,
    totalDisruptions: number
  ): string[] {
    const recommendations: string[] = [];

    if (disruptionRate > 20) {
      recommendations.push('High disruption rate detected. Consider reviewing scheduling preferences and RBT assignments.');
    }

    if (mostCommonType === 'session_cancelled') {
      recommendations.push('Frequent cancellations detected. Review client availability patterns and communication preferences.');
    }

    if (mostCommonType === 'session_rescheduled') {
      recommendations.push('Frequent rescheduling detected. Consider more flexible scheduling options or backup RBT assignments.');
    }

    if (totalDisruptions > 10) {
      recommendations.push('Multiple disruptions detected. Consider implementing proactive scheduling strategies.');
    }

    return recommendations;
  }

  /**
   * Generate RBT-specific recommendations
   */
  private generateRbtRecommendations(
    disruptionRate: number,
    unavailabilityEvents: number,
    causedDisruptions: number
  ): string[] {
    const recommendations: string[] = [];

    if (disruptionRate > 15) {
      recommendations.push('High disruption rate detected. Review availability patterns and scheduling practices.');
    }

    if (unavailabilityEvents > 5) {
      recommendations.push('Frequent unavailability events. Consider improving advance notice procedures.');
    }

    if (causedDisruptions > 3) {
      recommendations.push('Multiple disruptions caused. Review reliability and consider additional training or support.');
    }

    return recommendations;
  }
}