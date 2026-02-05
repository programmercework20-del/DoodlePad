import { User, Post, Comment, Report, Live } from '../models/index.js';
import { Op } from 'sequelize';

// Get all users with filters
export const getAllUsers = async (req, res) => {
    try {
        const { status, search, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        const where = {};

        if (status) {
            where.status = status;
        }

        if (search) {
            where[Op.or] = [
                { name: { [Op.iLike]: `%${search}%` } },
                { email: { [Op.iLike]: `%${search}%` } },
                { username: { [Op.iLike]: `%${search}%` } }
            ];
        }

        const { count, rows } = await User.findAndCountAll({
            where,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [["createdAt", "DESC"]],
            attributes: { exclude: ["password"] }
        });

        res.json({
            success: true,
            data: {
                users: rows,
                pagination: {
                    total: count,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(count / limit)
                }
            }
        });
    } catch (error) {
        console.error("Get all users error:", error);
        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

// Get user by ID with details
export const getUserById = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findByPk(id, {
            attributes: { exclude: ["password"] },
            include: [
                {
                    model: Post,
                    as: "posts",
                    limit: 10,
                    order: [["createdAt", "DESC"]]
                },
                {
                    model: Comment,
                    as: "comments",
                    limit: 10,
                    order: [["createdAt", "DESC"]]
                }
            ]
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Get additional stats
        const postsCount = await Post.count({ where: { userId: id } });
        const commentsCount = await Comment.count({ where: { userId: id } });
        const reportsCount = await Report.count({
            where: { targetType: "user", targetId: id }
        });

        res.json({
            success: true,
            data: {
                user,
                stats: {
                    postsCount,
                    commentsCount,
                    reportsCount
                }
            }
        });
    } catch (error) {
        console.error("Get user by ID error:", error);
        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

// Warn user
export const warnUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const user = await User.findByPk(id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        user.warningCount += 1;
        user.status = "warned";
        await user.save();

        res.json({
            success: true,
            message: "User warned successfully",
            data: { warningCount: user.warningCount }
        });
    } catch (error) {
        console.error("Warn user error:", error);
        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

// Block user temporarily
export const blockUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason, duration } = req.body;

        const user = await User.findByPk(id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        user.status = "blocked";
        await user.save();

        res.json({
            success: true,
            message: "User blocked successfully"
        });
    } catch (error) {
        console.error("Block user error:", error);
        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

// Ban user permanently
export const banUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const user = await User.findByPk(id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        user.status = "banned";
        await user.save();

        res.json({
            success: true,
            message: "User banned permanently"
        });
    } catch (error) {
        console.error("Ban user error:", error);
        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

// Unblock user
export const unblockUser = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findByPk(id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        user.status = "active";
        await user.save();

        res.json({
            success: true,
            message: "User unblocked successfully"
        });
    } catch (error) {
        console.error("Unblock user error:", error);
        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

// Restrict user features
export const restrictFeatures = async (req, res) => {
    try {
        const { id } = req.params;
        const { canComment, canLive, canMessage } = req.body;

        const user = await User.findByPk(id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        if (canComment !== undefined) user.canComment = canComment;
        if (canLive !== undefined) user.canLive = canLive;
        if (canMessage !== undefined) user.canMessage = canMessage;

        await user.save();

        res.json({
            success: true,
            message: "User restrictions updated",
            data: {
                canComment: user.canComment,
                canLive: user.canLive,
                canMessage: user.canMessage
            }
        });
    } catch (error) {
        console.error("Restrict features error:", error);
        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};