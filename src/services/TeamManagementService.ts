import { PoolClient } from 'pg';
import { TeamRepository } from '../database/repositories/TeamRepository';
import { RBTRepository } from '../database/repositories/RBTRepository';
import { ClientRepository } from '../database/repositories/ClientRepository';
import { ScheduleEventRepository } from '../database/repositories/ScheduleEventRepository';
import { Team, CreateTeamRequest, UpdateTeamRequest, TeamAssignment, TeamHistory } from '../models/Team';
import { RBT } from '../models/RBT';
import { Client } from '../models/Client';
import { logger } from '../utils/logger';

export interface TeamAssignmentRequest {
  clientId: string;
  rbtIds: string[];
  primaryRbtId: string;
  effectiveDate: Date;
  requiredQualifications?: string[];
  createdBy: string;
}

export interface TeamUpdateRequest {
  teamId: string;
  rbtIds?: string[];
  primaryRbtId?: string;
  endDate?: Date;
  isActive?: boolean;
  updatedBy: string;
  reason?: string;
}

export interface RBTQualificationCheck {
  rbtId: string;
  hasRequiredQualifications: boolean;
  missingQualifications: string[];
  isAvailable: boolean;
  isActive: boolean;
}

export interface TeamAssignmentResult {
  team: Team;
  qualificationChecks: RBTQualificationCheck[];
  warnings: string[];
}

export class TeamManagementService {
  private teamRepository: TeamRepository;
  private rbtRepository: RBTRepository;
  private clientRepository: ClientRepository;
  private scheduleEventRepository: ScheduleEventRepository;

  constructor() {
    this.teamRepository = new TeamRepository();
    this.rbtRepository = new RBTRepository();
    this.clientRepository = new ClientRepository();
    this.scheduleEventRepository = new ScheduleEventRepository();
  }

  /**
   * Assign RBTs to a client team with qualification validation
   */
  public async assignTeam(request: TeamAssignmentRequest): Promise<TeamAssignmentResult> {
    logger.info('Starting team assignment process', { 
      clientId: request.clientId, 
      rbtCount: request.rbtIds.length 
    });

    return this.teamRepository.transaction(async (client: PoolClient) => {
      // Validate client exists and is active
      const clientRecord = await this.clientRepository.findById(request.clientId, client);
      if (!clientRecord) {
        throw new Error('Client not found');
      }
      if (!clientRecord.isActive) {
        throw new Error('Cannot assign team to inactive client');
      }

      // Check if client already has an active team
      const existingTeam = await this.teamRepository.findActiveByClientId(request.clientId, client);
      if (existingTeam) {
        throw new Error('Client already has an active team. End current team before creating a new one.');
      }

      // Validate and check RBT qualifications
      const qualificationChecks = await this.validateRBTQualifications(
        request.rbtIds, 
        request.requiredQualifications || [],
        client
      );

      // Check for any critical validation failures
      const inactiveRBTs = qualificationChecks.filter(check => !check.isActive);
      if (inactiveRBTs.length > 0) {
        throw new Error(`Cannot assign inactive RBTs: ${inactiveRBTs.map(r => r.rbtId).join(', ')}`);
      }

      // Validate primary RBT
      const primaryRBTCheck = qualificationChecks.find(check => check.rbtId === request.primaryRbtId);
      if (!primaryRBTCheck) {
        throw new Error('Primary RBT must be included in the team member list');
      }

      // Create team assignment
      const createTeamRequest: CreateTeamRequest = {
        clientId: request.clientId,
        rbtIds: request.rbtIds,
        primaryRbtId: request.primaryRbtId,
        effectiveDate: request.effectiveDate,
        createdBy: request.createdBy
      };

      const team = await this.teamRepository.create(createTeamRequest, client);

      // Log team creation event
      await this.scheduleEventRepository.create({
        eventType: 'team_created',
        clientId: request.clientId,
        newValues: {
          teamId: team.id,
          rbtIds: request.rbtIds,
          primaryRbtId: request.primaryRbtId,
          effectiveDate: request.effectiveDate
        },
        reason: 'Team assignment created',
        createdBy: request.createdBy
      }, client);

      // Generate warnings for qualification issues
      const warnings: string[] = [];
      const missingQualifications = qualificationChecks.filter(check => !check.hasRequiredQualifications);
      if (missingQualifications.length > 0) {
        warnings.push(`Some RBTs are missing required qualifications: ${missingQualifications.map(r => r.rbtId).join(', ')}`);
      }

      logger.info('Team assignment completed successfully', { 
        teamId: team.id, 
        clientId: request.clientId,
        warningCount: warnings.length
      });

      return {
        team,
        qualificationChecks,
        warnings
      };
    });
  }

