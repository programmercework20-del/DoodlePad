import { verifyToken } from '../utils/jwt.js';

const adminAuth = async (req, res, next) => {
    try {
        let token = req.cookies.token;

        // Also check Authorization header for Bearer token
        if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        const decoded = verifyToken(token);

        if (!decoded) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired token"
            });
        }

        // Check if user is admin
        if (!["admin", "super_admin", "moderator"].includes(decoded.role)) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Admin privileges required."
            });
        }

        // Attach admin info to request
        req.admin = decoded;
        next();
    } catch (error) {
        console.error("Auth middleware error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error during authentication"
        });
    }
};

export default adminAuth;
