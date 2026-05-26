import jwt from 'jsonwebtoken';          // <-- Add this line
import pool from '../database/db.js';

export const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    console.log('🔐 Auth middleware - token present:', !!token);
    console.log('Using JWT_SECRET (first 5 chars):', process.env.JWT_SECRET?.substring(0, 5));
    
    if (!token) {
        return res.status(401).json({ success: false, message: 'Access token required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        console.log('✅ Token verified for:', decoded.email);
        next();
    } catch (error) {
        console.error('❌ Token verification error:', error.message);
        return res.status(403).json({ success: false, message: 'Invalid token' });
    }
};