import { Op } from "sequelize";
import { User, Follower } from "../../models/index.js";
import Post from "../../models/Post.js";
import Reel from "../../models/Reel.js";

export const getFeed = async (req, res) => {
    try {
        const userId = req.user.id;

        // 1️⃣ Get following list
        const following = await Follower.findAll({
            where: { followerId: userId },
            attributes: ["followingId"]
        });

        // convert to array of ids
        const followingIds = following.map(f => f.followingId);

        // include own posts also
        followingIds.push(userId);

        // 2️⃣ Fetch POSTS
        const posts = await Post.findAll({
            where: {
                userId: { [Op.in]: followingIds },
                status: "active"
            },
            include: [{
                model: User,
                as: "author",   // ⭐ FIXED
                attributes: ["id", "username", "profilePhoto"]
            }]

        });

        // 3️⃣ Fetch REELS
        const reels = await Reel.findAll({
            where: {
                userId: { [Op.in]: followingIds },
                status: "active"
            },
            include: [{
                model: User,
                as: "author",   // ⭐ FIXED
                attributes: ["id", "username", "profilePhoto"]
            }]

        });

        // 4️⃣ Normalize POSTS
        const formattedPosts = posts.map(post => ({
            id: post.id,
            type: "post",
            caption: post.caption,
            mediaUrl: post.imageUrl,
            likesCount: post.likesCount,
            commentsCount: post.commentsCount,
            createdAt: post.createdAt,
            user: post.user
        }));

        // 5️⃣ Normalize REELS
        const formattedReels = reels.map(reel => ({
            id: reel.id,
            type: "reel",
            caption: reel.caption,
            mediaUrl: reel.videoUrl,
            likesCount: reel.likesCount,
            commentsCount: reel.commentsCount,
            createdAt: reel.createdAt,
            user: reel.user
        }));

        // 6️⃣ Merge + Sort
        const feed = [...formattedPosts, ...formattedReels]
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json({
            success: true,
            feed
        });

    } catch (err) {
        console.error("Feed error:", err);
        res.status(500).json({ message: "Failed to load feed" });
    }
};
