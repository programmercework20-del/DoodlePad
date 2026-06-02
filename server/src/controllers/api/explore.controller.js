import { Op, literal } from "sequelize";
import Post from "../../models/Post.js";
import User from "../../models/User.js";
import Hashtag from "../../models/Hashtag.js";
import HashtagUsage from "../../models/HashtagUsage.js";
import Block from "../../models/Block.js";

// 🔥 HELPER IMPORT (Ye add karna zaroori hai)
import { injectIsLikedFlag } from "../../utils/postHelpers.js";

export const getExploreFeed = async (req, res) => {
  try {
    // 🔥 Optional chaining added to prevent any crash for public views
    const userId = req.user?.id;

    // ========================================
    // BLOCKED USERS
    // ========================================
    const blocked = await Block.findAll({
      where: {
        [Op.or]: [
          { blockerId: userId },
          { blockedId: userId }
        ]
      }
    });

    const blockedIds = blocked.map(b =>
      b.blockerId === userId ? b.blockedId : b.blockerId
    );

    // ========================================
    // TRENDING POSTS
    // ========================================
    const trendingPosts = await Post.findAll({
      where: {
        status: "active",
        userId: { [Op.notIn]: blockedIds },
        [Op.or]: [
          { isSaved: true },
          { expiresAt: { [Op.gt]: new Date() } }
        ]
      },
      include: [
        {
          model: User,
          as: "author",
          attributes: ["id", "username", "profilePhoto", "isVerified"],
          where: { isPrivate: false, isDeactivated: false }
        }
      ],
      attributes: {
        include: [
          [
            literal(`
              (
                ("Post"."likesCount" * 4) +
                ("Post"."commentsCount" * 6) +
                ("Post"."sharesCount" * 8)
              )
            `),
            "score"
          ]
        ]
      },
      order: [
        [literal(`score`), "DESC"],
        ["createdAt", "DESC"]
      ],
      limit: 20
    });

    // ========================================
    // TRENDING HASHTAGS
    // ========================================
    const hashtags = await Hashtag.findAll({
      order: [["postsCount", "DESC"]],
      limit: 5
    });

    // ========================================
    // TRENDING HASHTAG POSTS
    // ========================================
    const trendingHashtagPosts = [];

    for (const hashtag of hashtags) {
      const usages = await HashtagUsage.findAll({
        where: { hashtagId: hashtag.id },
        include: [
          {
            model: Post,
            as: "post",
            where: {
              status: "active",
              userId: { [Op.notIn]: blockedIds }
            },
            include: [
              {
                model: User,
                as: "author",
                attributes: ["id", "username", "profilePhoto", "isVerified"],
                where: { isPrivate: false, isDeactivated: false }
              }
            ]
          }
        ],
        limit: 6
      });

      trendingHashtagPosts.push({
        hashtag: hashtag.name,
        postsCount: hashtag.postsCount,
        posts: usages.filter(u => u.post).map(u => u.post)
      });
    }

    // ========================================
    // RECENT POSTS
    // ========================================
    const recentPosts = await Post.findAll({
      where: {
        status: "active",
        userId: { [Op.notIn]: blockedIds }
      },
      include: [
        {
          model: User,
          as: "author",
          attributes: ["id", "username", "profilePhoto", "isVerified"],
          where: { isPrivate: false, isDeactivated: false }
        }
      ],
      order: [["createdAt", "DESC"]],
      limit: 20
    });

    // ========================================
    // SUGGESTED CREATORS
    // ========================================
    const suggestedCreators = await User.findAll({
      where: {
        isDeactivated: false,
        id: { [Op.notIn]: [...blockedIds, userId] },
        isPrivate: false,
      },
      attributes: ["id", "username", "name", "profilePhoto", "isVerified"],
      order: [
        ["isVerified", "DESC"],
        ["createdAt", "DESC"]
      ],
      limit: 10
    });

    // ========================================
    // 🔥 DYNAMIC isLiked INJECTION FOR ALL ARRAYS
    // ========================================

    // 1. Inject into Trending Posts
    const formattedTrendingPosts = await injectIsLikedFlag(trendingPosts, userId);
    
    // 2. Inject into Recent Posts
    const formattedRecentPosts = await injectIsLikedFlag(recentPosts, userId);

    // 3. Inject into Hashtag Posts (Iterate over hashtag groups and inject into their inner posts arrays)
    const formattedTrendingHashtagPosts = await Promise.all(
      trendingHashtagPosts.map(async (group) => ({
        ...group,
        posts: await injectIsLikedFlag(group.posts, userId)
      }))
    );

    // ========================================
    // FINAL RESPONSE
    // ========================================
    return res.json({
      success: true,
      explore: {
        trendingPosts: formattedTrendingPosts,
        trendingHashtagPosts: formattedTrendingHashtagPosts,
        recentPosts: formattedRecentPosts,
        suggestedCreators
      }
    });

  } catch (error) {
    console.error("EXPLORE ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load explore"
    });
  }
};