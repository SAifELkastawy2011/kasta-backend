import pool from '../database/db.js';
import { z } from 'zod';

const createTemplateSchema = z.object({
    name: z.string().min(1, 'Template name is required'),
    category: z.string().min(1, 'Category is required'),
    description: z.string().optional(),
    price: z.number().positive().optional(),
    preview_image: z.string().url().optional(),
    html_code: z.string().optional(),
    css_code: z.string().optional(),
    js_code: z.string().optional(),
    is_active: z.boolean().optional().default(true)
});

const updateTemplateSchema = createTemplateSchema.partial();

export const getAllTemplates = async (req, res) => {
    try {
        const { category, active_only } = req.query;
        
        let query = 'SELECT id, name, category, description, price, preview_image, is_active, created_at FROM templates';
        let params = [];
        let conditions = [];
        
        if (active_only === 'true') {
            conditions.push('is_active = true');
        }
        
        if (category) {
            conditions.push(`category = $${conditions.length + 1}`);
            params.push(category);
        }
        
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        
        query += ' ORDER BY created_at DESC';
        
        const result = await pool.query(query, params);
        
        res.json({
            success: true,
            count: result.rows.length,
            templates: result.rows
        });
    } catch (error) {
        console.error('Get templates error:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message // Temporarily show the error
        });
    }
};

export const getTemplateById = async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query(
            'SELECT * FROM templates WHERE id = $1',
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Template not found' });
        }
        
        res.json({
            success: true,
            template: result.rows[0]
        });
    } catch (error) {
        console.error('Get template error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const createTemplate = async (req, res) => {
    try {
        // Admin only check is in route middleware
        const validation = createTemplateSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({ 
                message: 'Validation failed', 
                errors: validation.errors 
            });
        }
        
        const { name, category, description, price, preview_image, html_code, css_code, js_code, is_active } = validation.data;
        
        const result = await pool.query(
            `INSERT INTO templates (name, category, description, price, preview_image, html_code, css_code, js_code, is_active, created_at, updated_at) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()) 
             RETURNING *`,
            [name, category, description, price || 0, preview_image || null, html_code || null, css_code || null, js_code || null, is_active]
        );
        
        res.status(201).json({
            success: true,
            message: 'Template created successfully',
            template: result.rows[0]
        });
    } catch (error) {
        console.error('Create template error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const updateTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        const validation = updateTemplateSchema.safeParse(req.body);
        
        if (!validation.success) {
            return res.status(400).json({ 
                message: 'Validation failed', 
                errors: validation.errors 
            });
        }
        
        const updates = validation.data;
        const fields = [];
        const values = [];
        let paramCount = 1;
        
        // Build dynamic update query
        for (const [key, value] of Object.entries(updates)) {
            fields.push(`${key} = $${paramCount}`);
            values.push(value);
            paramCount++;
        }
        
        if (fields.length === 0) {
            return res.status(400).json({ message: 'No fields to update' });
        }
        
        values.push(id);
        fields.push('updated_at = NOW()');
        
        const query = `
            UPDATE templates 
            SET ${fields.join(', ')} 
            WHERE id = $${paramCount} 
            RETURNING *
        `;
        
        const result = await pool.query(query, values);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Template not found' });
        }
        
        res.json({
            success: true,
            message: 'Template updated successfully',
            template: result.rows[0]
        });
    } catch (error) {
        console.error('Update template error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const deleteTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Admin only
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin access required' });
        }
        
        const result = await pool.query(
            'DELETE FROM templates WHERE id = $1 RETURNING id',
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Template not found' });
        }
        
        res.json({
            success: true,
            message: 'Template deleted successfully'
        });
    } catch (error) {
        console.error('Delete template error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};