  /**
   * Update an existing team assignment
   */
  public async updateTeam(request: TeamUpdateRequest): Promise<TeamAssignmentResult> {
    logger.info('Starting team update process', { teamId: request.teamId });

    return this.teamRepository.transaction(async (client: PoolClient) => {
      // Get existing team
      const existingTeam = await this.teamRepository.findById(request.teamId, client);
      if (!existingTeam) {
        throw new Error('Team not found');
      }

      // Validate RBT qualifications if RBT list is being updated
      let qualificationChecks: RBTQualificationCheck[] = [];
      if (request.rbtIds) {
        // Get client to check for required qualifications
        const client_record = await this.clientRepository.findById(existingTeam.clientId, client);
        const requiredQualifications = client_record?.specialNeeds || [];
        
        qualificationChecks = await this.validateRBTQualifications(
          request.rbtIds,
          requiredQualifications,
          client
        );

        // Check for inactive RBTs
        const inactiveRBTs = qualificationChecks.filter(check => !check.isActive);
        if (inactiveRBTs.length > 0) {
          throw new Error(`Cannot assign inactive RBTs: ${inactiveRBTs.map(r => r.rbtId).join(', ')}`);
        }

        // Validate primary RBT if specified
        if (request.primaryRbtId && !request.rbtIds.includes(request.primaryRbtId)) {
          throw new Error('Primary RBT must be a member of the team');
        }
      }

      // Prepare update data
      const updateData: UpdateTeamRequest = {
        updatedBy: request.updatedBy
      };
      if (request.rbtIds !== undefined) updateData.rbtIds = request.rbtIds;
      if (request.primaryRbtId !== undefined) updateData.primaryRbtId = request.primaryRbtId;
      if (request.endDate !== undefined) updateData.endDate = request.endDate;
      if (request.isActive !== undefined) updateData.isActive = request.isActive;

      // Update team
      const updatedTeam = await this.teamRepository.update(request.teamId, updateData, client);
      if (!updatedTeam) {
        throw new Error('Failed to update team');
      }

      // Log team update event
      await this.scheduleEventRepository.create({
        eventType: 'team_updated',
        clientId: existingTeam.clientId,
        oldValues: {
          rbtIds: existingTeam.rbtIds,
          primaryRbtId: existingTeam.primaryRbtId,
          isActive: existingTeam.isActive
        },
        newValues: {
          rbtIds: updatedTeam.rbtIds,
          primaryRbtId: updatedTeam.primaryRbtId,
          isActive: updatedTeam.isActive
        },
        reason: request.reason || 'Team assignment updated',
        createdBy: request.updatedBy
      }, client);

      // Generate warnings
      const warnings: string[] = [];
      if (qualificationChecks.length > 0) {
        const missingQualifications = qualificationChecks.filter(check => !check.hasRequiredQualifications);
        if (missingQualifications.length > 0) {
          warnings.push(`Some RBTs are missing required qualifications: ${missingQualifications.map(r => r.rbtId).join(', ')}`);
        }
      }

      logger.info('Team update completed successfully', { 
        teamId: request.teamId,
        warningCount: warnings.length
      });

      return {
        team: updatedTeam,
        qualificationChecks,
        warnings
      };
    });
  }

