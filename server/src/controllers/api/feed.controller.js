import { Op } from "sequelize";
import { User, Follower } from "../../models/index.js";
import Post from "../../models/Post.js";
import Ad from "../../models/Ad.js";
import Block from "../../models/Block.js";
import Hashtag from "../../models/Hashtag.js";
import HashtagUsage from "../../models/HashtagUsage.js";
import { calculateFeedScore } from "../../utils/feedRanking.js";
import redisClient from "../../config/redis.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { injectIsLikedFlag } from "../../utils/postHelpers.js";

export const getFeed = asyncHandler(async (req, res) => {
  // ⏱️ PERF: Start Timer
  const { performance } = await import('perf_hooks');
  const tStart = performance.now();
  const timeLog = {};

  const userId = req.user.id;
  const hashtagQuery = req.query.hashtag || req.query.name;

  // =====================================================
  // 🔍 HASHAG INTERCEPTOR (Strict Zero Fallback & Stats Sync)
  // =====================================================
  if (hashtagQuery) {
    const cleanTagName = hashtagQuery.replace(/^#/, "").trim().toLowerCase();
    
    const hashtag = await Hashtag.findOne({ where: { name: cleanTagName } });
    
    if (!hashtag) {
      return res.json({ success: true, feed: [], nextCursor: null });
    }

    const usages = await HashtagUsage.findAll({
      where: { hashtagId: hashtag.id },
      include: [
        {
          model: Post,
          as: "post",
          where: { status: "active" },
          include: [
            {
              model: User,
              as: "author",
              where: { isDeactivated: false },
              attributes: ["id", "name", "username", "profilePhoto", "isVerified"]
            }
          ]
        }
      ],
      order: [["post", "createdAt", "DESC"]]
    });

    const rawPosts = usages.map(u => u.post).filter(Boolean);
    if (rawPosts.length === 0) {
      return res.json({ success: true, feed: [], nextCursor: null });
    }

    const formattedPosts = rawPosts.map(post => {
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
        mediaOrientation: post.mediaOrientation || 'landscape',
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
    });

    const feedWithLikes = await injectIsLikedFlag(formattedPosts, userId);

    timeLog['Hashtag_TOTAL'] = (performance.now() - tStart).toFixed(2) + "ms";
    console.log("📊 [PERF] GET /api/posts (HASHTAG) TIMING:", timeLog);

    return res.json({
      success: true,
      feed: feedWithLikes,
      nextCursor: null 
    });
  }

  // =====================================================
  // 🌍 NORMAL FEED LOGIC (Cursor & Ranking Based)
  // =====================================================
  const limit = parseInt(req.query.limit) || 15;
  const isRefresh = req.query.refresh === 'true'; 

  const cursor = req.query.cursor; 
  const cursorDate = cursor ? new Date(cursor) : null;
  const timeCondition = cursorDate ? { createdAt: { [Op.lt]: cursorDate } } : {};

  // =====================================
  // 🚀 1. REDIS CACHE SYSTEM (Cursor Based)
  // =====================================
  const cacheKey = `user_feed:${userId}:c:${cursor || 'start'}:l:${limit}`;
  
  const tRedisStart = performance.now();
  if (redisClient?.isReady && !isRefresh) {
    try {
      const cachedFeed = await redisClient.get(cacheKey);
      if (cachedFeed) {
        timeLog['Redis_GET_HIT'] = (performance.now() - tRedisStart).toFixed(2) + "ms";
        const parsedFeed = JSON.parse(cachedFeed);
        const feedWithLikes = await injectIsLikedFlag(parsedFeed.feed, userId);
        timeLog['TOTAL_DURATION_HIT'] = (performance.now() - tStart).toFixed(2) + "ms";
        
        console.log("📊 [PERF] GET /api/posts (CACHE HIT) TIMING:");
        console.table(timeLog);

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
  timeLog['Redis_GET_MISS'] = (performance.now() - tRedisStart).toFixed(2) + "ms";

  // =====================================
  // 🚫 2. BLOCKED USERS
  // =====================================
  const tBlockedStart = performance.now();
  const blockedUsers = await Block.findAll({
    where: { [Op.or]: [{ blockerId: userId }, { blockedId: userId }] },
    attributes: ["blockerId", "blockedId"],
    raw: true
  });
  const blockedIds = blockedUsers.map(b => b.blockerId === userId ? b.blockedId : b.blockerId);
  timeLog['Blocked_Query'] = (performance.now() - tBlockedStart).toFixed(2) + "ms";

  // =====================================
  // 👥 3. FOLLOWING USERS
  // =====================================
  const tFollowingStart = performance.now();
  const following = await Follower.findAll({
    where: { followerId: userId, status: "accepted" },
    attributes: ["followingId"],
    raw: true
  });
  const followingIds = following.map(f => f.followingId);
  followingIds.push(userId); 
  const safeFollowingIds = followingIds.filter(id => !blockedIds.includes(id));
  timeLog['Following_Query'] = (performance.now() - tFollowingStart).toFixed(2) + "ms";

  // =====================================
  // 🔥 4. FOLLOWING POSTS (With Cursor)
  // =====================================
  const tFollowingPostsStart = performance.now();
  const followingPosts = await Post.findAll({
    where: {
      ...timeCondition,
      userId: safeFollowingIds.length > 0 ? { [Op.in]: safeFollowingIds } : { [Op.eq]: userId },
      status: "active",
      [Op.or]: [{ isSaved: true }, { expiresAt: { [Op.gt]: new Date() } }]
    },
    include: [{
      model: User, as: "author",
      where: { isDeactivated: false },
      attributes: ["id", "name", "username", "profilePhoto", "isVerified"]
    }],
    order: [["createdAt", "DESC"]],
    limit: limit
  });
  timeLog['Following_Posts_Query'] = (performance.now() - tFollowingPostsStart).toFixed(2) + "ms";

  // =====================================
  // 🌍 5. EXPLORE POSTS (With Cursor)
  // =====================================
  const tExploreStart = performance.now();
  const explorePosts = await Post.findAll({
    where: {
      ...timeCondition,
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
  timeLog['Explore_Posts_Query'] = (performance.now() - tExploreStart).toFixed(2) + "ms";

  // =====================================
  // 🔥 6. TRENDING POSTS (With Cursor)
  // =====================================
  const tTrendingStart = performance.now();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  let trendingTimeCondition = { [Op.gte]: sevenDaysAgo };
  if (cursorDate) {
    trendingTimeCondition = { [Op.and]: [{ [Op.gte]: sevenDaysAgo }, { [Op.lt]: cursorDate }] };
  }

  const trendingPosts = await Post.findAll({
    where: {
      userId: blockedIds.length > 0 ? { [Op.notIn]: blockedIds } : { [Op.notIn]: [] },
      status: "active",
      createdAt: trendingTimeCondition
    },
    include: [{
      model: User, as: "author",
      where: { isPrivate: false, isDeactivated: false }, 
      attributes: ["id", "name", "username", "profilePhoto", "isVerified"]
    }],
    order: [["likesCount", "DESC"], ["createdAt", "DESC"]],
    limit: limit
  });
  timeLog['Trending_Posts_Query'] = (performance.now() - tTrendingStart).toFixed(2) + "ms";

  // =====================================
  // 🧠 7. MERGE, DEDUPLICATE & FORMAT (Includes Doodle parsing)
  // =====================================
  const tMergeStart = performance.now();
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
      mediaOrientation: post.mediaOrientation || 'landscape',
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
  timeLog['Merge_Doodle_Format'] = (performance.now() - tMergeStart).toFixed(2) + "ms";

  // =====================================
  // 🧠 8. FEED RANKING & SHUFFLE
  // =====================================
  const tRankStart = performance.now();
  feed = feed.map(item => {
    let score = (typeof calculateFeedScore === "function") ? calculateFeedScore(item) : 0;
    if (followingIds.includes(item.user.id)) score += 20;
    if (item.user.isVerified) score += 10;
    if (isRefresh) score += Math.floor(Math.random() * 50);

    return { ...item, score };
  });

  feed.sort((a, b) => b.score - a.score || new Date(b.createdAt) - new Date(b.createdAt));
  const paginatedFeed = feed.slice(0, limit).map(({ score, ...rest }) => rest);
  timeLog['Ranking'] = (performance.now() - tRankStart).toFixed(2) + "ms";

  // =====================================
  // 💰 9. ADS INJECTION ENGINE
  // =====================================
  const tAdsStart = performance.now();
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
  timeLog['Ads_Query_Inject'] = (performance.now() - tAdsStart).toFixed(2) + "ms";

  // =====================================
  // 🚀 10. GENERATE NEXT CURSOR
  // =====================================
  let nextCursor = null;
  if (finalFeed.length > 0) {
    const lastPost = [...finalFeed].reverse().find(item => !item.isAd);
    if (lastPost) {
      nextCursor = lastPost.createdAt;
    }
  }

  const cacheData = { feed: finalFeed, nextCursor };

  const tRedisSetStart = performance.now();
  if (redisClient?.isReady && finalFeed.length > 0) {
    await redisClient.setEx(cacheKey, 180, JSON.stringify(cacheData)).catch(() => {});
  }
  timeLog['Redis_SET'] = (performance.now() - tRedisSetStart).toFixed(2) + "ms";

  const tLikesStart = performance.now();
  const feedWithLikes = await injectIsLikedFlag(finalFeed, userId);
  timeLog['Inject_Likes'] = (performance.now() - tLikesStart).toFixed(2) + "ms";

  timeLog['TOTAL_DURATION_MISS'] = (performance.now() - tStart).toFixed(2) + "ms";
  
  console.log("📊 [PERF] GET /api/posts (CACHE MISS) TIMING REPORT:");
  console.table(timeLog);

  return res.json({
    success: true,
    feed: feedWithLikes,
    nextCursor: nextCursor
  });
});