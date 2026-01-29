import { Comment, User, Post } from '../models/index.js';

export const getAllComments = async (req, res) => {
    try {
        const { status, type, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;
        const where = {};
        if (status) where.status = status;
        if (type) where.type = type;

        const { count, rows } = await Comment.findAndCountAll({
            where,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [["createdAt", "DESC"]],
            include: [
                { model: User, as: "author", attributes: ["id", "name", "username", "profilePhoto"] },
                { model: Post, as: "post", attributes: ["id", "type", "caption"] }
            ]
        });

        res.json({
            success: true,
            data: {
                comments: rows,
                pagination: { total: count, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(count / limit) }
            }
        });
    } catch (error) {
        console.error("Get all comments error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const deleteComment = async (req, res) => {
    try {
        const { id } = req.params;
        const comment = await Comment.findByPk(id);
        if (!comment) return res.status(404).json({ success: false, message: "Comment not found" });
        comment.status = "deleted";
        await comment.save();
        const post = await Post.findByPk(comment.postId);
        if (post && post.commentsCount > 0) {
            post.commentsCount -= 1;
            await post.save();
        }
        res.json({ success: true, message: "Comment deleted successfully" });
    } catch (error) {
        console.error("Delete comment error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const hideComment = async (req, res) => {
    try {
        const { id } = req.params;
        const comment = await Comment.findByPk(id);
        if (!comment) return res.status(404).json({ success: false, message: "Comment not found" });
        comment.status = "hidden";
        await comment.save();
        res.json({ success: true, message: "Comment hidden successfully" });
    } catch (error) {
        console.error("Hide comment error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
