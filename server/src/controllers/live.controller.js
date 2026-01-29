import { Live, User, Admin } from '../models/index.js';

export const getAllLiveSessions = async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;
        const where = {};
        if (status) where.status = status;
        else where.status = "live";

        const { count, rows } = await Live.findAndCountAll({
            where,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [["startedAt", "DESC"]],
            include: [
                { model: User, as: "host", attributes: ["id", "name", "username", "profilePhoto"] },
                { model: Admin, as: "terminator", attributes: ["id", "name"], required: false }
            ]
        });

        res.json({
            success: true,
            data: {
                liveSessions: rows,
                pagination: { total: count, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(count / limit) }
            }
        });
    } catch (error) {
        console.error("Get all live sessions error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const endLiveSession = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const liveSession = await Live.findByPk(id);
        if (!liveSession) return res.status(404).json({ success: false, message: "Live session not found" });
        if (liveSession.status !== "live") return res.status(400).json({ success: false, message: "Live session is not currently active" });
        liveSession.status = "terminated";
        liveSession.endedAt = new Date();
        liveSession.terminatedBy = req.admin.id;
        liveSession.terminationReason = reason || "Terminated by admin";
        if (liveSession.startedAt) {
            const duration = Math.floor((liveSession.endedAt - liveSession.startedAt) / 1000);
            liveSession.duration = duration;
        }
        await liveSession.save();
        res.json({ success: true, message: "Live session terminated successfully" });
    } catch (error) {
        console.error("End live session error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const blockHost = async (req, res) => {
    try {
        const { id } = req.params;
        const liveSession = await Live.findByPk(id);
        if (!liveSession) return res.status(404).json({ success: false, message: "Live session not found" });
        const host = await User.findByPk(liveSession.hostId);
        if (!host) return res.status(404).json({ success: false, message: "Host user not found" });
        host.canLive = false;
        await host.save();
        if (liveSession.status === "live") {
            liveSession.status = "terminated";
            liveSession.endedAt = new Date();
            liveSession.terminatedBy = req.admin.id;
            liveSession.terminationReason = "Host blocked from live streaming";
            await liveSession.save();
        }
        res.json({ success: true, message: "Host blocked from going live" });
    } catch (error) {
        console.error("Block host error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
