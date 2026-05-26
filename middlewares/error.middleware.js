export const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    // PostgreSQL unique violation
    if (err.code === '23505') {
        return res.status(409).json({
            success: false,
            message: 'Duplicate entry violates unique constraint'
        });
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            message: 'Invalid token'
        });
    }

    res.status(500).json({
        success: false,
        message: process.env.NODE_ENV === 'production' 
            ? 'Internal server error' 
            : err.message
    });
};

export const notFound = (req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found`
    });
};