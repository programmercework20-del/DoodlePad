import { Op } from "sequelize";
import Hashtag from "../../models/Hashtag.js";
import HashtagUsage from "../../models/HashtagUsage.js";
import Post from "../../models/Post.js";
import User from "../../models/User.js";

// 🔥 HELPER IMPORT
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
// 📌 GET POSTS BY HASHTAG (PRO-FIXED)
// =======================================

export const getPostsByHashtag = async (req, res) => {
  try {
    // 🔥 Support both Query Params (?hashtag=food / ?name=food) and Route Params (:name)
    const rawTag = req.query.hashtag || req.query.name || req.params.name;
    const currentUserId = req.user?.id;

    if (!rawTag || !rawTag.trim()) {
      return res.status(400).json({
        success: false,
        message: "Hashtag parameter is required"
      });
    }

    // 🔥 Sanitize input: remove '#' if present, trim, and lowercase for exact match
    const cleanTagName = rawTag.replace(/^#/, "").trim().toLowerCase();

    const hashtag = await Hashtag.findOne({
      where: {
        name: cleanTagName
      }
    });

    // Agar hashtag database me exist nahi karta, toh strict empty array do (No fallback!)
    if (!hashtag) {
      return res.json({
        success: true,
        hashtag: cleanTagName,
        totalPosts: 0,
        posts: []
      });
    }

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
              attributes: [
                "id",
                "username",
                "profilePhoto",
                "isVerified"
              ]
            }
          ]
        }
      ],
      order: [["post", "createdAt", "DESC"]]
    });

    // 1. Extract raw posts safely
    const rawPosts = usages.map(u => u.post).filter(Boolean);

    // 🔥 2. Inject isLiked flag O(1)
    const finalizedPosts = await injectIsLikedFlag(rawPosts, currentUserId);

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