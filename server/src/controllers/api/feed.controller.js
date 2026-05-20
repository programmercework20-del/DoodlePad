import { Op } from "sequelize";
import { User, Follower } from "../../models/index.js";
import Post from "../../models/Post.js";
import Ad from "../../models/Ad.js"; // 🔥 Direct Clean Model Access
import Block from "../../models/Block.js";
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

    // 🚀 1. REDIS CACHE CHECK (High Performance Response Layout)
    const cacheKey = `feed:${userId}:p:${page}:l:${limit}`;
    if (redisClient?.isReady) {
      try {
        const cachedFeed = await redisClient.get(cacheKey);
        if (cachedFeed) {
          return res.json({ success: true, feed: JSON.parse(cachedFeed) });
        }
      } catch (cacheErr) {
        console.error("⚠️ Feed Redis Read Error:", cacheErr.message);
      }
    }

    // 🚀 2. FETCH BLOCKED USERS (Both Directions Protection)
    const blockUsers = await Block.findAll({
      where: {
        [Op.or]: [
          { blockerId: userId },
          { blockedId: userId }
        ]
      },
      attributes: ["blockerId", "blockedId"],
      raw: true
    });

    // Dono taraf ke blocked profile IDs nikalna taaki unki posts hide ho sakein
    const blockedUserIds = blockUsers.map(b => b.blockerId === userId ? b.blockedId : b.blockerId);

    // 🚀 3. FETCH FOLLOWING USERS LIST
    const following = await Follower.findAll({
      where: { followerId: userId, status: "accepted" },
      attributes: ["followingId"],
      raw: true
    });

    const followingIds = following.map(f => f.followingId);
    followingIds.push(userId); // Khud ki posts bhi include karein

    // 🔥 Filter out blocked users from the following pool
    const finalTargetUserIds = followingIds.filter(id => !blockedUserIds.includes(id));

    if (finalTargetUserIds.length === 0) {
      return res.json({ success: true, feed: [] });
    }

    // 🚀 4. FETCH TARGET POSTS (Optimized Slicing & Buffer fetching)
    const posts = await Post.findAll({
      where: {
        userId: { [Op.in]: finalTargetUserIds },
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
      limit: limit * 3 // Ranking criteria metrics layout buffer
    });

    // 🚀 5. FORMAT POST DATA FALLBACK STRUCTURES
    let feedData = posts.map(post => {
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
        mediaUrls: post.mediaUrls || [],
        paths: parsedPaths,
        createdAt: post.createdAt,
        likesCount: post.likesCount || 0,
        commentsCount: post.commentsCount || 0,
        sharesCount: post.sharesCount || 0,
        user: post.author
      };
    });

    // 🚀 6. RANKING ENGINE AGGREGATIONS
    feedData = feedData.map(item => {
      if (!item.user) return null;
      const relationshipBoost = item.user.id !== userId ? 15 : 0; // External creators boosting matrix
      const score = (calculateFeedScore ? calculateFeedScore(item) : 0) + relationshipBoost;
      return { ...item, score };
    }).filter(item => item !== null);

    // Sort descending order based on algorithmic results weight
    feedData.sort((a, b) => b.score - a.score);
    feedData = feedData.slice(0, limit).map(({ score, ...rest }) => rest);

    // 🚀 7. FETCH ACTIVE ADS (Fixed Postgres Query Syntax)
    const liveAds = await Ad.findAll({
      where: {
        status: "active",
        startDate: { [Op.lte]: new Date() }, // Fixed invalid original Op.or assignment
        endDate: { [Op.gte]: new Date() }
      },
      order: [
        ["priority", "DESC"],
        ["impressions", "ASC"] // Jinhe kam dikhaya gaya hai unhe prioritize karein
      ],
      limit: Math.ceil(feedData.length / 4), // Calculate optimized limits based on display slice
      raw: true
    });

    // 🚀 8. INJECT ADS INTERPOLATION LOOP (Har 4 posts ke baad 1 Ad)
    let finalFeed = [];
    let adPointer = 0;

    for (let i = 0; i < feedData.length; i++) {
      finalFeed.push(feedData[i]);
      
      // Injection criteria interval checking
      if ((i + 1) % 4 === 0 && liveAds[adPointer]) {
        finalFeed.push({
          type: "ad",
          id: liveAds[adPointer].id,
          title: liveAds[adPointer].title,
          imageUrl: liveAds[adPointer].imageUrl,
          redirectUrl: liveAds[adPointer].redirectUrl,
          isAd: true
        });
        adPointer++;
      }
    }

    // 🚀 9. WRITE PERSISTENT STREAM TO REDIS (3 Minutes Expiry Window)
    if (redisClient?.isReady && finalFeed.length > 0) {
      await redisClient.setEx(cacheKey, 180, JSON.stringify(finalFeed)).catch(() => {});
    }

    return res.json({
      success: true,
      feed: finalFeed
    });

  } catch (err) {
    console.error("🔥 FEED CONTROLLER CRITICAL FAILURE ENGINE:", err);
    return res.status(500).json({ success: false, message: "Failed to load feed module stream" });
  }
};