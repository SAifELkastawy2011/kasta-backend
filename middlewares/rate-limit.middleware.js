import rateLimit from 'express-rate-limit';

export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { 
        success: false, 
        message: 'Too many attempts, please try again after 15 minutes' 
    },
});

export const projectLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: { 
        success: false, 
        message: 'Project creation limit reached. Please try again later.' 
    },
});

export const templateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 50,
    skip: (req) => req.user?.role === 'admin',  // ← ADD THIS LINE
    message: { 
        success: false, 
        message: 'Template creation limit reached' 
    },
});