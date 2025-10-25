import { Router } from 'express';
import { UserController } from '../controllers/UserController';
import { authMiddleware } from '../middleware/auth';

const router = Router();
const userController = new UserController();

// All user routes require authentication
router.use(authMiddleware.authenticate);

// Current user routes
router.get('/me', userController.getCurrentUser);
router.put('/me', userController.updateCurrentUser);

// User management routes (admin/coordinator only)
router.get('/', authMiddleware.requireManager, userController.getUsers);
router.post('/', authMiddleware.requireManager, userController.createUser);

// Role-specific routes
router.get('/role/:role', authMiddleware.requireManager, userController.getUsersByRole);

// Individual user routes
router.get('/:id', authMiddleware.requireOwnershipOrManager(), userController.getUserById);
router.put('/:id', authMiddleware.requireManager, userController.updateUser);
router.delete('/:id', authMiddleware.requireAdmin, userController.deactivateUser);
router.post('/:id/reactivate', authMiddleware.requireAdmin, userController.reactivateUser);

export default router;