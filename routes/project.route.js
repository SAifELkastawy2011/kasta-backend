import express from 'express';
import {
    getAllProjects,
    getProjectById,
    createProject,
    updateProjectStatus,
    deleteProject
} from '../controllers/project.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { isAdmin } from '../middlewares/role.middleware.js';
import { projectLimiter } from '../middlewares/rate-limit.middleware.js';

const router = express.Router();

router.get('/', authenticateToken, getAllProjects);
router.get('/:id', authenticateToken, getProjectById);
router.post('/', authenticateToken, projectLimiter, createProject);
router.patch('/:id/status', authenticateToken, updateProjectStatus);
router.delete('/:id', authenticateToken, isAdmin, deleteProject);

export default router;