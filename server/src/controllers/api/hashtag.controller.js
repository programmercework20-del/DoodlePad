import { Op } from "sequelize";
import Hashtag from "../../models/Hashtag.js";
import HashtagUsage from "../../models/HashtagUsage.js";
import Post from "../../models/Post.js";
import User from "../../models/User.js";

// 🔥 HELPER IMPORT FOR LIKES FLAG
import { injectIsLikedFlag } from "../../utils/postHelpers.js";
import redisClient from "../../config/redis.js";

// =======================================
// 🔍 SEARCH HASHTAGS
// =======================================
export const searchHashtags = async (req, res) => {
  try {
    const query = req.query.q?.replace("#", "").trim() || "";

    if (!query) {
      return res.json({
        success: true,
        hashtags: []
      });
    }

    const hashtags = await Hashtag.findAll({
      where: {
        name: {
          [Op.iLike]: `${query}%`
        }
      },
      order: [
        ["postsCount", "DESC"]
      ],
      limit: 20
    });

    return res.json({
      success: true,
      hashtags
    });

  } catch (error) {
    console.error("🔥 SEARCH HASHTAGS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Hashtag search failed"
    });
  }
};


// =======================================
// 📌 GET POSTS BY HASHTAG (PRO-FIXED WITH STATS & ZERO FALLBACK)
// =======================================
export const getPostsByHashtag = async (req, res) => {
  try {
    const rawTag = req.query.hashtag || req.query.name || req.params.name;
    const currentUserId = req.user?.id;

    // 🔥 1. PAGINATION SETUP (Defaults to Page 1, 15 Posts per request)
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 15;
    const offset = (page - 1) * limit;

    if (!rawTag || !rawTag.trim()) {
      return res.status(400).json({ success: false, message: "Hashtag parameter is required" });
    }

    const cleanTagName = rawTag.replace(/^#/, "").trim().toLowerCase();
    
    // 🔥 2. SMART CACHING STRATEGY (Generic feed cache, user likes excluded from cache key)
    const cacheKey = `hashtag_feed:${cleanTagName}:page:${page}`;
    let formattedPosts = [];
    let totalPostsCount = 0;

    if (redisClient?.isReady) {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        const parsedCache = JSON.parse(cachedData);
        formattedPosts = parsedCache.posts;
        totalPostsCount = parsedCache.totalPostsCount;
      }
    }

    // 🚀 3. DATABASE FETCH (If not in cache)
    if (formattedPosts.length === 0) {
      const hashtag = await Hashtag.findOne({ where: { name: cleanTagName } });

      if (!hashtag) {
        return res.json({ success: true, hashtag: cleanTagName, totalPosts: 0, posts: [], page, hasMore: false });
      }

      totalPostsCount = hashtag.postsCount || 0;

      const usages = await HashtagUsage.findAll({
        where: { hashtagId: hashtag.id },
        limit,      // MNC Level: Sirf 15 posts layega
        offset,     // MNC Level: Next page ke liye skip karega
        order: [["createdAt", "DESC"]], // Sorted by newest
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
        ]
      });

      const rawPosts = usages.map(u => u.post).filter(Boolean);

      formattedPosts = rawPosts.map(post => {
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

      // Cache the generic result for 60 seconds
      if (redisClient?.isReady && formattedPosts.length > 0) {
        await redisClient.setEx(cacheKey, 60, JSON.stringify({ posts: formattedPosts, totalPostsCount }));
      }
    }

    // 🔥 4. INJECT LIKES (Fast O(1) Check for current user)
    const finalizedPosts = await injectIsLikedFlag(formattedPosts, currentUserId);

    return res.json({
      success: true,
      hashtag: cleanTagName,
      totalPosts: totalPostsCount,
      page,
      hasMore: finalizedPosts.length === limit, // FE dev ko batayega aur load karna hai ya nahi
      posts: finalizedPosts
    });

  } catch (error) {
    console.error("🔥 GET POSTS BY HASHTAG ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch hashtag posts" });
  }
};


// =======================================
// 🔥 TRENDING HASHTAGS
// =======================================
export const getTrendingHashtags = async (req, res) => {
  try {
    const hashtags = await Hashtag.findAll({
      order: [
        ["postsCount", "DESC"]
      ],
      limit: 20
    });

    return res.json({
      success: true,
      hashtags
    });

  } catch (error) {
    console.error("🔥 TRENDING HASHTAGS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch trends"
    });
  }
};