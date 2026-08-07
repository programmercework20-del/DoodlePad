// import { Op, literal } from "sequelize";
// import Post from "../../models/Post.js";
// import User from "../../models/User.js";
// import Hashtag from "../../models/Hashtag.js";
// import HashtagUsage from "../../models/HashtagUsage.js";
// import Block from "../../models/Block.js";

// import { injectIsLikedFlag } from "../../utils/postHelpers.js";

// export const getExploreFeed = async (req, res) => {
//   try {
//     // 🔥 Optional chaining added to prevent any crash for public views
//     const userId = req.user?.id;

//     // ========================================
//     // BLOCKED USERS
//     // ========================================
//     const blocked = await Block.findAll({
//       where: {
//         [Op.or]: [
//           { blockerId: userId },
//           { blockedId: userId }
//         ]
//       }
//     });

//     const blockedIds = blocked.map(b =>
//       b.blockerId === userId ? b.blockedId : b.blockerId
//     );

//     // ========================================
//     // TRENDING POSTS
//     // ========================================
//     const trendingPosts = await Post.findAll({
//       where: {
//         status: "active",
//         userId: { [Op.notIn]: blockedIds },
//         [Op.or]: [
//           { isSaved: true },
//           { expiresAt: { [Op.gt]: new Date() } }
//         ]
//       },
//       include: [
//         {
//           model: User,
//           as: "author",
//           attributes: ["id", "name", "profilePhoto", "isVerified"],
//           where: { isPrivate: false, isDeactivated: false }
//         }
//       ],
//       attributes: {
//         include: [
//           [
//             literal(`
//               (
//                 ("Post"."likesCount" * 4) +
//                 ("Post"."commentsCount" * 6) +
//                 ("Post"."sharesCount" * 8)
//               )
//             `),
//             "score"
//           ]
//         ]
//       },
//       order: [
//         [literal(`score`), "DESC"],
//         ["createdAt", "DESC"]
//       ],
//       limit: 20
//     });

//     // ========================================
//     // TRENDING HASHTAGS
//     // ========================================
//     const hashtags = await Hashtag.findAll({
//       order: [["postsCount", "DESC"]],
//       limit: 5
//     });

//     // ========================================
//     // TRENDING HASHTAG POSTS
//     // ========================================
//     const trendingHashtagPosts = [];

//     for (const hashtag of hashtags) {
//       const usages = await HashtagUsage.findAll({
//         where: { hashtagId: hashtag.id },
//         include: [
//           {
//             model: Post,
//             as: "post",
//             where: {
//               status: "active",
//               userId: { [Op.notIn]: blockedIds }
//             },
//             include: [
//               {
//                 model: User,
//                 as: "author",
//                 attributes: ["id", "name", "profilePhoto", "isVerified"],
//                 where: { isPrivate: false, isDeactivated: false }
//               }
//             ]
//           }
//         ],
//         limit: 6
//       });

//       trendingHashtagPosts.push({
//         hashtag: hashtag.name,
//         postsCount: hashtag.postsCount,
//         posts: usages.filter(u => u.post).map(u => u.post)
//       });
//     }

//     // ========================================
//     // RECENT POSTS
//     // ========================================
//     const recentPosts = await Post.findAll({
//       where: {
//         status: "active",
//         userId: { [Op.notIn]: blockedIds }
//       },
//       include: [
//         {
//           model: User,
//           as: "author",
//           attributes: ["id", "name", "profilePhoto", "isVerified"],
//           where: { isPrivate: false, isDeactivated: false }
//         }
//       ],
//       order: [["createdAt", "DESC"]],
//       limit: 20
//     });

//     // ========================================
//     // SUGGESTED CREATORS
//     // ========================================
//     const suggestedCreators = await User.findAll({
//       where: {
//         isDeactivated: false,
//         id: { [Op.notIn]: [...blockedIds, userId] },
//         isPrivate: false,
//       },
//       attributes: ["id", "name", "profilePhoto", "isVerified"],
//       order: [
//         ["isVerified", "DESC"],
//         ["createdAt", "DESC"]
//       ],
//       limit: 10
//     });

