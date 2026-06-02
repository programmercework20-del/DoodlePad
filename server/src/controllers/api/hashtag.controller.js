import { Op } from "sequelize";
import Hashtag from "../../models/Hashtag.js";
import HashtagUsage from "../../models/HashtagUsage.js";
import Post from "../../models/Post.js";
import User from "../../models/User.js";

// 🔥 HELPER IMPORT (Ye isLiked flag lagayega)
import { injectIsLikedFlag } from "../../utils/postHelpers.js";

// =======================================
// 🔍 SEARCH HASHTAGS
// =======================================

export const searchHashtags = async (req, res) => {
  try {
    const query = req.query.q?.replace("#", "") || "";

    if (!query.trim()) {
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
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Hashtag search failed"
    });
  }
};


// =======================================
// 📌 GET POSTS BY HASHTAG (Updated with isLiked)
// =======================================

export const getPostsByHashtag = async (req, res) => {
  try {
    const { name } = req.params;
    const currentUserId = req.user?.id; // 🔥 Current user ID safely nikali (optional chaining ke sath)

    const hashtag = await Hashtag.findOne({
      where: {
        name: name.toLowerCase()
      }
    });

    if (!hashtag) {
      return res.status(404).json({
        success: false,
        message: "Hashtag not found"
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
      // ✅ FIXED
      order: [["post", "createdAt", "DESC"]]
    });

    // 1. Raw posts nikal liye
    const rawPosts = usages.map(u => u.post);

    // 🔥 2. MAGIC: isLiked flag inject kiya O(1) query mein
    const finalizedPosts = await injectIsLikedFlag(rawPosts, currentUserId);

    return res.json({
      success: true,
      hashtag: hashtag.name,
      totalPosts: hashtag.postsCount,
      posts: finalizedPosts // 🔥 Updated posts frontend ko bhej diye
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
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
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch trends"
    });
  }
};