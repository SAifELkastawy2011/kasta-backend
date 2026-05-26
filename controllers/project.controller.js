import pool from '../database/db.js';
import { z } from 'zod';

const createProjectSchema = z.object({
    client_name: z.string().min(1, 'Client name is required'),
    client_email: z.string().email('Invalid email address'),
    template_id: z.number().int().positive(),
    is_ai_custom: z.boolean().optional(),
    options: z.object({}).optional(),
    notes: z.string().optional()
});

const updateProjectStatusSchema = z.object({
    status: z.enum(['pending', 'accepted', 'completed', 'delivered', 'cancelled'])
});

export const getAllProjects = async (req, res) => {
    try {
        console.log('=== getAllProjects Debug ===');
        console.log('User from token:', req.user);
        
        if (!req.user) {
            console.error('❌ req.user is undefined!');
            return res.status(401).json({
                success: false,
                message: 'User not authenticated'
            });
        }
        
        let query = 'SELECT * FROM projects ORDER BY created_at DESC';
        let params = [];
        
        // If not admin, only show their projects
        if (req.user.role !== 'admin') {
            console.log('Regular user, filtering by email:', req.user.email);
            query = 'SELECT * FROM projects WHERE client_email = $1 ORDER BY created_at DESC';
            params = [req.user.email];
        } else {
            console.log('Admin user, showing all projects');
        }
        
        const result = await pool.query(query, params);
        console.log(`✅ Found ${result.rows.length} projects`);
        
        res.json({
            success: true,
            count: result.rows.length,
            projects: result.rows
        });
    } catch (error) {
        console.error('❌ Get projects error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            success: false, 
            message: error.message,
            stack: error.stack
        });
    }
};

export const getProjectById = async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }
        
        const result = await pool.query(
            'SELECT * FROM projects WHERE id = $1',
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Project not found' });
        }
        
        const project = result.rows[0];
        
        // Check authorization (admin or project owner)
        if (req.user.role !== 'admin' && project.client_email !== req.user.email) {
            return res.status(403).json({ message: 'Access denied' });
        }
        
        res.json({
            success: true,
            project
        });
    } catch (error) {
        console.error('Get project error:', error);
        res.status(500).json({ message: error.message });
    }
};

export const createProject = async (req, res) => {
    try {
        const validation = createProjectSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({ 
                message: 'Validation failed', 
                errors: validation.errors 
            });
        }
        
        const { client_name, client_email, template_id, is_ai_custom, options, notes } = validation.data;
        
        const result = await pool.query(
            `INSERT INTO projects (client_name, client_email, template_id, is_ai_custom, options, notes, status, created_at, updated_at) 
             VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW(), NOW()) 
             RETURNING *`,
            [client_name, client_email, template_id, is_ai_custom || false, options || {}, notes || null]
        );
        
        res.status(201).json({
            success: true,
            message: 'Project created successfully',
            project: result.rows[0]
        });
    } catch (error) {
        console.error('Create project error:', error);
        res.status(500).json({ message: error.message });
    }
};

export const updateProjectStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const validation = updateProjectStatusSchema.safeParse(req.body);
        
        if (!validation.success) {
            return res.status(400).json({ 
                message: 'Validation failed', 
                errors: validation.errors 
            });
        }
        
        const { status } = validation.data;
        
        // Check if project exists and user has permission
        const projectCheck = await pool.query(
            'SELECT * FROM projects WHERE id = $1',
            [id]
        );
        
        if (projectCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Project not found' });
        }
        
        const project = projectCheck.rows[0];
        
        if (req.user.role !== 'admin' && project.client_email !== req.user.email) {
            return res.status(403).json({ message: 'Access denied' });
        }
        
        let updateQuery = 'UPDATE projects SET status = $1, updated_at = NOW()';
        let params = [status];
        
        if (status === 'accepted') {
            updateQuery += ', accepted_at = NOW()';
        } else if (status === 'completed') {
            updateQuery += ', completed_at = NOW()';
        } else if (status === 'delivered') {
            updateQuery += ', delivered_at = NOW()';
        }
        
        updateQuery += ' WHERE id = $2 RETURNING *';
        params.push(id);
        
        const result = await pool.query(updateQuery, params);
        
        res.json({
            success: true,
            message: 'Project status updated',
            project: result.rows[0]
        });
    } catch (error) {
        console.error('Update project error:', error);
        res.status(500).json({ message: error.message });
    }
};

export const deleteProject = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Admin only
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin access required' });
        }
        
        const result = await pool.query(
            'DELETE FROM projects WHERE id = $1 RETURNING id',
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Project not found' });
        }
        
        res.json({
            success: true,
            message: 'Project deleted successfully'
        });
    } catch (error) {
        console.error('Delete project error:', error);
        res.status(500).json({ message: error.message });
    }
};