  /**
   * Add RBT to existing team
   */
  public async addRBTToTeam(
    teamId: string, 
    rbtId: string, 
    updatedBy: string,
    requiredQualifications: string[] = []
  ): Promise<TeamAssignmentResult> {
    logger.info('Adding RBT to team', { teamId, rbtId });

    return this.teamRepository.transaction(async (client: PoolClient) => {
      // Get existing team
      const team = await this.teamRepository.findById(teamId, client);
      if (!team) {
        throw new Error('Team not found');
      }

      // Validate RBT qualifications
      const qualificationChecks = await this.validateRBTQualifications([rbtId], requiredQualifications, client);
      const rbtCheck = qualificationChecks[0];

      if (!rbtCheck || !rbtCheck.isActive) {
        throw new Error('Cannot add inactive RBT to team');
      }

      // Add RBT to team
      const updatedTeam = await this.teamRepository.addRbtToTeam(teamId, rbtId, updatedBy, client);
      if (!updatedTeam) {
        throw new Error('Failed to add RBT to team');
      }

      // Log event
      await this.scheduleEventRepository.create({
        eventType: 'rbt_added',
        clientId: team.clientId,
        oldValues: { rbtIds: team.rbtIds },
        newValues: { rbtIds: updatedTeam.rbtIds, addedRbtId: rbtId },
        reason: 'RBT added to team',
        createdBy: updatedBy
      }, client);

      const warnings: string[] = [];
      if (rbtCheck && !rbtCheck.hasRequiredQualifications) {
        warnings.push(`RBT ${rbtId} is missing required qualifications: ${rbtCheck.missingQualifications.join(', ')}`);
      }

      logger.info('RBT added to team successfully', { teamId, rbtId });

      return {
        team: updatedTeam,
        qualificationChecks,
        warnings
      };
    });
  }

  /**
   * Remove RBT from team
   */
  public async removeRBTFromTeam(teamId: string, rbtId: string, updatedBy: string, reason?: string): Promise<Team> {
    logger.info('Removing RBT from team', { teamId, rbtId });

    return this.teamRepository.transaction(async (client: PoolClient) => {
      // Get existing team
      const team = await this.teamRepository.findById(teamId, client);
      if (!team) {
        throw new Error('Team not found');
      }

      // Remove RBT from team
      const updatedTeam = await this.teamRepository.removeRbtFromTeam(teamId, rbtId, updatedBy, client);
      if (!updatedTeam) {
        throw new Error('Failed to remove RBT from team');
      }

      // Log event
      await this.scheduleEventRepository.create({
        eventType: 'rbt_removed',
        clientId: team.clientId,
        oldValues: { rbtIds: team.rbtIds },
        newValues: { rbtIds: updatedTeam.rbtIds, removedRbtId: rbtId },
        reason: reason || 'RBT removed from team',
        createdBy: updatedBy
      }, client);

      logger.info('RBT removed from team successfully', { teamId, rbtId });

      return updatedTeam;
    });
  }

  /**
   * Change primary RBT for a team
   */
  public async changePrimaryRBT(teamId: string, newPrimaryRbtId: string, updatedBy: string, reason?: string): Promise<Team> {
    logger.info('Changing primary RBT', { teamId, newPrimaryRbtId });

    return this.teamRepository.transaction(async (client: PoolClient) => {
      // Get existing team
      const team = await this.teamRepository.findById(teamId, client);
      if (!team) {
        throw new Error('Team not found');
      }

      const oldPrimaryRbtId = team.primaryRbtId;

      // Change primary RBT
      const updatedTeam = await this.teamRepository.changePrimaryRbt(teamId, newPrimaryRbtId, updatedBy, client);
      if (!updatedTeam) {
        throw new Error('Failed to change primary RBT');
      }

      // Log event
      await this.scheduleEventRepository.create({
        eventType: 'primary_changed',
        clientId: team.clientId,
        oldValues: { primaryRbtId: oldPrimaryRbtId },
        newValues: { primaryRbtId: newPrimaryRbtId },
        reason: reason || 'Primary RBT changed',
        createdBy: updatedBy
      }, client);

      logger.info('Primary RBT changed successfully', { teamId, oldPrimaryRbtId, newPrimaryRbtId });

      return updatedTeam;
    });
  }

