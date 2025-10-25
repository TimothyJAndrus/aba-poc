import { ContinuityPreferenceService } from '../ContinuityPreferenceService';
import { Session } from '../../models/Session';
import { Team } from '../../models/Team';

describe('ContinuityPreferenceService', () => {
  let service: ContinuityPreferenceService;
  let mockSessions: Session[];

  beforeEach(() => {
    service = new ContinuityPreferenceService();
    
    // Create mock session history
    mockSessions = [
      {
        id: 'session-1',
        clientId: 'client-123',
        rbtId: 'rbt-1',
        startTime: new Date('2024-10-01T10:00:00'),
        endTime: new Date('2024-10-01T13:00:00'),
        status: 'completed',
        location: 'Room A',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-123'
      },
      {
        id: 'session-2',
        clientId: 'client-123',
        rbtId: 'rbt-1',
        startTime: new Date('2024-10-08T10:00:00'),
        endTime: new Date('2024-10-08T13:00:00'),
        status: 'completed',
        location: 'Room A',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-123'
      },
      {
        id: 'session-3',
        clientId: 'client-123',
        rbtId: 'rbt-2',
        startTime: new Date('2024-10-15T10:00:00'),
        endTime: new Date('2024-10-15T13:00:00'),
        status: 'completed',
        location: 'Room B',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-123'
      },
      {
        id: 'session-4',
        clientId: 'client-123',
        rbtId: 'rbt-1',
        startTime: new Date('2024-10-22T10:00:00'),
        endTime: new Date('2024-10-22T13:00:00'),
        status: 'completed',
        location: 'Room A',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-123'
      }
    ];
  });

  describe('calculateContinuityScore', () => {
    it('should calculate score for RBT with session history', () => {
      const score = service.calculateContinuityScore('rbt-1', 'client-123', mockSessions);

      expect(score.rbtId).toBe('rbt-1');
      expect(score.clientId).toBe('client-123');
      expect(score.totalSessions).toBe(3); // RBT-1 has 3 sessions
      expect(score.score).toBeGreaterThan(0);
      expect(score.lastSessionDate).toEqual(new Date('2024-10-22T10:00:00'));
    });

    it('should return zero score for RBT with no history', () => {
      const score = service.calculateContinuityScore('rbt-999', 'client-123', mockSessions);

      expect(score.rbtId).toBe('rbt-999');
      expect(score.clientId).toBe('client-123');
      expect(score.totalSessions).toBe(0);
      expect(score.recentSessions).toBe(0);
      expect(score.score).toBe(0);
      expect(score.lastSessionDate).toBeUndefined();
    });

    it('should give higher scores for more recent sessions', () => {
      // Add a very recent session for RBT-2
      const recentSessions = [...mockSessions, {
        id: 'session-recent',
        clientId: 'client-123',
        rbtId: 'rbt-2',
        startTime: new Date(), // Today
        endTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
        status: 'completed',
        location: 'Room B',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-123'
      } as Session];

      const rbt1Score = service.calculateContinuityScore('rbt-1', 'client-123', mockSessions);
      const rbt2Score = service.calculateContinuityScore('rbt-2', 'client-123', recentSessions);

      // RBT-2 should have higher score due to more recent session
      expect(rbt2Score.score).toBeGreaterThan(rbt1Score.score);
    });

    it('should count recent sessions correctly', () => {
      // Add recent sessions (within 30 days)
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 15); // 15 days ago

      const sessionsWithRecent = [...mockSessions, {
        id: 'session-recent',
        clientId: 'client-123',
        rbtId: 'rbt-1',
        startTime: recentDate,
        endTime: new Date(recentDate.getTime() + 3 * 60 * 60 * 1000),
        status: 'completed',
        location: 'Room A',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-123'
      } as Session];

      const score = service.calculateContinuityScore('rbt-1', 'client-123', sessionsWithRecent);

      expect(score.recentSessions).toBeGreaterThan(0);
    });

    it('should give consistency bonus for regular sessions', () => {
      // Create sessions with consistent weekly pattern
      const consistentSessions: Session[] = [];
      for (let i = 0; i < 8; i++) {
        const sessionDate = new Date('2024-09-01T10:00:00');
        sessionDate.setDate(sessionDate.getDate() + (i * 7)); // Weekly sessions

        consistentSessions.push({
          id: `session-${i}`,
          clientId: 'client-123',
          rbtId: 'rbt-consistent',
          startTime: sessionDate,
          endTime: new Date(sessionDate.getTime() + 3 * 60 * 60 * 1000),
          status: 'completed',
          location: 'Room A',
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'user-123'
        });
      }

      const consistentScore = service.calculateContinuityScore('rbt-consistent', 'client-123', consistentSessions);
      const inconsistentScore = service.calculateContinuityScore('rbt-1', 'client-123', mockSessions);

      // Consistent RBT should have higher score
      expect(consistentScore.score).toBeGreaterThan(inconsistentScore.score);
    });
  });

  describe('selectOptimalRBT', () => {
    it('should select RBT with highest continuity score', () => {
      const availableRBTs = ['rbt-1', 'rbt-2'];
      
      const result = service.selectOptimalRBT(availableRBTs, 'client-123', mockSessions);

      expect(result.selectedRBTId).toBe('rbt-1'); // RBT-1 has more sessions
      expect(result.continuityScore).toBeGreaterThan(0);
      expect(result.selectionReason).toContain('Previous experience');
      expect(result.alternativeRBTs).toHaveLength(1);
      expect(result.alternativeRBTs[0]?.rbtId).toBe('rbt-2');
    });

    it('should prioritize primary RBT', () => {
      const availableRBTs = ['rbt-1', 'rbt-2'];
      const team: Team = {
        id: 'team-123',
        clientId: 'client-123',
        rbtIds: ['rbt-1', 'rbt-2'],
        primaryRbtId: 'rbt-2', // RBT-2 is primary
        effectiveDate: new Date(),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-123'
      };

      const result = service.selectOptimalRBT(availableRBTs, 'client-123', mockSessions, team);

      expect(result.selectedRBTId).toBe('rbt-2'); // Primary RBT should be selected
      expect(result.selectionReason).toBe('Primary RBT for this client');
    });

    it('should handle single available RBT', () => {
      const availableRBTs = ['rbt-1'];
      
      const result = service.selectOptimalRBT(availableRBTs, 'client-123', mockSessions);

      expect(result.selectedRBTId).toBe('rbt-1');
      expect(result.selectionReason).toBe('Only available RBT');
      expect(result.alternativeRBTs).toHaveLength(0);
    });

    it('should throw error for empty RBT list', () => {
      expect(() => {
        service.selectOptimalRBT([], 'client-123', mockSessions);
      }).toThrow('No available RBTs provided');
    });

    it('should handle new RBT with no history', () => {
      const availableRBTs = ['rbt-999']; // New RBT with no history
      
      const result = service.selectOptimalRBT(availableRBTs, 'client-123', mockSessions);

      expect(result.selectedRBTId).toBe('rbt-999');
      expect(result.continuityScore).toBe(0);
      expect(result.selectionReason).toBe('Only available RBT');
    });
  });

  describe('buildRBTClientHistory', () => {
    it('should build comprehensive history for RBT-client pair', () => {
      const history = service.buildRBTClientHistory('rbt-1', 'client-123', mockSessions);

      expect(history.rbtId).toBe('rbt-1');
      expect(history.clientId).toBe('client-123');
      expect(history.sessionCount).toBe(3);
      expect(history.firstSessionDate).toEqual(new Date('2024-10-01T10:00:00'));
      expect(history.lastSessionDate).toEqual(new Date('2024-10-22T10:00:00'));
      expect(history.weeklyFrequency).toBeGreaterThan(0);
    });

    it('should return empty history for RBT with no sessions', () => {
      const history = service.buildRBTClientHistory('rbt-999', 'client-123', mockSessions);

      expect(history.rbtId).toBe('rbt-999');
      expect(history.clientId).toBe('client-123');
      expect(history.sessionCount).toBe(0);
      expect(history.recentSessionCount).toBe(0);
      expect(history.weeklyFrequency).toBe(0);
      expect(history.continuityStreak).toBe(0);
    });

    it('should calculate weekly frequency correctly', () => {
      // Create 4 sessions over 4 weeks (1 per week)
      const weeklySessions: Session[] = [];
      for (let i = 0; i < 4; i++) {
        const sessionDate = new Date('2024-10-01T10:00:00');
        sessionDate.setDate(sessionDate.getDate() + (i * 7));

        weeklySessions.push({
          id: `session-${i}`,
          clientId: 'client-123',
          rbtId: 'rbt-weekly',
          startTime: sessionDate,
          endTime: new Date(sessionDate.getTime() + 3 * 60 * 60 * 1000),
          status: 'completed',
          location: 'Room A',
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'user-123'
        });
      }

      const history = service.buildRBTClientHistory('rbt-weekly', 'client-123', weeklySessions);

      expect(history.weeklyFrequency).toBeCloseTo(1.33, 1); // Approximately 1.33 sessions per week (4 sessions over 3 weeks)
    });
  });

  describe('generateContinuityMetrics', () => {
    it('should generate comprehensive metrics for client', () => {
      const teamMembers = ['rbt-1', 'rbt-2'];
      
      const metrics = service.generateContinuityMetrics('client-123', mockSessions, teamMembers);

      expect(metrics.clientId).toBe('client-123');
      expect(metrics.totalSessions).toBe(4);
      expect(metrics.uniqueRBTs).toBe(2);
      expect(metrics.primaryRBTId).toBe('rbt-1'); // RBT-1 has more sessions
      expect(metrics.primaryRBTPercentage).toBeGreaterThan(50);
      expect(metrics.averageContinuityScore).toBeGreaterThan(0);
      expect(['improving', 'stable', 'declining']).toContain(metrics.continuityTrend);
    });

    it('should return empty metrics for client with no sessions', () => {
      const teamMembers = ['rbt-1', 'rbt-2'];
      
      const metrics = service.generateContinuityMetrics('client-999', mockSessions, teamMembers);

      expect(metrics.clientId).toBe('client-999');
      expect(metrics.totalSessions).toBe(0);
      expect(metrics.uniqueRBTs).toBe(0);
      expect(metrics.primaryRBTPercentage).toBe(0);
      expect(metrics.averageContinuityScore).toBe(0);
      expect(metrics.continuityTrend).toBe('stable');
    });

    it('should detect improving continuity trend', () => {
      // Create sessions showing improvement (fewer RBTs in recent sessions)
      const improvingSessions: Session[] = [
        // Early sessions with multiple RBTs
        ...Array.from({ length: 3 }, (_, i) => ({
          id: `early-${i}`,
          clientId: 'client-trend',
          rbtId: `rbt-${i % 3}`, // Rotating between 3 RBTs
          startTime: new Date(`2024-09-${i + 1}T10:00:00`),
          endTime: new Date(`2024-09-${i + 1}T13:00:00`),
          status: 'completed',
          location: 'Room A',
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'user-123'
        } as Session)),
        // Recent sessions with consistent RBT
        ...Array.from({ length: 6 }, (_, i) => ({
          id: `recent-${i}`,
          clientId: 'client-trend',
          rbtId: 'rbt-1', // Consistent RBT
          startTime: new Date(`2024-10-${i + 1}T10:00:00`),
          endTime: new Date(`2024-10-${i + 1}T13:00:00`),
          status: 'completed',
          location: 'Room A',
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'user-123'
        } as Session))
      ];

      const teamMembers = ['rbt-1', 'rbt-2', 'rbt-3'];
      const metrics = service.generateContinuityMetrics('client-trend', improvingSessions, teamMembers);

      expect(metrics.continuityTrend).toBe('improving');
    });
  });

  describe('trackPairingHistory', () => {
    it('should track history for all RBTs who worked with client', () => {
      const pairingHistory = service.trackPairingHistory('client-123', mockSessions);

      expect(pairingHistory.size).toBe(2); // RBT-1 and RBT-2
      expect(pairingHistory.has('rbt-1')).toBe(true);
      expect(pairingHistory.has('rbt-2')).toBe(true);

      const rbt1History = pairingHistory.get('rbt-1')!;
      expect(rbt1History.sessionCount).toBe(3);
      expect(rbt1History.rbtId).toBe('rbt-1');
      expect(rbt1History.clientId).toBe('client-123');

      const rbt2History = pairingHistory.get('rbt-2')!;
      expect(rbt2History.sessionCount).toBe(1);
      expect(rbt2History.rbtId).toBe('rbt-2');
      expect(rbt2History.clientId).toBe('client-123');
    });

    it('should return empty map for client with no sessions', () => {
      const pairingHistory = service.trackPairingHistory('client-999', mockSessions);

      expect(pairingHistory.size).toBe(0);
    });

    it('should only include completed sessions', () => {
      const sessionsWithCancelled = [...mockSessions, {
        id: 'session-cancelled',
        clientId: 'client-123',
        rbtId: 'rbt-3',
        startTime: new Date('2024-10-25T10:00:00'),
        endTime: new Date('2024-10-25T13:00:00'),
        status: 'cancelled',
        location: 'Room C',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-123'
      } as Session];

      const pairingHistory = service.trackPairingHistory('client-123', sessionsWithCancelled);

      expect(pairingHistory.size).toBe(2); // Should not include RBT-3 (cancelled session)
      expect(pairingHistory.has('rbt-3')).toBe(false);
    });
  });
});