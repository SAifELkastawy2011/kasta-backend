import pool from '../database/db.js';
import bcrypt from 'bcrypt';
import { z } from 'zod';

const updateUserSchema = z.object({
    name: z.string().min(2).max(100).optional(),
    email: z.string().email().optional(),
    password: z.string().min(6).optional(),
    role: z.enum(['user', 'admin']).optional()
});

export const getAllUsers = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin access required' });
        }
        
        const result = await pool.query(
            'SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC'
        );
        
        res.json({
            success: true,
            count: result.rows.length,
            users: result.rows
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ message: error.message });
    }
};

export const getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = parseInt(id);
        const requestingUserId = req.user.userId;
        
        if (req.user.role !== 'admin' && requestingUserId !== userId) {
            return res.status(403).json({ message: 'Access denied' });
        }
        
        const result = await pool.query(
            'SELECT id, name, email, role, created_at FROM users WHERE id = $1',
            [userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        res.json({
            success: true,
            user: result.rows[0]
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ message: error.message });
    }
};

export const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = parseInt(id);
        const requestingUserId = req.user.userId;
        
        if (req.user.role !== 'admin' && requestingUserId !== userId) {
            return res.status(403).json({ message: 'Access denied' });
        }
        
        const validation = updateUserSchema.safeParse(req.body);
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
        
        if (updates.password) {
            updates.password = await bcrypt.hash(updates.password, 10);
        }
        
        for (const [key, value] of Object.entries(updates)) {
            fields.push(`${key} = $${paramCount}`);
            values.push(value);
            paramCount++;
        }
        
        if (fields.length === 0) {
            return res.status(400).json({ message: 'No fields to update' });
        }
        
        values.push(userId);
        
        const query = `
            UPDATE users 
            SET ${fields.join(', ')} 
            WHERE id = $${paramCount} 
            RETURNING id, name, email, role, created_at
        `;
        
        const result = await pool.query(query, values);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        res.json({
            success: true,
            message: 'User updated successfully',
            user: result.rows[0]
        });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ message: error.message });
    }
};

export const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        const userIdToDelete = parseInt(id);
        const requestingUserId = req.user.userId;
        const requestingRole = req.user.role;
        
        console.log('=== Delete User Debug ===');
        console.log('User to delete:', userIdToDelete);
        console.log('Requesting user:', requestingUserId);
        console.log('Requesting role:', requestingRole);
        
        // CASE 1: Regular user trying to delete anyone (including themselves)
        if (requestingRole !== 'admin') {
            return res.status(403).json({ 
                success: false,
                message: 'Only administrators can delete user accounts' 
            });
        }
        
        // CASE 2: Admin trying to delete themselves
        if (requestingUserId === userIdToDelete) {
            // Check how many admins exist in the database
            const adminCountResult = await pool.query(
                'SELECT COUNT(*) as count FROM users WHERE role = $1',
                ['admin']
            );
            
            const totalAdmins = parseInt(adminCountResult.rows[0].count);
            
            console.log(`Total admins in database: ${totalAdmins}`);
            
            // If this is the ONLY admin, prevent self-deletion
            if (totalAdmins <= 1) {
                return res.status(400).json({ 
                    success: false,
                    message: 'Cannot delete the only admin account. Please create another admin first before deleting yourself.',
                    details: {
                        totalAdmins: totalAdmins,
                        requiredAtLeast: 2
                    }
                });
            }
            
            // Optional: Require confirmation flag for extra safety
            const { confirmation } = req.body;
            if (confirmation !== 'CONFIRM_DELETE_ADMIN') {
                return res.status(400).json({ 
                    success: false,
                    message: 'To delete your admin account, provide confirmation: "CONFIRM_DELETE_ADMIN"',
                    instructions: 'Send { "confirmation": "CONFIRM_DELETE_ADMIN" } in the request body'
                });
            }
            
            // If there's at least one other admin, allow self-deletion
            console.log(`✅ Admin ${requestingUserId} is deleting their own account. Other admins exist.`);
        }
        
        // CASE 3: Admin deleting another user (including other admins)
        // Check if trying to delete another admin
        const targetUserResult = await pool.query(
            'SELECT id, email, role FROM users WHERE id = $1',
            [userIdToDelete]
        );
        
        if (targetUserResult.rows.length === 0) {
            return res.status(404).json({ 
                success: false,
                message: 'User not found' 
            });
        }
        
        const targetUser = targetUserResult.rows[0];
        
        // If deleting another admin, verify there will still be at least one admin left
        if (targetUser.role === 'admin' && requestingUserId !== userIdToDelete) {
            const remainingAdminsResult = await pool.query(
                'SELECT COUNT(*) as count FROM users WHERE role = $1 AND id != $2',
                ['admin', userIdToDelete]
            );
            
            const remainingAdmins = parseInt(remainingAdminsResult.rows[0].count);
            
            if (remainingAdmins < 1) {
                return res.status(400).json({ 
                    success: false,
                    message: 'Cannot delete this admin as it would leave the system with no administrators.',
                    details: {
                        remainingAdminsAfterDeletion: remainingAdmins,
                        actionRequired: 'Create another admin first'
                    }
                });
            }
        }
        
        // Perform the deletion
        const deleteResult = await pool.query(
            'DELETE FROM users WHERE id = $1 RETURNING id, email, role',
            [userIdToDelete]
        );
        
        // Log the deletion for audit trail
        console.log(`📝 AUDIT: User deleted - ID: ${deleteResult.rows[0].id}, Email: ${deleteResult.rows[0].email}, Role: ${deleteResult.rows[0].role}`);
        console.log(`📝 AUDIT: Deleted by - ID: ${requestingUserId}, Role: ${requestingRole}`);
        
        // Optional: Insert into audit_logs table if you have one
        // await pool.query(
        //     'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5)',
        //     [requestingUserId, 'DELETE_USER', 'users', userIdToDelete, JSON.stringify(targetUser)]
        // );
        
        res.json({
            success: true,
            message: requestingUserId === userIdToDelete 
                ? 'Your admin account has been successfully deleted' 
                : 'User account successfully deleted',
            deletedUser: {
                id: deleteResult.rows[0].id,
                email: deleteResult.rows[0].email,
                role: deleteResult.rows[0].role
            }
        });
        
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Internal server error' 
        });
    }
};