import PostLike from "../models/PostLike.js";
import { Op } from "sequelize";

/**
 * Array of posts ya single post me isLiked flag inject karta hai dynamically.
 * @param {Array|Object} posts - Sequelize post instances ya plain objects
 * @param {string} userId - Current logged in user ID
 * @returns {Promise<Array|Object>} - Posts with isLiked property included
 */
export const injectIsLikedFlag = async (posts, userId) => {
  if (!posts || !userId) return posts;

  // Check agar single object pass hua hai, toh use array me convert karo temporary
  const isSingleObject = !Array.isArray(posts);
  const postsArray = isSingleObject ? [posts] : posts;

  if (postsArray.length === 0) return posts;

  // Sabhi post IDs nikal lo
  const postIds = postsArray.map(post => post.id || post._previousDataValues?.id);

  // Database se ek hi query me check karo ki is user ne inme se kis kis ko like kiya hai
  const userLikes = await PostLike.findAll({
    where: {
      userId,
      postId: { [Op.in]: postIds }
    },
    attributes: ["postId"],
    raw: true
  });

  // Liked post IDs ka ek Set bana lo (Set se search O(1) fast hoti hai)
  const likedPostIdsSet = new Set(userLikes.map(like => like.postId));

  // Map karke isLiked key root level par inject karo
  const formattedPosts = postsArray.map(post => {
    // Agar sequelize instance hai toh plain JSON object me convert karo
    const postJson = typeof post.get === "function" ? post.get({ plain: true }) : { ...post };
    
    return {
      ...postJson,
      isLiked: likedPostIdsSet.has(postJson.id)
    };
  });

  return isSingleObject ? formattedPosts[0] : formattedPosts;
};