  /**
   * End team assignment
   */
  public async endTeam(teamId: string, endDate: Date, updatedBy: string, reason?: string): Promise<Team> {
    logger.info('Ending team assignment', { teamId, endDate });

    return this.teamRepository.transaction(async (client: PoolClient) => {
      // Get existing team
      const team = await this.teamRepository.findById(teamId, client);
      if (!team) {
        throw new Error('Team not found');
      }

      // End team
      const updatedTeam = await this.teamRepository.endTeam(teamId, endDate, updatedBy, client);
      if (!updatedTeam) {
        throw new Error('Failed to end team');
      }

      // Log event
      await this.scheduleEventRepository.create({
        eventType: 'team_ended',
        clientId: team.clientId,
        oldValues: { isActive: true, endDate: null },
        newValues: { isActive: false, endDate },
        reason: reason || 'Team assignment ended',
        createdBy: updatedBy
      }, client);

      logger.info('Team assignment ended successfully', { teamId });

      return updatedTeam;
    });
  }

  /**
   * Get team with detailed member information
   */
  public async getTeamDetails(teamId: string): Promise<any> {
    const teamWithDetails = await this.teamRepository.findWithMemberDetails(teamId);
    if (!teamWithDetails) {
      throw new Error('Team not found');
    }

    // Get detailed RBT information for all team members
    const rbtDetails = await Promise.all(
      teamWithDetails.rbtIds.map(async (rbtId: string) => {
        const rbt = await this.rbtRepository.findById(rbtId);
        return rbt;
      })
    );

    return {
      ...teamWithDetails,
      rbtDetails: rbtDetails.filter(rbt => rbt !== null)
    };
  }

  /**
   * Get team history for a client
   */
  public async getClientTeamHistory(clientId: string): Promise<TeamHistory> {
    return this.teamRepository.getClientTeamHistory(clientId);
  }

  /**
   * Find available RBTs for team assignment
   */
  public async findAvailableRBTs(
    requiredQualifications: string[] = [],
    excludeRbtIds: string[] = []
  ): Promise<RBT[]> {
    // Get all active RBTs
    let availableRBTs = await this.rbtRepository.findActive();

    // Filter by qualifications if specified
    if (requiredQualifications.length > 0) {
      availableRBTs = availableRBTs.filter(rbt => 
        requiredQualifications.every(qual => rbt.qualifications.includes(qual))
      );
    }

    // Exclude specified RBTs
    if (excludeRbtIds.length > 0) {
      availableRBTs = availableRBTs.filter(rbt => !excludeRbtIds.includes(rbt.id));
    }

    return availableRBTs;
  }

  /**
   * Validate RBT qualifications and availability
   */
  private async validateRBTQualifications(
    rbtIds: string[], 
    requiredQualifications: string[],
    client?: PoolClient
  ): Promise<RBTQualificationCheck[]> {
    const checks: RBTQualificationCheck[] = [];

    for (const rbtId of rbtIds) {
      const rbt = await this.rbtRepository.findById(rbtId, client);
      
      if (!rbt) {
        checks.push({
          rbtId,
          hasRequiredQualifications: false,
          missingQualifications: requiredQualifications,
          isAvailable: false,
          isActive: false
        });
        continue;
      }

      const missingQualifications = requiredQualifications.filter(
        qual => !rbt.qualifications.includes(qual)
      );

      checks.push({
        rbtId,
        hasRequiredQualifications: missingQualifications.length === 0,
        missingQualifications,
        isAvailable: true, // TODO: Check actual availability based on schedule
        isActive: rbt.isActive && !rbt.terminationDate
      });
    }

    return checks;
  }

  /**
   * Get teams that need additional RBTs
   */
  public async getTeamsNeedingRBTs(minRbtCount: number = 2): Promise<Team[]> {
    return this.teamRepository.findTeamsNeedingRbts(minRbtCount);
  }

  /**
   * Get all teams for a specific RBT
   */
  public async getRBTTeams(rbtId: string): Promise<Team[]> {
    return this.teamRepository.findByRbtId(rbtId);
  }

  /**
   * Get teams by primary RBT
   */
  public async getTeamsByPrimaryRBT(primaryRbtId: string): Promise<Team[]> {
    return this.teamRepository.findByPrimaryRbtId(primaryRbtId);
  }
}