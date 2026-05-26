import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import pool from '../database/db.js';
import { z } from 'zod';

const registerSchema = z.object({
    name: z.string().min(2).max(100),
    email: z.string().email(),
    password: z.string().min(6)
});

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string()
});

const generateAccessToken = (user) => {
    return jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.ACCESS_TOKEN_EXPIRE || '15m' }
    );
};

const generateRefreshToken = async (userId) => {
    const token = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    
    await pool.query(
        `INSERT INTO public.refresh_tokens (user_id, token, expires_at, created_at) 
         VALUES ($1, $2, $3, NOW())`,
        [userId, token, expiresAt]
    );
    
    return token;
};

const setRefreshTokenCookie = (res, token) => {
    res.cookie('refreshToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000,
        path: '/'
    });
};

const clearRefreshTokenCookie = (res) => {
    res.clearCookie('refreshToken', { path: '/' });
};

const blacklistAccessToken = async (token) => {
    try {
        const decoded = jwt.decode(token);
        if (decoded && decoded.exp) {
            const expiresAt = new Date(decoded.exp * 1000);
            await pool.query(
                'INSERT INTO public.token_blacklist (token, expires_at) VALUES ($1, $2) ON CONFLICT (token) DO NOTHING',
                [token, expiresAt]
            );
            console.log('✅ Access token blacklisted');
        }
    } catch (error) {
        console.error('Failed to blacklist token:', error.message);
    }
};

const revokeAllRefreshTokens = async (userId) => {
    await pool.query(
        'UPDATE public.refresh_tokens SET revoked = TRUE WHERE user_id = $1 AND revoked = FALSE',
        [userId]
    );
};

export const register = async (req, res) => {
    try {
        const validation = registerSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({ success: false, errors: validation.errors });
        }
        
        const { name, email, password } = validation.data;
        
        const existingUser = await pool.query(
            'SELECT id FROM public.users WHERE email = $1',
            [email.toLowerCase()]
        );
        
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ success: false, message: 'User already exists' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const result = await pool.query(
            `INSERT INTO public.users (name, email, password, role, created_at) 
             VALUES ($1, $2, $3, 'user', NOW()) 
             RETURNING id, name, email, role, created_at`,
            [name, email.toLowerCase(), hashedPassword]
        );
        
        const user = result.rows[0];
        
        const accessToken = generateAccessToken(user);
        const refreshToken = await generateRefreshToken(user.id);
        
        setRefreshTokenCookie(res, refreshToken);
        
        res.status(201).json({
            success: true,
            message: 'Registration successful',
            accessToken,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                created_at: user.created_at
            }
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const login = async (req, res) => {
    try {
        const validation = loginSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({ success: false, errors: validation.errors });
        }
        
        const { email, password } = validation.data;
        
        const result = await pool.query(
            'SELECT id, name, email, password, role, created_at FROM public.users WHERE email = $1',
            [email.toLowerCase()]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        
        const user = result.rows[0];
        const isValid = await bcrypt.compare(password, user.password);
        
        if (!isValid) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        
        const accessToken = generateAccessToken(user);
        
        await revokeAllRefreshTokens(user.id);
        const refreshToken = await generateRefreshToken(user.id);
        
        setRefreshTokenCookie(res, refreshToken);
        
        delete user.password;
        
        res.json({
            success: true,
            message: 'Login successful',
            accessToken,
            user
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const refresh = async (req, res) => {
    try {
        console.log('🔄 Refresh endpoint called');
        
        let refreshToken = null;
        if (req.cookies?.refreshToken) {
            refreshToken = req.cookies.refreshToken;
        } else if (req.headers.authorization?.startsWith('Bearer ')) {
            refreshToken = req.headers.authorization.split(' ')[1];
        } else if (req.body?.refreshToken) {
            refreshToken = req.body.refreshToken;
        }
        
        if (!refreshToken) {
            return res.status(401).json({ success: false, message: 'Refresh token required', code: 'REFRESH_TOKEN_MISSING' });
        }
        
        const tokenResult = await pool.query(
            `SELECT rt.*, u.id as user_id, u.email, u.name, u.role 
             FROM public.refresh_tokens rt
             JOIN public.users u ON rt.user_id = u.id
             WHERE rt.token = $1 AND rt.revoked = FALSE AND rt.expires_at > NOW()`,
            [refreshToken]
        );
        
        if (tokenResult.rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid or expired refresh token', code: 'REFRESH_TOKEN_INVALID' });
        }
        
        const tokenData = tokenResult.rows[0];
        const user = {
            id: tokenData.user_id,
            email: tokenData.email,
            name: tokenData.name,
            role: tokenData.role
        };
        
        const newAccessToken = jwt.sign(
            { userId: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.ACCESS_TOKEN_EXPIRE || '15m' }
        );
        
        const newRefreshToken = crypto.randomBytes(40).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        
        await pool.query(
            `INSERT INTO public.refresh_tokens (user_id, token, expires_at, created_at) 
             VALUES ($1, $2, $3, NOW())`,
            [user.id, newRefreshToken, expiresAt]
        );
        
        await pool.query('UPDATE public.refresh_tokens SET revoked = TRUE WHERE token = $1', [refreshToken]);
        
        res.cookie('refreshToken', newRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 30 * 24 * 60 * 60 * 1000,
            path: '/'
        });
        
        res.json({
            success: true,
            accessToken: newAccessToken,
            expiresIn: 15 * 60
        });
        
    } catch (error) {
        console.error('Refresh error:', error);
        res.status(500).json({ success: false, message: 'Internal server error', code: 'REFRESH_ERROR' });
    }
};

export const logout = async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const accessToken = authHeader && authHeader.split(' ')[1];
        
        if (accessToken) {
            await blacklistAccessToken(accessToken);
        }
        
        const refreshToken = req.cookies?.refreshToken;
        if (refreshToken) {
            await pool.query('UPDATE public.refresh_tokens SET revoked = TRUE WHERE token = $1', [refreshToken]);
        }
        
        clearRefreshTokenCookie(res);
        
        res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const logoutAllDevices = async (req, res) => {
    try {
        const userId = req.user.userId;
        await revokeAllRefreshTokens(userId);
        
        const authHeader = req.headers['authorization'];
        const accessToken = authHeader && authHeader.split(' ')[1];
        if (accessToken) {
            await blacklistAccessToken(accessToken);
        }
        
        clearRefreshTokenCookie(res);
        
        res.json({ success: true, message: 'Logged out from all devices' });
    } catch (error) {
        console.error('Logout all devices error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getMe = async (req, res) => {
    try {
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }
        
        const userId = req.user.userId;
        const result = await pool.query(
            'SELECT id, name, email, role, created_at FROM public.users WHERE id = $1',
            [userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        res.json({ success: true, user: result.rows[0] });
    } catch (error) {
        console.error('GetMe error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const verifyToken = async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.json({ success: false, isValid: false, message: 'No token provided' });
        }
        
        const blacklisted = await pool.query(
            'SELECT id FROM public.token_blacklist WHERE token = $1 AND expires_at > NOW()',
            [token]
        );
        
        if (blacklisted.rows.length > 0) {
            return res.json({ success: false, isValid: false, message: 'Token invalidated' });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        const user = await pool.query(
            'SELECT id, name, email, role FROM public.users WHERE id = $1',
            [decoded.userId]
        );
        
        if (user.rows.length === 0) {
            return res.json({ success: false, isValid: false, message: 'User not found' });
        }
        
        res.json({ success: true, isValid: true, user: user.rows[0] });
    } catch (error) {
        res.json({ success: false, isValid: false, message: error.message });
    }
};