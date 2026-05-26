import express from 'express';
import {
    getAllTemplates,
    getTemplateById,
    createTemplate,
    updateTemplate,
    deleteTemplate
} from '../controllers/template.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { isAdmin } from '../middlewares/role.middleware.js';
import { templateLimiter } from '../middlewares/rate-limit.middleware.js';

const router = express.Router();

router.get('/', getAllTemplates);
router.get('/:id', getTemplateById);
router.post('/', authenticateToken, isAdmin, templateLimiter, createTemplate);
router.put('/:id', authenticateToken, isAdmin, updateTemplate);
router.delete('/:id', authenticateToken, isAdmin, deleteTemplate);

export default router;