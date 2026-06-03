import { Op, literal } from "sequelize";
import { User, Follower } from "../../models/index.js";
import Post from "../../models/Post.js";
import Ad from "../../models/Ad.js";
import Block from "../../models/Block.js";
import { calculateFeedScore } from "../../utils/feedRanking.js";
import redisClient from "../../config/redis.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { injectIsLikedFlag } from "../../utils/postHelpers.js";

export const getFeed = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 15;
  const page = parseInt(req.query.page) || 1;
  const offset = (page - 1) * limit;
  const userId = req.user.id;

  // =====================================
  // 🚀 1. REDIS CACHE SYSTEM (With Realtime Like Injection)
  // =====================================
  const cacheKey = `user_feed:${userId}:p:${page}:l:${limit}`;
  if (redisClient?.isReady) {
    try {
      const cachedFeed = await redisClient.get(cacheKey);
      if (cachedFeed) {
        // 🔥 Cache se data lene ke baad bhi fresh like status inject karein
        const parsedFeed = JSON.parse(cachedFeed);
        const feedWithLikes = await injectIsLikedFlag(parsedFeed, userId);
        return res.json({ success: true, feed: feedWithLikes });
      }
    } catch (cacheErr) {
      console.error("⚠️ Feed Redis Read Error:", cacheErr.message);
    }
  }

  // =====================================
  // 🚫 2. BLOCKED USERS
  // =====================================
  const blockedUsers = await Block.findAll({
    where: {
      [Op.or]: [
        { blockerId: userId },
        { blockedId: userId }
      ]
    },
    attributes: ["blockerId", "blockedId"],
    raw: true
  });

  const blockedIds = blockedUsers.map(b => b.blockerId === userId ? b.blockedId : b.blockerId);

  // =====================================
  // 👥 3. FOLLOWING USERS
  // =====================================
  const following = await Follower.findAll({
    where: { followerId: userId, status: "accepted" },
    attributes: ["followingId"],
    raw: true
  });

  const followingIds = following.map(f => f.followingId);
  followingIds.push(userId); // Include self posts

  const safeFollowingIds = followingIds.filter(id => !blockedIds.includes(id));
  const blockCondition = blockedIds.length > 0 ? { [Op.notIn]: blockedIds } : {};

  // =====================================
  // 🔥 4. FOLLOWING POSTS
  // =====================================
  const followingPosts = await Post.findAll({
    where: {
      userId: safeFollowingIds.length > 0 ? { [Op.in]: safeFollowingIds } : { [Op.eq]: userId },
      status: "active",
      [Op.or]: [
        { isSaved: true },
        { expiresAt: { [Op.gt]: new Date() } }
      ]
    },
    include: [{
      model: User,
      as: "author",
      where: {
        isDeactivated: false
      },
      attributes: ["id", "username", "profilePhoto", "isVerified"]
    }],
    order: [["createdAt", "DESC"]],
    limit: limit * 2,
    raw: false
  });

  // =====================================
  // 🌍 5. EXPLORE POSTS
  // =====================================
  const explorePosts = await Post.findAll({
    where: {
      userId: {
        [Op.notIn]: [...followingIds, ...blockedIds]
      },
      status: "active",
      [Op.or]: [
        { isSaved: true },
        { expiresAt: { [Op.gt]: new Date() } }
      ]
    },
    include: [{
      model: User,
      as: "author",
      where: { isPrivate: false, isDeactivated: false },
      attributes: ["id", "username", "profilePhoto", "isVerified"]
    }],
    order: [["createdAt", "DESC"]], 
    limit: limit * 2,
    raw: false
  });

  // =====================================
  // 🔥 6. TRENDING POSTS
  // =====================================
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const trendingPosts = await Post.findAll({
    where: {
      userId: blockedIds.length > 0 ? { [Op.notIn]: blockedIds } : { [Op.notIn]: [] },
      status: "active",
      createdAt: { [Op.gte]: sevenDaysAgo } 
    },
    include: [{
      model: User,
      as: "author",
      attributes: ["id", "username", "profilePhoto", "isVerified"]
    }],
    order: [
      ["likesCount", "DESC"],
      ["commentsCount", "DESC"],
      ["sharesCount", "DESC"]
    ],
    limit: 15,
    raw: false
  });

  // =====================================
  // 🧠 7. MERGE & UNIQUE DEDUPLICATION
  // =====================================
  const allPosts = [...followingPosts, ...explorePosts, ...trendingPosts];
  const uniquePosts = [];
  const seen = new Set();

  for (const post of allPosts) {
    if (post && post.id && !seen.has(post.id)) {
      seen.add(post.id);
      uniquePosts.push(post);
    }
  }

  // =====================================
  // 🧠 8. FORMAT DATA STREAM
  // =====================================
  let feed = uniquePosts.map(post => {
    if (!post.author) return null;
    
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
      thumbnail: post.thumbnail || null, // 🔥 YE LINE MISSING THI! FIX HO GAYI.
      duration: post.duration || 0,
      paths: parsedPaths,
      createdAt: post.createdAt,
      likesCount: post.likesCount || 0,
      commentsCount: post.commentsCount || 0,
      sharesCount: post.sharesCount || 0,
      user: post.author
    };
  }).filter(Boolean);

  // =====================================
  // 🧠 9. FEED RANKING ALGORITHM WEIGHTS
  // =====================================
  feed = feed.map(item => {
    let score = (typeof calculateFeedScore === "function") ? calculateFeedScore(item) : 0;

    if (followingIds.includes(item.user.id)) score += 20;
    if (item.user.isVerified) score += 10;

    const hoursOld = (new Date() - new Date(item.createdAt)) / (1000 * 60 * 60);
    if (hoursOld <= 1) score += 40;
    else if (hoursOld <= 6) score += 30;
    else if (hoursOld <= 24) score += 20;
    else if (hoursOld <= 72) score += 10;

    score += (item.likesCount * 2) + (item.commentsCount * 3) + (item.sharesCount * 4);
    score += Math.floor(Math.random() * 20);

    return { ...item, score };
  });

  // =====================================
  // 🔥 10. SORT & PAGINATE SLICE 
  // =====================================
  feed.sort((a, b) => b.score - a.score);
  const paginatedFeed = feed.slice(offset, offset + limit).map(({ score, ...rest }) => rest);

  // =====================================
  // 💰 11. ADS INJECTION ENGINE
  // =====================================
  const ads = await Ad.findAll({
    where: {
      status: "active",
      startDate: { [Op.lte]: new Date() },
      endDate: { [Op.gte]: new Date() }
    },
    order: [["priority", "DESC"]],
    limit: Math.ceil(paginatedFeed.length / 5),
    raw: true
  });

  let finalFeed = [];
  let adIndex = 0;

  for (let i = 0; i < paginatedFeed.length; i++) {
    finalFeed.push(paginatedFeed[i]);

    if ((i + 1) % 5 === 0 && ads[adIndex]) {
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

  // =====================================
  // 🔥 12. FINALIZE & SEND (Cache Raw -> Inject -> Send)
  // =====================================
  
  // Cache compiled results array to Redis for 3 Minutes (Without isLiked flag)
  if (redisClient?.isReady && finalFeed.length > 0) {
    await redisClient.setEx(cacheKey, 180, JSON.stringify(finalFeed)).catch(() => {});
  }

  // Inject isLiked property exclusively for the current user
  const feedWithLikes = await injectIsLikedFlag(finalFeed, userId);

  return res.json({
    success: true,
    feed: feedWithLikes
  });
});