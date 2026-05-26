import express from 'express';
import { 
    register, 
    login, 
    refresh, 
    logout, 
    logoutAllDevices,
    getMe 
} from '../controllers/auth.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { authLimiter } from '../middlewares/rate-limit.middleware.js';

const router = express.Router();

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/refresh', authLimiter, refresh); // ✅ Added rate limiting
router.post('/logout', authenticateToken, logout);
router.post('/logout-all', authenticateToken, logoutAllDevices);
router.get('/me', authenticateToken, getMe);

export default router;