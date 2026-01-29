import { User, Post, Comment, Report, Live, Message } from '../models/index.js';
import { Op } from 'sequelize';

export const getDashboardStats = async (req, res) => {
    try {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

        const totalUsers = await User.count();
        const activeUsers = await User.count({ where: { lastActiveAt: { [Op.gte]: today } } });
        const newSignupsToday = await User.count({ where: { createdAt: { [Op.gte]: today } } });
        const newSignupsWeek = await User.count({ where: { createdAt: { [Op.gte]: weekAgo } } });
        const totalPosts = await Post.count();
        const activePosts = await Post.count({ where: { status: "active" } });
        const hiddenPosts = await Post.count({ where: { status: "hidden" } });
        const deletedPosts = await Post.count({ where: { status: "deleted" } });
        const totalReports = await Report.count();
        const pendingReports = await Report.count({ where: { status: "pending" } });
        const reviewingReports = await Report.count({ where: { status: "reviewing" } });
        const highPriorityReports = await Report.count({ where: { priority: "high", status: { [Op.in]: ["pending", "reviewing"] } } });
        const activeLives = await Live.count({ where: { status: "live" } });
        const totalLives = await Live.count();
        const blockedUsers = await User.count({ where: { status: "blocked" } });
        const bannedUsers = await User.count({ where: { status: "banned" } });
        const warnedUsers = await User.count({ where: { status: "warned" } });

        const postsByType = await Post.findAll({
            attributes: ["type", [User.sequelize.fn("COUNT", User.sequelize.col("id")), "count"]],
            group: ["type"]
        });

        const reportsByReason = await Report.findAll({
            attributes: ["reason", [User.sequelize.fn("COUNT", User.sequelize.col("id")), "count"]],
            where: { status: { [Op.in]: ["pending", "reviewing"] } },
            group: ["reason"]
        });

        res.json({
            success: true,
            data: {
                users: { total: totalUsers, active: activeUsers, newToday: newSignupsToday, newThisWeek: newSignupsWeek, blocked: blockedUsers, banned: bannedUsers, warned: warnedUsers },
                posts: { total: totalPosts, active: activePosts, hidden: hiddenPosts, deleted: deletedPosts, byType: postsByType },
                reports: { total: totalReports, pending: pendingReports, reviewing: reviewingReports, highPriority: highPriorityReports, byReason: reportsByReason },
                live: { active: activeLives, total: totalLives }
            }
        });
    } catch (error) {
        console.error("Get dashboard stats error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const getActivityTrends = async (req, res) => {
    try {
        const { days = 7 } = req.query;
        const trends = [];

        for (let i = parseInt(days) - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            date.setHours(0, 0, 0, 0);
            const nextDate = new Date(date);
            nextDate.setDate(nextDate.getDate() + 1);

            const newUsers = await User.count({ where: { createdAt: { [Op.gte]: date, [Op.lt]: nextDate } } });
            const newPosts = await Post.count({ where: { createdAt: { [Op.gte]: date, [Op.lt]: nextDate } } });
            const newReports = await Report.count({ where: { createdAt: { [Op.gte]: date, [Op.lt]: nextDate } } });

            trends.push({
                date: date.toISOString().split("T")[0],
                users: newUsers,
                posts: newPosts,
                reports: newReports
            });
        }

        res.json({ success: true, data: trends });
    } catch (error) {
        console.error("Get activity trends error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
