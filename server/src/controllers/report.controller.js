import { Report, User, Post, Comment, Admin } from '../models/index.js';
import { Op } from 'sequelize';

export const getAllReports = async (req, res) => {
    try {
        const { status, targetType, priority, reason, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;
        const where = {};
        if (status) where.status = status;
        if (targetType) where.targetType = targetType;
        if (priority) where.priority = priority;
        if (reason) where.reason = reason;

        const { count, rows } = await Report.findAndCountAll({
            where,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [["priority", "DESC"], ["createdAt", "DESC"]],
            include: [
                { model: User, as: "reporter", attributes: ["id", "name", "username"] },
                { model: Admin, as: "reviewer", attributes: ["id", "name", "email"], required: false }
            ]
        });

        res.json({
            success: true,
            data: {
                reports: rows,
                pagination: { total: count, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(count / limit) }
            }
        });
    } catch (error) {
        console.error("Get all reports error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const getReportById = async (req, res) => {
    try {
        const { id } = req.params;
        const report = await Report.findByPk(id, {
            include: [
                { model: User, as: "reporter", attributes: ["id", "name", "username", "email"] },
                { model: Admin, as: "reviewer", attributes: ["id", "name", "email"], required: false }
            ]
        });
        if (!report) return res.status(404).json({ success: false, message: "Report not found" });

        let targetContent = null;
        if (report.targetType === "post") {
            targetContent = await Post.findByPk(report.targetId, {
                include: [{ model: User, as: "author", attributes: ["id", "name", "username"] }]
            });
        } else if (report.targetType === "comment") {
            targetContent = await Comment.findByPk(report.targetId, {
                include: [{ model: User, as: "author", attributes: ["id", "name", "username"] }]
            });
        } else if (report.targetType === "user") {
            targetContent = await User.findByPk(report.targetId, { attributes: ["id", "name", "username", "email", "status"] });
        }

        res.json({ success: true, data: { report, targetContent } });
    } catch (error) {
        console.error("Get report by ID error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const updateReportStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, adminNotes } = req.body;
        const report = await Report.findByPk(id);
        if (!report) return res.status(404).json({ success: false, message: "Report not found" });
        report.status = status;
        report.reviewedBy = req.admin.id;
        report.reviewedAt = new Date();
        if (adminNotes) report.adminNotes = adminNotes;
        await report.save();
        res.json({ success: true, message: "Report status updated", data: report });
    } catch (error) {
        console.error("Update report status error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const updatePriority = async (req, res) => {
    try {
        const { id } = req.params;
        const { priority } = req.body;
        const report = await Report.findByPk(id);
        if (!report) return res.status(404).json({ success: false, message: "Report not found" });
        report.priority = priority;
        await report.save();
        res.json({ success: true, message: "Report priority updated" });
    } catch (error) {
        console.error("Update priority error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