//     // ========================================
//     // 🔥 FORMAT POSTS & DYNAMIC isLiked INJECTION
//     // ========================================
//     const formatPost = (post) => ({
//       id: post.id,
//       type: post.type,
//       caption: post.caption,
//       content: post.content,
//       mediaUrls: post.mediaUrls || [],
//       thumbnail: post.thumbnail || null,
//       duration: post.duration || 0,
//       createdAt: post.createdAt,
//       likesCount: post.likesCount || 0,
//       commentsCount: post.commentsCount || 0,
//       sharesCount: post.sharesCount || 0,
//       user: post.author
//     });

//     // 1. Format and inject into Trending Posts
//     const formattedTrendingPostsRaw = trendingPosts.map(formatPost);
//     const formattedTrendingPosts = await injectIsLikedFlag(formattedTrendingPostsRaw, userId);

//     // 2. Format and inject into Recent Posts
//     const formattedRecentPostsRaw = recentPosts.map(formatPost);
//     const formattedRecentPosts = await injectIsLikedFlag(formattedRecentPostsRaw, userId);

//     // 3. Format and inject into Hashtag Posts
//     const formattedTrendingHashtagPosts = await Promise.all(
//       trendingHashtagPosts.map(async (group) => ({
//         ...group,
//         posts: await injectIsLikedFlag(group.posts.map(formatPost), userId)
//       }))
//     );

//     // ========================================
//     // FINAL RESPONSE
//     // ========================================
//     return res.json({
//       success: true,
//       explore: {
//         trendingPosts: formattedTrendingPosts,
//         trendingHashtagPosts: formattedTrendingHashtagPosts,
//         recentPosts: formattedRecentPosts,
//         suggestedCreators
//       }
//     });

//   } catch (error) {
//     console.error("EXPLORE ERROR:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to load explore"
//     });
//   }
// };
import { Op, literal } from "sequelize";
import Post from "../../models/Post.js";
import User from "../../models/User.js";
import Hashtag from "../../models/Hashtag.js";
import HashtagUsage from "../../models/HashtagUsage.js";
import Block from "../../models/Block.js";
import { injectIsLikedFlag } from "../../utils/postHelpers.js";

