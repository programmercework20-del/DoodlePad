
import { Op } from "sequelize";
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
  const isRefresh = req.query.refresh === 'true'; 
  const userId = req.user.id;

  // 🚀 PRO-LEVEL: CURSOR PAGINATION
  // Frontend se 'page' ki jagah pichle post ka 'createdAt' timestamp aayega
  const cursor = req.query.cursor; 
  const cursorDate = cursor ? new Date(cursor) : null;

  // Agar cursor hai, toh hum sirf us time se PURANI posts layenge (No duplicates ever!)
  const timeCondition = cursorDate ? { createdAt: { [Op.lt]: cursorDate } } : {};

  // =====================================
  // 🚀 1. REDIS CACHE SYSTEM (Cursor Based)
  // =====================================
  const cacheKey = `user_feed:${userId}:c:${cursor || 'start'}:l:${limit}`;
  
  if (redisClient?.isReady && !isRefresh) {
    try {
      const cachedFeed = await redisClient.get(cacheKey);
      if (cachedFeed) {
        const parsedFeed = JSON.parse(cachedFeed);
        const feedWithLikes = await injectIsLikedFlag(parsedFeed.feed, userId);
        return res.json({ 
          success: true, 
          feed: feedWithLikes, 
          nextCursor: parsedFeed.nextCursor 
        });
      }
    } catch (cacheErr) {
      console.error("⚠️ Feed Redis Read Error:", cacheErr.message);
    }
  }

  // =====================================
  // 🚫 2. BLOCKED USERS
  // =====================================
  const blockedUsers = await Block.findAll({
    where: { [Op.or]: [{ blockerId: userId }, { blockedId: userId }] },
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
  followingIds.push(userId); 
  const safeFollowingIds = followingIds.filter(id => !blockedIds.includes(id));

  // =====================================
  // 🔥 4. FOLLOWING POSTS (With Cursor)
  // =====================================
  const followingPosts = await Post.findAll({
    where: {
      ...timeCondition, // 🚀 CURSOR INJECTED
      userId: safeFollowingIds.length > 0 ? { [Op.in]: safeFollowingIds } : { [Op.eq]: userId },
      status: "active",
      [Op.or]: [{ isSaved: true }, { expiresAt: { [Op.gt]: new Date() } }]
    },
    include: [{
      model: User, as: "author",
      where: { isDeactivated: false },
      attributes: ["id", "name", "username", "profilePhoto", "isVerified"] // Optimized payload
    }],
    order: [["createdAt", "DESC"]],
    limit: limit
  });

  // =====================================
  // 🌍 5. EXPLORE POSTS (With Cursor)
  // =====================================
  const explorePosts = await Post.findAll({
    where: {
      ...timeCondition, // 🚀 CURSOR INJECTED
      userId: { [Op.notIn]: [...followingIds, ...blockedIds] },
      status: "active",
      [Op.or]: [{ isSaved: true }, { expiresAt: { [Op.gt]: new Date() } }]
    },
    include: [{
      model: User, as: "author",
      where: { isPrivate: false, isDeactivated: false }, 
      attributes: ["id", "name", "username", "profilePhoto", "isVerified"]
    }],
    order: [["createdAt", "DESC"]], 
    limit: limit
  });

  // =====================================
  // 🔥 6. TRENDING POSTS (With Cursor)
  // =====================================
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Cursor and 7 days logic merged
  let trendingTimeCondition = { [Op.gte]: sevenDaysAgo };
  if (cursorDate) {
    trendingTimeCondition = { [Op.and]: [{ [Op.gte]: sevenDaysAgo }, { [Op.lt]: cursorDate }] };
  }

  const trendingPosts = await Post.findAll({
    where: {
      userId: blockedIds.length > 0 ? { [Op.notIn]: blockedIds } : { [Op.notIn]: [] },
      status: "active",
      createdAt: trendingTimeCondition // 🚀 CURSOR INJECTED
    },
    include: [{
      model: User, as: "author",
      where: { isPrivate: false, isDeactivated: false }, 
      attributes: ["id", "name", "username", "profilePhoto", "isVerified"]
    }],
    order: [["likesCount", "DESC"], ["createdAt", "DESC"]], // Adjusted order for cursor stability
    limit: limit
  });

  // =====================================
  // 🧠 7. MERGE, DEDUPLICATE & FORMAT (Optimized)
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

  let feed = uniquePosts.map(post => {
    if (!post.author) return null;
    let parsedPaths = [];
    if (post.type === "doodle" && post.content) {
      try { parsedPaths = JSON.parse(post.content); } catch { parsedPaths = []; }
    }

    return {
      id: post.id,
      type: post.type,
      caption: post.caption,
      content: post.content,
      location: post.location || null,
      mediaUrls: post.mediaUrls || [],
        mediaOrientation: post.mediaOrientation || 'landscape', // 🔥 ADD
      thumbnail: post.thumbnail || null, 
      duration: post.duration || 0,
      backgroundMusicUrl: post.backgroundMusicUrl || [], 
      paths: parsedPaths,
      createdAt: post.createdAt,
      likesCount: post.likesCount || 0,
      commentsCount: post.commentsCount || 0,
      sharesCount: post.sharesCount || 0,
      user: post.author
    };
  }).filter(Boolean);

  // =====================================
  // 🧠 8. FEED RANKING & SHUFFLE
  // =====================================
  feed = feed.map(item => {
    let score = (typeof calculateFeedScore === "function") ? calculateFeedScore(item) : 0;
    if (followingIds.includes(item.user.id)) score += 20;
    if (item.user.isVerified) score += 10;
    
    // Slight random shuffle logic only on refresh
    if (isRefresh) score += Math.floor(Math.random() * 50);

    return { ...item, score };
  });

  // Sort by score then by createdAt to keep time flow logic stable
  feed.sort((a, b) => b.score - a.score || new Date(b.createdAt) - new Date(a.createdAt));
  const paginatedFeed = feed.slice(0, limit).map(({ score, ...rest }) => rest);

  // =====================================
  // 💰 9. ADS INJECTION ENGINE
  // =====================================
  const ads = await Ad.findAll({
    where: { status: "active", startDate: { [Op.lte]: new Date() }, endDate: { [Op.gte]: new Date() } },
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
        type: "ad", id: ads[adIndex].id, title: ads[adIndex].title,
        imageUrl: ads[adIndex].imageUrl, redirectUrl: ads[adIndex].redirectUrl, isAd: true
      });
      adIndex++;
    }
  }

  // =====================================
  // 🚀 10. GENERATE NEXT CURSOR
  // =====================================
  let nextCursor = null;
  if (finalFeed.length > 0) {
    // Find the last real post (not an ad) to use as the next cursor
    const lastPost = [...finalFeed].reverse().find(item => !item.isAd);
    if (lastPost) {
      nextCursor = lastPost.createdAt;
    }
  }

  const cacheData = { feed: finalFeed, nextCursor };

  if (redisClient?.isReady && finalFeed.length > 0) {
    await redisClient.setEx(cacheKey, 180, JSON.stringify(cacheData)).catch(() => {});
  }

  const feedWithLikes = await injectIsLikedFlag(finalFeed, userId);

  return res.json({
    success: true,
    feed: feedWithLikes,
    nextCursor: nextCursor
  });
});