export const isAdmin = (req, res, next) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ 
            success: false, 
            message: 'Admin access required' 
        });
    }
    next();
};

export const isOwnerOrAdmin = (req, res, next) => {
    const resourceUserId = parseInt(req.params.id) || req.body.userId;
    if (req.user?.role !== 'admin' && req.user?.userId !== resourceUserId) {
        return res.status(403).json({ 
            success: false, 
            message: 'Access denied' 
        });
    }
    next();
};