export const getExploreFeed = async (req, res) => {
  try {
    const userId = req.user?.id;
    
    // 🚀 Pagination Logic
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const offset = (page - 1) * limit;

    // ========================================
    // 🛡️ SAFE BLOCKED USERS & SELF EXCLUSION
    // ========================================
    let blockedIds = [];
    if (userId) {
      const blocked = await Block.findAll({
        where: {
          [Op.or]: [{ blockerId: userId }, { blockedId: userId }]
        }
      });
      blockedIds = blocked.map(b => b.blockerId === userId ? b.blockedId : b.blockerId);
      
      // Pro-Tip: Users khud ki posts explore feed me nahi dekhna chahte
      blockedIds.push(userId); 
    }

    // 🚀 FIX: Prevent Op.notIn crash if blockedIds is empty
    const userExclusionCondition = blockedIds.length > 0 ? { [Op.notIn]: blockedIds } : undefined;

    // ========================================
    // 🔥 TRENDING POSTS (The Main Infinite Grid)
    // ========================================
    const trendingPosts = await Post.findAll({
      where: {
        status: "active",
        ...(userExclusionCondition && { userId: userExclusionCondition }),
        [Op.or]: [
          { isSaved: true },
          { expiresAt: { [Op.gt]: new Date() } }
        ]
      },
      include: [{
        model: User,
        as: "author",
        attributes: ["id", "name", "profilePhoto", "isVerified"],
        where: { isPrivate: false, isDeactivated: false }
      }],
      attributes: {
        include: [
          [
            literal(`(("Post"."likesCount" * 4) + ("Post"."commentsCount" * 6) + ("Post"."sharesCount" * 8))`),
            "score"
          ]
        ]
      },
      // Secondary sort added so equal scores fallback to newest
      order: [[literal(`score`), "DESC"], ["createdAt", "DESC"]],
      limit: limit,
      offset: offset 
    });

    // 🎲 THE SHUFFLE MAGIC (For Pull-To-Refresh Alive Feel)
    // Agar Page 1 hai, toh jin posts ka score 0 hai unko thoda shuffle kar do 
    // taaki user ko same boring grid bar-bar na dikhe
    if (page === 1 && trendingPosts.length > 0) {
      const engagedPosts = trendingPosts.filter(p => p.dataValues.score > 0);
      const zeroScorePosts = trendingPosts.filter(p => p.dataValues.score == 0);

      // Fisher-Yates Shuffle for zero-score posts
      for (let i = zeroScorePosts.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [zeroScorePosts[i], zeroScorePosts[j]] = [zeroScorePosts[j], zeroScorePosts[i]];
      }
      
      trendingPosts.length = 0; // Clear array
      trendingPosts.push(...engagedPosts, ...zeroScorePosts); // Re-combine
    }

    // ========================================
    // ⚡ PAGE 1 EXCLUSIVE DATA (Database Saver)
    // ========================================
    // Ye data sirf 1st page par load hoga, aage scroll karne par array empty jayega
    // Isse duplicate data nahi aayega aur server ki jaan bach jayegi.
    
    let recentPosts = [];
    let trendingHashtagPosts = [];
    let suggestedCreators = [];

    if (page === 1) {
      recentPosts = await Post.findAll({
        where: {
          status: "active",
          ...(userExclusionCondition && { userId: userExclusionCondition })
        },
        include: [{
          model: User,
          as: "author",
          attributes: ["id", "name", "profilePhoto", "isVerified"],
          where: { isPrivate: false, isDeactivated: false }
        }],
        order: [["createdAt", "DESC"]],
        limit: 10
      });

      const hashtags = await Hashtag.findAll({ order: [["postsCount", "DESC"]], limit: 5 });

      for (const hashtag of hashtags) {
        const usages = await HashtagUsage.findAll({
          where: { hashtagId: hashtag.id },
          include: [{
            model: Post,
            as: "post",
            where: { status: "active", ...(userExclusionCondition && { userId: userExclusionCondition }) },
            include: [{
              model: User,
              as: "author",
              attributes: ["id", "name", "profilePhoto", "isVerified"],
              where: { isPrivate: false, isDeactivated: false }
            }]
          }],
          limit: 6
        });
        
        trendingHashtagPosts.push({
          hashtag: hashtag.name,
          postsCount: hashtag.postsCount,
          posts: usages.filter(u => u.post).map(u => u.post)
        });
      }

      suggestedCreators = await User.findAll({
        where: {
          isDeactivated: false,
          ...(userExclusionCondition && { id: userExclusionCondition }),
          isPrivate: false,
        },
        attributes: ["id", "name", "profilePhoto", "isVerified"],
        order: [["isVerified", "DESC"], ["createdAt", "DESC"]],
        limit: 10
      });
    }

    // ========================================
    // FORMAT & INJECT IS_LIKED
    // ========================================
    const formatPost = (post) => ({
      id: post.id,
      type: post.type,
      caption: post.caption,
      content: post.content,
      mediaUrls: post.mediaUrls || [],
      thumbnail: post.thumbnail || null,
      duration: post.duration || 0,
      createdAt: post.createdAt,
      likesCount: post.likesCount || 0,
      commentsCount: post.commentsCount || 0,
      sharesCount: post.sharesCount || 0,
      user: post.author
    });

    const formattedTrendingPosts = await injectIsLikedFlag(trendingPosts.map(formatPost), userId);
    const formattedRecentPosts = await injectIsLikedFlag(recentPosts.map(formatPost), userId);
    
    const formattedTrendingHashtagPosts = page === 1 ? await Promise.all(
      trendingHashtagPosts.map(async (group) => ({
        ...group,
        posts: await injectIsLikedFlag(group.posts.map(formatPost), userId)
      }))
    ) : [];

    // 🚀 Check if more posts are available for Infinite Scroll
    const hasMore = trendingPosts.length === limit;

    // ========================================
    // FINAL RESPONSE
    // ========================================
    return res.json({
      success: true,
      explore: {
        trendingPosts: formattedTrendingPosts,
        recentPosts: formattedRecentPosts,
        trendingHashtagPosts: formattedTrendingHashtagPosts,
        suggestedCreators
      },
      pagination: {
        currentPage: page,
        hasMore: hasMore
      }
    });

  } catch (error) {
    console.error("EXPLORE ERROR:", error);
    res.status(500).json({ success: false, message: "Failed to load explore" });
  }
};