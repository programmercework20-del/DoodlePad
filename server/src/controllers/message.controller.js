import { Message, User } from '../models/index.js';

export const getReportedMessages = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        const { count, rows } = await Message.findAndCountAll({
            where: { isReported: true },
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [["createdAt", "DESC"]],
            attributes: ["id", "senderId", "receiverId", "conversationType", "type", "hasMedia", "reportCount", "createdAt"],
            include: [
                { model: User, as: "sender", attributes: ["id", "name", "username"] },
                { model: User, as: "receiver", attributes: ["id", "name", "username"], required: false }
            ]
        });

        res.json({
            success: true,
            data: {
                messages: rows,
                pagination: { total: count, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(count / limit) }
            },
            note: "Content is not displayed for privacy reasons. Only metadata is available."
        });
    } catch (error) {
        console.error("Get reported messages error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const flagMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const message = await Message.findByPk(id);
        if (!message) return res.status(404).json({ success: false, message: "Message not found" });
        message.status = "flagged";
        await message.save();
        res.json({ success: true, message: "Message flagged for review" });
    } catch (error) {
        console.error("Flag message error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const deleteMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const message = await Message.findByPk(id);
        if (!message) return res.status(404).json({ success: false, message: "Message not found" });
        message.status = "deleted";
        await message.save();
        res.json({ success: true, message: "Message marked as deleted" });
    } catch (error) {
        console.error("Delete message error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
