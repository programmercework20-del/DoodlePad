import { Op } from "sequelize";
import Hashtag from "../../models/Hashtag.js";
import HashtagUsage from "../../models/HashtagUsage.js";
import Post from "../../models/Post.js";
import User from "../../models/User.js";

// 🔥 HELPER IMPORT FOR LIKES FLAG
import { injectIsLikedFlag } from "../../utils/postHelpers.js";

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

    if (!rawTag || !rawTag.trim()) {
      return res.status(400).json({
        success: false,
        message: "Hashtag parameter is required"
      });
    }

    // 1. Sanitize input (# hatao, lowercase karo)
    const cleanTagName = rawTag.replace(/^#/, "").trim().toLowerCase();

    const hashtag = await Hashtag.findOne({
      where: {
        name: cleanTagName
      }
    });

    // 🚨 ZERO FALLBACK RULE: Agar hashtag exist nahi karta, toh strict empty array do!
    if (!hashtag) {
      return res.json({
        success: true,
        hashtag: cleanTagName,
        totalPosts: 0,
        posts: []
      });
    }

    // 2. Fetch usages with complete Post + Author details
    const usages = await HashtagUsage.findAll({
      where: {
        hashtagId: hashtag.id
      },
      include: [
        {
          model: Post,
          as: "post",
          where: {
            status: "active"
          },
          include: [
            {
              model: User,
              as: "author",
              where: {
                isDeactivated: false
              },
              attributes: ["id", "name", "username", "profilePhoto", "isVerified"]
            }
          ]
        }
      ],
      order: [["post", "createdAt", "DESC"]]
    });

    // 3. Extract raw posts safely
    const rawPosts = usages.map(u => u.post).filter(Boolean);

    if (rawPosts.length === 0) {
      return res.json({
        success: true,
        hashtag: hashtag.name,
        totalPosts: 0,
        posts: []
      });
    }

    // 4. Format posts uniformly just like the Feed API (Ensuring likesCount, commentsCount exist)
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
        likesCount: post.likesCount || 0,         // ✅ Stats fixed
        commentsCount: post.commentsCount || 0,   // ✅ Stats fixed
        sharesCount: post.sharesCount || 0,
        user: post.author
      };
    });

    // 🔥 5. Inject isLiked flag safely using O(1) helper
    const finalizedPosts = await injectIsLikedFlag(formattedPosts, currentUserId);

    return res.json({
      success: true,
      hashtag: hashtag.name,
      totalPosts: hashtag.postsCount || finalizedPosts.length,
      posts: finalizedPosts
    });

  } catch (error) {
    console.error("🔥 GET POSTS BY HASHTAG ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch hashtag posts"
    });
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