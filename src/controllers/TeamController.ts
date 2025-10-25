import { Request, Response } from 'express';
import { TeamManagementService, TeamAssignmentRequest, TeamUpdateRequest } from '../services/TeamManagementService';
import { logger } from '../utils/logger';

export class TeamController {
  private teamManagementService: TeamManagementService;

  constructor() {
    this.teamManagementService = new TeamManagementService();
  }

  /**
   * Create a new team assignment
   * POST /api/teams
   */
  public createTeam = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        clientId,
        rbtIds,
        primaryRbtId,
        effectiveDate,
        requiredQualifications
      } = req.body;

      // Get user ID from authenticated request
      const createdBy = (req as any).user?.id;
      if (!createdBy) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const request: TeamAssignmentRequest = {
        clientId,
        rbtIds,
        primaryRbtId,
        effectiveDate: new Date(effectiveDate),
        requiredQualifications,
        createdBy
      };

      const result = await this.teamManagementService.assignTeam(request);

      logger.info('Team created successfully', { 
        teamId: result.team.id, 
        clientId,
        createdBy 
      });

      res.status(201).json({
        success: true,
        data: result.team,
        qualificationChecks: result.qualificationChecks,
        warnings: result.warnings
      });
    } catch (error) {
      logger.error('Error creating team', { error: error.message, body: req.body });
      res.status(400).json({ 
        success: false, 
        error: error.message 
      });
    }
  };

  /**
   * Update an existing team
   * PUT /api/teams/:teamId
   */
  public updateTeam = async (req: Request, res: Response): Promise<void> => {
    try {
      const { teamId } = req.params;
      const {
        rbtIds,
        primaryRbtId,
        endDate,
        isActive,
        reason
      } = req.body;

      // Get user ID from authenticated request
      const updatedBy = (req as any).user?.id;
      if (!updatedBy) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const request: TeamUpdateRequest = {
        teamId,
        rbtIds,
        primaryRbtId,
        endDate: endDate ? new Date(endDate) : undefined,
        isActive,
        updatedBy,
        reason
      };

      const result = await this.teamManagementService.updateTeam(request);

      logger.info('Team updated successfully', { 
        teamId, 
        updatedBy 
      });

      res.json({
        success: true,
        data: result.team,
        qualificationChecks: result.qualificationChecks,
        warnings: result.warnings
      });
    } catch (error) {
      logger.error('Error updating team', { error: error.message, teamId: req.params.teamId });
      res.status(400).json({ 
        success: false, 
        error: error.message 
      });
    }
  };

  /**
   * Get team details with member information
   * GET /api/teams/:teamId
   */
  public getTeam = async (req: Request, res: Response): Promise<void> => {
    try {
      const { teamId } = req.params;

      const teamDetails = await this.teamManagementService.getTeamDetails(teamId);

      res.json({
        success: true,
        data: teamDetails
      });
    } catch (error) {
      logger.error('Error fetching team details', { error: error.message, teamId: req.params.teamId });
      
      if (error.message === 'Team not found') {
        res.status(404).json({ 
          success: false, 
          error: 'Team not found' 
        });
      } else {
        res.status(500).json({ 
          success: false, 
          error: 'Internal server error' 
        });
      }
    }
  };

  /**
   * Add RBT to team
   * POST /api/teams/:teamId/rbts
   */
  public addRBTToTeam = async (req: Request, res: Response): Promise<void> => {
    try {
      const { teamId } = req.params;
      const { rbtId, requiredQualifications } = req.body;

      // Get user ID from authenticated request
      const updatedBy = (req as any).user?.id;
      if (!updatedBy) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const result = await this.teamManagementService.addRBTToTeam(
        teamId,
        rbtId,
        updatedBy,
        requiredQualifications || []
      );

      logger.info('RBT added to team successfully', { 
        teamId, 
        rbtId, 
        updatedBy 
      });

      res.json({
        success: true,
        data: result.team,
        qualificationChecks: result.qualificationChecks,
        warnings: result.warnings
      });
    } catch (error) {
      logger.error('Error adding RBT to team', { 
        error: error.message, 
        teamId: req.params.teamId,
        rbtId: req.body.rbtId 
      });
      res.status(400).json({ 
        success: false, 
        error: error.message 
      });
    }
  };

  /**
   * Remove RBT from team
   * DELETE /api/teams/:teamId/rbts/:rbtId
   */
  public removeRBTFromTeam = async (req: Request, res: Response): Promise<void> => {
    try {
      const { teamId, rbtId } = req.params;
      const { reason } = req.body;

      // Get user ID from authenticated request
      const updatedBy = (req as any).user?.id;
      if (!updatedBy) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const updatedTeam = await this.teamManagementService.removeRBTFromTeam(
        teamId,
        rbtId,
        updatedBy,
        reason
      );

      logger.info('RBT removed from team successfully', { 
        teamId, 
        rbtId, 
        updatedBy 
      });

      res.json({
        success: true,
        data: updatedTeam
      });
    } catch (error) {
      logger.error('Error removing RBT from team', { 
        error: error.message, 
        teamId: req.params.teamId,
        rbtId: req.params.rbtId 
      });
      res.status(400).json({ 
        success: false, 
        error: error.message 
      });
    }
  };

  /**
   * Change primary RBT for team
   * PUT /api/teams/:teamId/primary-rbt
   */
  public changePrimaryRBT = async (req: Request, res: Response): Promise<void> => {
    try {
      const { teamId } = req.params;
      const { newPrimaryRbtId, reason } = req.body;

      // Get user ID from authenticated request
      const updatedBy = (req as any).user?.id;
      if (!updatedBy) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const updatedTeam = await this.teamManagementService.changePrimaryRBT(
        teamId,
        newPrimaryRbtId,
        updatedBy,
        reason
      );

      logger.info('Primary RBT changed successfully', { 
        teamId, 
        newPrimaryRbtId, 
        updatedBy 
      });

      res.json({
        success: true,
        data: updatedTeam
      });
    } catch (error) {
      logger.error('Error changing primary RBT', { 
        error: error.message, 
        teamId: req.params.teamId,
        newPrimaryRbtId: req.body.newPrimaryRbtId 
      });
      res.status(400).json({ 
        success: false, 
        error: error.message 
      });
    }
  };

  /**
   * End team assignment
   * PUT /api/teams/:teamId/end
   */
  public endTeam = async (req: Request, res: Response): Promise<void> => {
    try {
      const { teamId } = req.params;
      const { endDate, reason } = req.body;

      // Get user ID from authenticated request
      const updatedBy = (req as any).user?.id;
      if (!updatedBy) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const updatedTeam = await this.teamManagementService.endTeam(
        teamId,
        new Date(endDate),
        updatedBy,
        reason
      );

      logger.info('Team ended successfully', { 
        teamId, 
        endDate, 
        updatedBy 
      });

      res.json({
        success: true,
        data: updatedTeam
      });
    } catch (error) {
      logger.error('Error ending team', { 
        error: error.message, 
        teamId: req.params.teamId 
      });
      res.status(400).json({ 
        success: false, 
        error: error.message 
      });
    }
  };

  /**
   * Get team history for a client
   * GET /api/teams/client/:clientId/history
   */
  public getClientTeamHistory = async (req: Request, res: Response): Promise<void> => {
    try {
      const { clientId } = req.params;

      const history = await this.teamManagementService.getClientTeamHistory(clientId);

      res.json({
        success: true,
        data: history
      });
    } catch (error) {
      logger.error('Error fetching client team history', { 
        error: error.message, 
        clientId: req.params.clientId 
      });
      res.status(500).json({ 
        success: false, 
        error: 'Internal server error' 
      });
    }
  };

  /**
   * Get available RBTs for team assignment
   * GET /api/teams/available-rbts
   */
  public getAvailableRBTs = async (req: Request, res: Response): Promise<void> => {
    try {
      const { 
        requiredQualifications, 
        excludeRbtIds 
      } = req.query;

      const qualifications = requiredQualifications 
        ? (requiredQualifications as string).split(',') 
        : [];
      
      const excludeIds = excludeRbtIds 
        ? (excludeRbtIds as string).split(',') 
        : [];

      const availableRBTs = await this.teamManagementService.findAvailableRBTs(
        qualifications,
        excludeIds
      );

      res.json({
        success: true,
        data: availableRBTs
      });
    } catch (error) {
      logger.error('Error fetching available RBTs', { error: error.message });
      res.status(500).json({ 
        success: false, 
        error: 'Internal server error' 
      });
    }
  };

  /**
   * Get teams that need additional RBTs
   * GET /api/teams/needing-rbts
   */
  public getTeamsNeedingRBTs = async (req: Request, res: Response): Promise<void> => {
    try {
      const { minRbtCount } = req.query;
      const minCount = minRbtCount ? parseInt(minRbtCount as string) : 2;

      const teams = await this.teamManagementService.getTeamsNeedingRBTs(minCount);

      res.json({
        success: true,
        data: teams
      });
    } catch (error) {
      logger.error('Error fetching teams needing RBTs', { error: error.message });
      res.status(500).json({ 
        success: false, 
        error: 'Internal server error' 
      });
    }
  };

  /**
   * Get teams for a specific RBT
   * GET /api/teams/rbt/:rbtId
   */
  public getRBTTeams = async (req: Request, res: Response): Promise<void> => {
    try {
      const { rbtId } = req.params;

      const teams = await this.teamManagementService.getRBTTeams(rbtId);

      res.json({
        success: true,
        data: teams
      });
    } catch (error) {
      logger.error('Error fetching RBT teams', { 
        error: error.message, 
        rbtId: req.params.rbtId 
      });
      res.status(500).json({ 
        success: false, 
        error: 'Internal server error' 
      });
    }
  };

  /**
   * Get teams by primary RBT
   * GET /api/teams/primary-rbt/:rbtId
   */
  public getTeamsByPrimaryRBT = async (req: Request, res: Response): Promise<void> => {
    try {
      const { rbtId } = req.params;

      const teams = await this.teamManagementService.getTeamsByPrimaryRBT(rbtId);

      res.json({
        success: true,
        data: teams
      });
    } catch (error) {
      logger.error('Error fetching teams by primary RBT', { 
        error: error.message, 
        rbtId: req.params.rbtId 
      });
      res.status(500).json({ 
        success: false, 
        error: 'Internal server error' 
      });
    }
  };
}