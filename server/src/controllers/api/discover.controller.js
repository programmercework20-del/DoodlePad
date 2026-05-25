import { Op } from "sequelize";
import User from "../../models/User.js";
import Follower from "../../models/Follower.js";
import Block from "../../models/Block.js";
import Post from "../../models/Post.js";
import redisClient from "../../config/redis.js";
import sequelize from "../../config/db.js";

export const getDiscoverPeople = async (req, res) => {
  try {
    const userId = req.user.id;
    const cacheKey = `discover:${userId}`;

    // 🚀 1. REDIS CACHE CHECK (High Performance Path)
    if (redisClient?.isReady) {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        return res.json({ success: true, users: JSON.parse(cachedData) });
      }
    }

    // 🚀 2. FETCH USERS I ALREADY FOLLOW
    const myFollowing = await Follower.findAll({
      where: { followerId: userId, status: "accepted" },
      attributes: ["followingId"],
      raw: true
    });
    const followingIds = myFollowing.map(f => f.followingId);

    // 🚀 3. FETCH BLOCKED USERS (Both Directions)
    const blocked = await Block.findAll({
      where: {
        [Op.or]: [
          { blockerId: userId },
          { blockedId: userId }
        ]
      },
      attributes: ["blockerId", "blockedId"],
      raw: true
    });
    const blockedIds = blocked.map(b => b.blockerId === userId ? b.blockedId : b.blockerId);

    // Exclusion list: Main khud, mere following, aur blocked users
    const excludeUserIds = [userId, ...followingIds, ...blockedIds];

    // 🚀 4. OPTIMIZED MUTUAL SEARCH (No N+1 Loop)
    // Sub-query to fetch potential candidates from people my followings follow
    const mutualFollowings = await Follower.findAll({
      where: {
        followerId: { [Op.in]: followingIds.length ? followingIds : [userId] }, // Safety fallback
        followingId: { [Op.notIn]: excludeUserIds },
        status: "accepted"
      },
      attributes: [
        "followingId",
        [sequelize.fn("COUNT", sequelize.col("followerId")), "mutualCount"]
      ],
      group: ["followingId"],
      raw: true,
      limit: 50 // Pull top 50 candidates for scoring layer
    });

    if (mutualFollowings.length === 0) {
      // Agar mutual network khali hai, toh random active profiles fetch kar lo system fallback ke liye
      const randomActiveUsers = await User.findAll({
        where: { id: { [Op.notIn]: excludeUserIds }, status: "active" },
        attributes: ["id", "username", "name", "profilePhoto", "bio", "isVerified", "lastActiveAt"],
        limit: 15
      });
      return res.json({ success: true, users: randomActiveUsers });
    }

    const candidateIds = mutualFollowings.map(m => m.followingId);
    const mutualCountMap = new Map(mutualFollowings.map(m => [m.followingId, parseInt(m.mutualCount)]));

    // 🚀 5. BATCH QUERIES: Fetch Candidate Data and Post Counts in 1-Shot
    const [users, postCounts] = await Promise.all([
      User.findAll({
        isDeactivated: false,
        where: { id: { [Op.in]: candidateIds }, status: "active" },
        attributes: ["id", "username", "name", "profilePhoto", "bio", "isVerified", "lastActiveAt"],
        raw: true
      }),
      Post.findAll({
        where: { userId: { [Op.in]: candidateIds }, status: "active" },
        attributes: ["userId", [sequelize.fn("COUNT", sequelize.col("id")), "totalPosts"]],
        group: ["userId"],
        raw: true
      })
    ]);

    const postCountMap = new Map(postCounts.map(p => [p.userId, parseInt(p.totalPosts)]));

    // 🚀 6. SCORING MATRIX & RANKING LAYERS
    const now = Date.now();
    const rankedUsers = users.map(user => {
      let score = 0;

      // Layer A: Mutual Friends Count weighting
      const mutualCount = mutualCountMap.get(user.id) || 0;
      score += mutualCount * 10;

      // Layer B: Engagement Presence
      if (user.profilePhoto) score += 2;
      if (user.isVerified) score += 3;

      // Layer C: Post activity verification from memory map
      const postsCount = postCountMap.get(user.id) || 0;
      if (postsCount > 0) score += 5;

      // Layer D: Recently Active (Last 24 Hours weight)
      if (user.lastActiveAt) {
        const diffHours = (now - new Date(user.lastActiveAt).getTime()) / (1000 * 60 * 60);
        if (diffHours < 24) score += 2;
      }

      return {
        id: user.id,
        username: user.username,
        name: user.name,
        profilePhoto: user.profilePhoto,
        bio: user.bio,
        isVerified: user.isVerified,
        mutualFollowers: mutualCount,
        postsCount,
        score
      };
    });

    // Sort matching priority descending
    rankedUsers.sort((a, b) => b.score - a.score);

    // Top 20 records return array slicing for production presentation
    const finalResult = rankedUsers.slice(0, 20);

    // 🚀 7. SAVE TO REDIS (10 Minutes Cache Expiry)
    if (redisClient?.isReady && finalResult.length > 0) {
      await redisClient.setEx(cacheKey, 600, JSON.stringify(finalResult));
    }

    return res.json({
      success: true,
      users: finalResult
    });

  } catch (error) {
    console.error("🔥 DISCOVER CRITICAL REJECTION:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load discover people"
    });
  }
};