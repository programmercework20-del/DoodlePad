import { Op } from "sequelize";
import { User, Follower } from "../../models/index.js";
import Post from "../../models/Post.js";
import Ad from "../../models/Ad.js";
import Block from "../../models/Block.js";
import Ad from "../../models/Ad.js";
import { calculateFeedScore } from "../../utils/feedRanking.js";
import redisClient from "../../config/redis.js";

// ============================================================
// GET FEED (With Ranking, Ads & Redis Caching)
// ============================================================
export const getFeed = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    const userId = req.user.id;

    // 🚀 Redis Cache Check
    // Pagination aur User ke hisaab se cache key banayi hai
    const cacheKey = `feed:${userId}:p:${page}:l:${limit}`;
    if (redisClient?.isReady) {
      const cachedFeed = await redisClient.get(cacheKey);
      if (cachedFeed) {
        return res.json({ success: true, feed: JSON.parse(cachedFeed) });
      }
    }

    const blockUsers = await Block.findAll({
      where:{
        [Op.or]: [
          { blockerId: userId },
          { blockedId: userId }
          ]
      }
      });

      const blockedUserIds = blockUsers.map(b => b.blockedId === userId ? b.blockedId : b.blockerId);



    // 1️⃣ Following users ki list nikalna
    const following = await Follower.findAll({
      where: { followerId: userId, status: "accepted" },
      attributes: ["followingId"]
    });

    const followingIds = following.map(f => f.followingId);
    followingIds.push(userId); // Khud ki posts bhi feed mein dikhengi

    // 2️⃣ Posts fetch karna (Extra fetch kar rahe hain ranking ke liye)
    const posts = await Post.findAll({
      where: {
        userId: { [Op.in]: followingIds },
        status: "active",
        [Op.or]: [
          { isSaved: true },
          { expiresAt: { [Op.gt]: new Date() } }
        ]
      },
      include: [{
        model: User,
        as: "author",
        attributes: ["id", "username", "profilePhoto", "isVerified"]
      }],
      order: [["createdAt", "DESC"]],
      limit: limit * 3 // Buffer for better ranking
    });

    // 3️⃣ Format posts with Doodle & Media logic
    let feed = posts.map(post => {
      let parsedPaths = [];
      if (post.type === "doodle" && post.content) {
        try {
          parsedPaths = JSON.parse(post.content);
        } catch {
          parsedPaths = [];
        }
      }

      return {
        id: post.id,
        type: post.type,
        caption: post.caption,
        content: post.content,
        mediaUrls: post.mediaUrls || [], // 🔥 Empty array fallback
        paths: parsedPaths,
        createdAt: post.createdAt,
        likesCount: post.likesCount || 0,
        commentsCount: post.commentsCount || 0,
        sharesCount: post.sharesCount || 0,
        user: post.author
      };
    });

    // 4️⃣ Ranking Algorithm
    feed = feed.map(item => {
      // Following users ki posts ko extra boost milta hai
      const relationshipBoost = followingIds.includes(item.user.id) ? 15 : 0;
      const score = (calculateFeedScore ? calculateFeedScore(item) : 0) + relationshipBoost;
      return { ...item, score };
    });

    // 5️⃣ Sorting & Slicing
    feed.sort((a, b) => b.score - a.score);
    feed = feed.slice(0, limit).map(({ score, ...rest }) => rest);

    const ads = await Ad.findAll({
      where: {
        status: "active",
        startDate: {
        [Op.or]: new Date()
      },
      endDate: {
        [Op.gte]: new Date()
        }
    },
    order: [
      ["priority", "DESC"],
     ["impressions", "DESC"]
    ],

    limit: Math.ceil(feed.length / 5)

  });
   

    let finalFeed = [];
    let adIndex = 0;

    for (let i = 0; i < feed.length; i++) {
      finalFeed.push(feed[i]);
      // Har 4 ya 5 posts ke baad Ad daalna
      if ((i + 1) % 4 === 0 && ads[adIndex]) {
        finalFeed.push({
          type: "ad",
          id: ads[adIndex].id,
          title: ads[adIndex].title,
          imageUrl: ads[adIndex].imageUrl,
          redirectUrl: ads[adIndex].redirectUrl,
          isAd: true
        });
        adIndex++;
      }
    }

    // 🚀 Save to Redis (Cache only for 3 minutes for feed freshness)
    if (redisClient?.isReady && finalFeed.length > 0) {
      await redisClient.setEx(cacheKey, 180, JSON.stringify(finalFeed));
    }

    return res.json({
      success: true,
      feed: finalFeed
    });

  } catch (err) {
    console.error("FEED ERROR:", err);
    res.status(500).json({ success: false, message: "Failed to load feed" });
  }
};