import { TeamManagementService, TeamAssignmentRequest, TeamUpdateRequest } from '../TeamManagementService';
import { Team } from '../../models/Team';
import { RBT } from '../../models/RBT';
import { Client } from '../../models/Client';

// Mock the repositories
jest.mock('../../database/repositories/TeamRepository');
jest.mock('../../database/repositories/RBTRepository');
jest.mock('../../database/repositories/ClientRepository');
jest.mock('../../database/repositories/ScheduleEventRepository');

describe('TeamManagementService', () => {
  let teamService: TeamManagementService;
  let mockTeamRepository: any;
  let mockRBTRepository: any;
  let mockClientRepository: any;
  let mockScheduleEventRepository: any;

  // Test data
  const mockClient: Client = {
    id: 'client-1',
    email: 'client@test.com',
    firstName: 'John',
    lastName: 'Doe',
    phone: '+1234567890',
    role: 'client_family',
    dateOfBirth: new Date('2015-01-01'),
    guardianContact: {
      email: 'guardian@test.com',
      phone: '+1234567890'
    },
    specialNeeds: ['autism', 'behavioral'],
    preferredSchedule: [],
    isActive: true,
    enrollmentDate: new Date('2023-01-01'),
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockRBT1: RBT = {
    id: 'rbt-1',
    email: 'rbt1@test.com',
    firstName: 'Jane',
    lastName: 'Smith',
    phone: '+1234567891',
    role: 'rbt',
    licenseNumber: 'RBT12345',
    qualifications: ['autism', 'behavioral', 'aba'],
    hourlyRate: 25.00,
    isActive: true,
    hireDate: new Date('2022-01-01'),
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockRBT2: RBT = {
    id: 'rbt-2',
    email: 'rbt2@test.com',
    firstName: 'Bob',
    lastName: 'Johnson',
    phone: '+1234567892',
    role: 'rbt',
    licenseNumber: 'RBT12346',
    qualifications: ['autism', 'aba'],
    hourlyRate: 23.00,
    isActive: true,
    hireDate: new Date('2022-06-01'),
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockTeam: Team = {
    id: 'team-1',
    clientId: 'client-1',
    rbtIds: ['rbt-1', 'rbt-2'],
    primaryRbtId: 'rbt-1',
    effectiveDate: new Date('2023-01-01'),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'admin-1'
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create service instance
    teamService = new TeamManagementService();

    // Get mock instances
    const { TeamRepository } = require('../../database/repositories/TeamRepository');
    const { RBTRepository } = require('../../database/repositories/RBTRepository');
    const { ClientRepository } = require('../../database/repositories/ClientRepository');
    const { ScheduleEventRepository } = require('../../database/repositories/ScheduleEventRepository');

    mockTeamRepository = TeamRepository.prototype;
    mockRBTRepository = RBTRepository.prototype;
    mockClientRepository = ClientRepository.prototype;
    mockScheduleEventRepository = ScheduleEventRepository.prototype;

    // Setup default mock implementations
    mockTeamRepository.transaction = jest.fn((callback) => callback({}));
    mockClientRepository.findById = jest.fn().mockResolvedValue(mockClient);
    mockRBTRepository.findById = jest.fn().mockImplementation((id: string) => {
      if (id === 'rbt-1') return Promise.resolve(mockRBT1);
      if (id === 'rbt-2') return Promise.resolve(mockRBT2);
      return Promise.resolve(null);
    });
    mockTeamRepository.findActiveByClientId = jest.fn().mockResolvedValue(null);
    mockTeamRepository.create = jest.fn().mockResolvedValue(mockTeam);
    mockScheduleEventRepository.create = jest.fn().mockResolvedValue({});
  });

  describe('assignTeam', () => {
    const validRequest: TeamAssignmentRequest = {
      clientId: 'client-1',
      rbtIds: ['rbt-1', 'rbt-2'],
      primaryRbtId: 'rbt-1',
      effectiveDate: new Date('2023-01-01'),
      requiredQualifications: ['autism', 'aba'],
      createdBy: 'admin-1'
    };

    it('should successfully assign team with valid data', async () => {
      const result = await teamService.assignTeam(validRequest);

      expect(result.team).toEqual(mockTeam);
      expect(result.qualificationChecks).toHaveLength(2);
      expect(result.qualificationChecks[0]?.hasRequiredQualifications).toBe(true);
      expect(result.qualificationChecks[1]?.hasRequiredQualifications).toBe(true);
      expect(result.warnings).toHaveLength(0);

      expect(mockClientRepository.findById).toHaveBeenCalledWith('client-1', {});
      expect(mockTeamRepository.findActiveByClientId).toHaveBeenCalledWith('client-1', {});
      expect(mockTeamRepository.create).toHaveBeenCalled();
      expect(mockScheduleEventRepository.create).toHaveBeenCalled();
    });

    it('should throw error if client not found', async () => {
      mockClientRepository.findById.mockResolvedValue(null);

      await expect(teamService.assignTeam(validRequest)).rejects.toThrow('Client not found');
    });

    it('should throw error if client is inactive', async () => {
      mockClientRepository.findById.mockResolvedValue({ ...mockClient, isActive: false });

      await expect(teamService.assignTeam(validRequest)).rejects.toThrow('Cannot assign team to inactive client');
    });

    it('should throw error if client already has active team', async () => {
      mockTeamRepository.findActiveByClientId.mockResolvedValue(mockTeam);

      await expect(teamService.assignTeam(validRequest)).rejects.toThrow('Client already has an active team');
    });

    it('should throw error if primary RBT not in team', async () => {
      const invalidRequest = { ...validRequest, primaryRbtId: 'rbt-3' };

      await expect(teamService.assignTeam(invalidRequest)).rejects.toThrow('Primary RBT must be included in the team member list');
    });

    it('should throw error if RBT is inactive', async () => {
      mockRBTRepository.findById.mockImplementation((id: string) => {
        if (id === 'rbt-1') return Promise.resolve({ ...mockRBT1, isActive: false });
        if (id === 'rbt-2') return Promise.resolve(mockRBT2);
        return Promise.resolve(null);
      });

      await expect(teamService.assignTeam(validRequest)).rejects.toThrow('Cannot assign inactive RBTs: rbt-1');
    });

    it('should generate warnings for missing qualifications', async () => {
      mockRBTRepository.findById.mockImplementation((id: string) => {
        if (id === 'rbt-1') return Promise.resolve(mockRBT1);
        if (id === 'rbt-2') return Promise.resolve({ ...mockRBT2, qualifications: ['autism'] }); // Missing 'aba'
        return Promise.resolve(null);
      });

      const result = await teamService.assignTeam(validRequest);

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('missing required qualifications');
      expect(result.qualificationChecks[1]?.hasRequiredQualifications).toBe(false);
      expect(result.qualificationChecks[1]?.missingQualifications).toContain('aba');
    });
  });

  describe('updateTeam', () => {
    const validUpdateRequest: TeamUpdateRequest = {
      teamId: 'team-1',
      rbtIds: ['rbt-1', 'rbt-2'],
      primaryRbtId: 'rbt-1',
      updatedBy: 'admin-1'
    };

    beforeEach(() => {
      mockTeamRepository.findById = jest.fn().mockResolvedValue(mockTeam);
      mockTeamRepository.update = jest.fn().mockResolvedValue({ ...mockTeam, updatedAt: new Date() });
    });

    it('should successfully update team', async () => {
      const result = await teamService.updateTeam(validUpdateRequest);

      expect(result.team).toBeDefined();
      expect(mockTeamRepository.findById).toHaveBeenCalledWith('team-1', {});
      expect(mockTeamRepository.update).toHaveBeenCalled();
      expect(mockScheduleEventRepository.create).toHaveBeenCalled();
    });

    it('should throw error if team not found', async () => {
      mockTeamRepository.findById.mockResolvedValue(null);

      await expect(teamService.updateTeam(validUpdateRequest)).rejects.toThrow('Team not found');
    });

    it('should validate primary RBT is in team when updating RBTs', async () => {
      const invalidRequest = { 
        ...validUpdateRequest, 
        rbtIds: ['rbt-2'], 
        primaryRbtId: 'rbt-1' 
      };

      await expect(teamService.updateTeam(invalidRequest)).rejects.toThrow('Primary RBT must be a member of the team');
    });
  });

  describe('addRBTToTeam', () => {
    beforeEach(() => {
      mockTeamRepository.findById = jest.fn().mockResolvedValue(mockTeam);
      mockTeamRepository.addRbtToTeam = jest.fn().mockResolvedValue({
        ...mockTeam,
        rbtIds: [...mockTeam.rbtIds, 'rbt-3']
      });
    });

    it('should successfully add RBT to team', async () => {
      mockRBTRepository.findById.mockImplementation((id: string) => {
        if (id === 'rbt-3') return Promise.resolve({ ...mockRBT1, id: 'rbt-3' });
        return Promise.resolve(null);
      });

      const result = await teamService.addRBTToTeam('team-1', 'rbt-3', 'admin-1', ['autism']);

      expect(result.team.rbtIds).toContain('rbt-3');
      expect(mockTeamRepository.addRbtToTeam).toHaveBeenCalledWith('team-1', 'rbt-3', 'admin-1', {});
      expect(mockScheduleEventRepository.create).toHaveBeenCalled();
    });

    it('should throw error if team not found', async () => {
      mockTeamRepository.findById.mockResolvedValue(null);

      await expect(teamService.addRBTToTeam('team-1', 'rbt-3', 'admin-1')).rejects.toThrow('Team not found');
    });

    it('should throw error if RBT is inactive', async () => {
      mockRBTRepository.findById.mockResolvedValue({ ...mockRBT1, id: 'rbt-3', isActive: false });

      await expect(teamService.addRBTToTeam('team-1', 'rbt-3', 'admin-1')).rejects.toThrow('Cannot add inactive RBT to team');
    });
  });

  describe('removeRBTFromTeam', () => {
    beforeEach(() => {
      mockTeamRepository.findById = jest.fn().mockResolvedValue(mockTeam);
      mockTeamRepository.removeRbtFromTeam = jest.fn().mockResolvedValue({
        ...mockTeam,
        rbtIds: ['rbt-1'] // rbt-2 removed
      });
    });

    it('should successfully remove RBT from team', async () => {
      const result = await teamService.removeRBTFromTeam('team-1', 'rbt-2', 'admin-1', 'No longer needed');

      expect(result.rbtIds).not.toContain('rbt-2');
      expect(mockTeamRepository.removeRbtFromTeam).toHaveBeenCalledWith('team-1', 'rbt-2', 'admin-1', {});
      expect(mockScheduleEventRepository.create).toHaveBeenCalled();
    });

    it('should throw error if team not found', async () => {
      mockTeamRepository.findById.mockResolvedValue(null);

      await expect(teamService.removeRBTFromTeam('team-1', 'rbt-2', 'admin-1')).rejects.toThrow('Team not found');
    });
  });

  describe('changePrimaryRBT', () => {
    beforeEach(() => {
      mockTeamRepository.findById = jest.fn().mockResolvedValue(mockTeam);
      mockTeamRepository.changePrimaryRbt = jest.fn().mockResolvedValue({
        ...mockTeam,
        primaryRbtId: 'rbt-2'
      });
    });

    it('should successfully change primary RBT', async () => {
      const result = await teamService.changePrimaryRBT('team-1', 'rbt-2', 'admin-1', 'Better fit');

      expect(result.primaryRbtId).toBe('rbt-2');
      expect(mockTeamRepository.changePrimaryRbt).toHaveBeenCalledWith('team-1', 'rbt-2', 'admin-1', {});
      expect(mockScheduleEventRepository.create).toHaveBeenCalled();
    });

    it('should throw error if team not found', async () => {
      mockTeamRepository.findById.mockResolvedValue(null);

      await expect(teamService.changePrimaryRBT('team-1', 'rbt-2', 'admin-1')).rejects.toThrow('Team not found');
    });
  });

  describe('endTeam', () => {
    beforeEach(() => {
      mockTeamRepository.findById = jest.fn().mockResolvedValue(mockTeam);
      mockTeamRepository.endTeam = jest.fn().mockResolvedValue({
        ...mockTeam,
        isActive: false,
        endDate: new Date('2023-12-31')
      });
    });

    it('should successfully end team', async () => {
      const endDate = new Date('2023-12-31');
      const result = await teamService.endTeam('team-1', endDate, 'admin-1', 'Client discharged');

      expect(result.isActive).toBe(false);
      expect(result.endDate).toEqual(endDate);
      expect(mockTeamRepository.endTeam).toHaveBeenCalledWith('team-1', endDate, 'admin-1', {});
      expect(mockScheduleEventRepository.create).toHaveBeenCalled();
    });

    it('should throw error if team not found', async () => {
      mockTeamRepository.findById.mockResolvedValue(null);

      await expect(teamService.endTeam('team-1', new Date(), 'admin-1')).rejects.toThrow('Team not found');
    });
  });

  describe('findAvailableRBTs', () => {
    beforeEach(() => {
      mockRBTRepository.findActive = jest.fn().mockResolvedValue([mockRBT1, mockRBT2]);
    });

    it('should return all active RBTs when no filters applied', async () => {
      const result = await teamService.findAvailableRBTs();

      expect(result).toHaveLength(2);
      expect(result).toContain(mockRBT1);
      expect(result).toContain(mockRBT2);
    });

    it('should filter RBTs by required qualifications', async () => {
      const result = await teamService.findAvailableRBTs(['behavioral']);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockRBT1); // Only RBT1 has 'behavioral' qualification
    });

    it('should exclude specified RBT IDs', async () => {
      const result = await teamService.findAvailableRBTs([], ['rbt-1']);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockRBT2);
    });

    it('should apply both qualification and exclusion filters', async () => {
      const result = await teamService.findAvailableRBTs(['autism'], ['rbt-2']);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockRBT1);
    });
  });

  describe('getTeamDetails', () => {
    beforeEach(() => {
      mockTeamRepository.findWithMemberDetails = jest.fn().mockResolvedValue({
        ...mockTeam,
        client: { id: 'client-1', firstName: 'John', lastName: 'Doe' },
        primaryRbt: { id: 'rbt-1', firstName: 'Jane', lastName: 'Smith' }
      });
    });

    it('should return team details with member information', async () => {
      const result = await teamService.getTeamDetails('team-1');

      expect(result).toBeDefined();
      expect(result.client).toBeDefined();
      expect(result.primaryRbt).toBeDefined();
      expect(mockTeamRepository.findWithMemberDetails).toHaveBeenCalledWith('team-1');
    });

    it('should throw error if team not found', async () => {
      mockTeamRepository.findWithMemberDetails.mockResolvedValue(null);

      await expect(teamService.getTeamDetails('team-1')).rejects.toThrow('Team not found');
    });
  });

  describe('validation methods', () => {
    it('should validate RBT qualifications correctly', async () => {
      // This tests the private method indirectly through assignTeam
      const request: TeamAssignmentRequest = {
        clientId: 'client-1',
        rbtIds: ['rbt-1', 'rbt-2'],
        primaryRbtId: 'rbt-1',
        effectiveDate: new Date('2023-01-01'),
        requiredQualifications: ['autism', 'behavioral', 'advanced'],
        createdBy: 'admin-1'
      };

      const result = await teamService.assignTeam(request);

      expect(result.qualificationChecks).toHaveLength(2);
      expect(result.qualificationChecks[0]?.hasRequiredQualifications).toBe(false); // RBT1 missing 'advanced'
      expect(result.qualificationChecks[1]?.hasRequiredQualifications).toBe(false); // RBT2 missing 'behavioral' and 'advanced'
      expect(result.warnings).toHaveLength(1);
    });
  });
});