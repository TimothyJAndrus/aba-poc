import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { authMiddleware } from '../middleware/auth';

const router = Router();
const authController = new AuthController();

// Public routes (no authentication required)
router.post('/login', authController.login);
router.post('/register', authController.register);
router.post('/refresh', authController.refreshToken);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/verify', authController.verifyToken);

// Protected routes (authentication required)
router.post('/change-password', authMiddleware.authenticate, authController.changePassword);
router.post('/logout', authMiddleware.authenticate, authController.logout);

export default router;