import { Post, User, Comment,} from '../models/index.js';
import { Op } from 'sequelize';
import Post from "../models/Post.js";


// Get all posts with filters
export const getAllPosts = async (req, res) => {
    try {
        const { type, status, search, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        const where = {};
        if (type) where.type = type;
        if (status) where.status = status;
        if (search) {
            where[Op.or] = [
                { caption: { [Op.iLike]: `%${search}%` } },
                { content: { [Op.iLike]: `%${search}%` } }
            ];
        }

        const { count, rows } = await Post.findAndCountAll({
            where,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [["createdAt", "DESC"]],
            include: [{
                model: User,
                as: "author",
                attributes: ["id", "name", "username", "profilePhoto"]
            }]
        });

        res.json({
            success: true,
            data: {
                posts: rows,
                pagination: {
                    total: count,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(count / limit)
                }
            }
        });
    } catch (error) {
        console.error("Get all posts error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const getPostById = async (req, res) => {
    try {
        const { id } = req.params;
        const post = await Post.findByPk(id, {
            include: [
                { model: User, as: "author", attributes: ["id", "name", "username", "profilePhoto", "status"] },
                {
                    model: Comment,
                    as: "comments",
                    limit: 10,
                    order: [["createdAt", "DESC"]],
                    include: [{ model: User, as: "author", attributes: ["id", "name", "username"] }]
                }
            ]
        });
        if (!post) return res.status(404).json({ success: false, message: "Post not found" });
        res.json({ success: true, data: post });
    } catch (error) {
        console.error("Get post by ID error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const hidePost = async (req, res) => {
    try {
        const { id } = req.params;
        const post = await Post.findByPk(id);
        if (!post) return res.status(404).json({ success: false, message: "Post not found" });
        post.status = "hidden";
        await post.save();
        res.json({ success: true, message: "Post hidden successfully" });
    } catch (error) {
        console.error("Hide post error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const deletePost = async (req, res) => {
    try {
        const { id } = req.params;
        const post = await Post.findByPk(id);
        if (!post) return res.status(404).json({ success: false, message: "Post not found" });
        post.status = "deleted";
        await post.save();
        res.json({ success: true, message: "Post deleted successfully" });
    } catch (error) {
        console.error("Delete post error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const markSensitive = async (req, res) => {
    try {
        const { id } = req.params;
        const post = await Post.findByPk(id);
        if (!post) return res.status(404).json({ success: false, message: "Post not found" });
        post.status = "sensitive";
        await post.save();
        res.json({ success: true, message: "Post marked as sensitive" });
    } catch (error) {
        console.error("Mark sensitive error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const disableComments = async (req, res) => {
    try {
        const { id } = req.params;
        const { disabled } = req.body;
        const post = await Post.findByPk(id);
        if (!post) return res.status(404).json({ success: false, message: "Post not found" });
        post.commentsEnabled = !disabled;
        await post.save();
        res.json({ success: true, message: disabled ? "Comments disabled" : "Comments enabled" });
    } catch (error) {
        console.error("Disable comments error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
