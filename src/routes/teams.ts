import { Router } from 'express';
import { TeamController } from '../controllers/TeamController';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const teamController = new TeamController();

// Apply authentication middleware to all team routes
router.use(authenticateToken);

// Team CRUD operations
router.post('/', teamController.createTeam);
router.get('/:teamId', teamController.getTeam);
router.put('/:teamId', teamController.updateTeam);

// Team member management
router.post('/:teamId/rbts', teamController.addRBTToTeam);
router.delete('/:teamId/rbts/:rbtId', teamController.removeRBTFromTeam);
router.put('/:teamId/primary-rbt', teamController.changePrimaryRBT);

// Team lifecycle management
router.put('/:teamId/end', teamController.endTeam);

// Team queries and reports
router.get('/client/:clientId/history', teamController.getClientTeamHistory);
router.get('/rbt/:rbtId', teamController.getRBTTeams);
router.get('/primary-rbt/:rbtId', teamController.getTeamsByPrimaryRBT);

// Utility endpoints
router.get('/available-rbts', teamController.getAvailableRBTs);
router.get('/needing-rbts', teamController.getTeamsNeedingRBTs);

export default router;