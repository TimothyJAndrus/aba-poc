import { ContinuityScore, SchedulingConstraints, AlternativeOption } from '../types';
import { isWithinBusinessHours, getDurationInHours, isTimeSlotAvailable } from './dateTime';

/**
 * Scheduling utility functions for constraint validation and optimization
 */

export const validateSchedulingConstraints = (
  startTime: Date,
  endTime: Date,
  constraints: SchedulingConstraints
): { isValid: boolean; violations: string[] } => {
  const violations: string[] = [];
  
  // Check business hours
  if (!isWithinBusinessHours(startTime) || !isWithinBusinessHours(endTime)) {
    violations.push('Session must be within business hours (9 AM - 7 PM)');
  }
  
  // Check session duration
  const duration = getDurationInHours(startTime, endTime);
  if (duration !== constraints.sessionDuration) {
    violations.push(`Session duration must be exactly ${constraints.sessionDuration} hours`);
  }
  
  // Check valid business days
  const dayOfWeek = startTime.getDay();
  if (!constraints.businessHours.validDays.includes(dayOfWeek)) {
    violations.push('Session must be scheduled on a valid business day (Monday-Friday)');
  }
  
  return {
    isValid: violations.length === 0,
    violations
  };
};

export const calculateContinuityScore = (
  rbtId: string,
  clientId: string,
  sessionHistory: Array<{ rbtId: string; clientId: string; sessionDate: Date }>
): ContinuityScore => {
  const rbtClientSessions = sessionHistory.filter(
    session => session.rbtId === rbtId && session.clientId === clientId
  );
  
  const totalSessions = rbtClientSessions.length;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const recentSessions = rbtClientSessions.filter(
    session => session.sessionDate >= thirtyDaysAgo
  ).length;
  
  const lastSessionDate = rbtClientSessions.length > 0 
    ? new Date(Math.max(...rbtClientSessions.map(s => s.sessionDate.getTime())))
    : undefined;
  
  // Calculate score based on recency and frequency
  let score = 0;
  
  // Base score from total sessions (max 40 points)
  score += Math.min(totalSessions * 5, 40);
  
  // Recent activity bonus (max 30 points)
  score += Math.min(recentSessions * 10, 30);
  
  // Recency bonus (max 30 points)
  if (lastSessionDate) {
    const daysSinceLastSession = Math.floor(
      (Date.now() - lastSessionDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysSinceLastSession <= 7) {
      score += 30;
    } else if (daysSinceLastSession <= 14) {
      score += 20;
    } else if (daysSinceLastSession <= 30) {
      score += 10;
    }
  }
  
  return {
    rbtId,
    clientId,
    score: Math.min(score, 100),
    lastSessionDate,
    totalSessions,
    recentSessions
  };
};

export const findOptimalRBTAssignment = (
  availableRBTs: string[],
  clientId: string,
  sessionHistory: Array<{ rbtId: string; clientId: string; sessionDate: Date }>
): string | null => {
  if (availableRBTs.length === 0) {
    return null;
  }
  
  // Calculate continuity scores for all available RBTs
  const continuityScores = availableRBTs.map(rbtId =>
    calculateContinuityScore(rbtId, clientId, sessionHistory)
  );
  
  // Sort by continuity score (highest first)
  continuityScores.sort((a, b) => b.score - a.score);
  
  return continuityScores[0]?.rbtId || null;
};

export const detectSchedulingConflicts = (
  proposedStart: Date,
  proposedEnd: Date,
  existingSessions: Array<{ startTime: Date; endTime: Date; sessionId: string }>
): Array<{ sessionId: string; conflictType: string }> => {
  const conflicts: Array<{ sessionId: string; conflictType: string }> = [];
  
  for (const session of existingSessions) {
    if (!isTimeSlotAvailable(proposedStart, proposedEnd, session.startTime, session.endTime)) {
      conflicts.push({
        sessionId: session.sessionId,
        conflictType: 'time_overlap'
      });
    }
  }
  
  return conflicts;
};

export const generateAlternativeTimeSlots = (
  preferredStart: Date,
  sessionDuration: number,
  availableSlots: Array<{ startTime: Date; endTime: Date }>,
  constraints: SchedulingConstraints
): AlternativeOption[] => {
  const alternatives: AlternativeOption[] = [];
  
  for (const slot of availableSlots) {
    const slotDurationHours = getDurationInHours(slot.startTime, slot.endTime);
    
    // Check if slot is long enough for the session
    if (slotDurationHours >= sessionDuration) {
      const proposedEnd = new Date(slot.startTime);
      proposedEnd.setHours(proposedEnd.getHours() + sessionDuration);
      
      // Validate constraints
      const validation = validateSchedulingConstraints(slot.startTime, proposedEnd, constraints);
      
      if (validation.isValid) {
        // Calculate preference score based on proximity to preferred time
        const timeDiffMs = Math.abs(slot.startTime.getTime() - preferredStart.getTime());
        const timeDiffHours = timeDiffMs / (1000 * 60 * 60);
        const proximityScore = Math.max(0, 100 - (timeDiffHours * 10));
        
        alternatives.push({
          rbtId: '', // Will be filled by calling function
          startTime: slot.startTime,
          endTime: proposedEnd,
          continuityScore: 0, // Will be calculated separately
          availability: proximityScore > 80 ? 'preferred' : proximityScore > 50 ? 'available' : 'possible'
        });
      }
    }
  }
  
  // Sort by preference (preferred times first)
  alternatives.sort((a, b) => {
    const scoreA = a.availability === 'preferred' ? 3 : a.availability === 'available' ? 2 : 1;
    const scoreB = b.availability === 'preferred' ? 3 : b.availability === 'available' ? 2 : 1;
    return scoreB - scoreA;
  });
  
  return alternatives;
};