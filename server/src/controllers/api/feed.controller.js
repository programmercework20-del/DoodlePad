import { Op } from "sequelize";
import { User, Follower } from "../../models/index.js";
import Post from "../../models/Post.js";
import Reel from "../../models/Reel.js";
import { calculateFeedScore } from "../../utils/feedRanking.js";


export const getFeed = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const cursor = req.query.cursor;
        const userId = req.user.id;

        // 1️⃣ Get following list
        const following = await Follower.findAll({
            where: {
                followerId: userId,
                status: "accepted"   // 🔥 ONLY ACCEPTED FOLLOWERS
            },
            attributes: ["followingId"]
        });


        // convert to array of ids
        const followingIds = following.map(f => f.followingId);

        // include own posts also
        followingIds.push(userId);

        const dateFilter = cursor
            ? { createdAt: { [Op.lt]: new Date(cursor) } }
            : {};


        // 2️⃣ Fetch POSTS
        const posts = await Post.findAll({
            where: {
                userId: { [Op.in]: followingIds },
                status: "active",
                ...dateFilter
            },
            include: [{
                model: User,
                as: "author",   // ⭐ FIXED
                attributes: ["id", "username", "profilePhoto"]
            }],
            order: [["createdAt", "DESC"]],
            limit
        });

        // 3️⃣ Fetch REELS
        const reels = await Reel.findAll({
            where: {
                userId: { [Op.in]: followingIds },
                status: "active",
                ...dateFilter
            },
            include: [{
                model: User,
                as: "author",   // ⭐ FIXED
                attributes: ["id", "username", "profilePhoto"]
            }],
            order: [["createdAt", "DESC"]],
            limit
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
            user: post.author
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
            user: reel.author
        }));

        // 6️⃣ Merge + Sort
        let feed = [...formattedPosts, ...formattedReels];

        // 🔥 Calculate score for each item
        feed = feed.map(item => {

            let relationshipBoost = 0;

            // boost people you follow
            if (item.user && followingIds.includes(item.user.id)) {
                relationshipBoost = 10;
            }


            const score = calculateFeedScore(item) + relationshipBoost;

            return { ...item, score };
        });


        // 🔥 Sort by score (NOT date anymore)
        feed.sort((a, b) => b.score - a.score);

        // remove score before sending to frontend
        feed = feed.slice(0, limit).map(({ score, ...rest }) => rest);



        const nextCursor = feed.length
            ? feed[feed.length - 1].createdAt
            : null;


        res.json({
            success: true,
            feed,
            nextCursor
        });

    } catch (err) {
        console.error("Feed error:", err);
        res.status(500).json({ message: "Failed to load feed" });
    }
};
