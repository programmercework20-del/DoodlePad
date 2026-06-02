import CommentLike from "../models/CommentLike.js"; 
import { Op } from "sequelize";

export const injectCommentIsLikedFlag = async (comments, userId) => {
  // 1. Agar array null/empty hai toh wapas bhej do
  if (!comments) return comments;

  const isSingleObject = !Array.isArray(comments);
  const commentsArray = isSingleObject ? [comments] : comments;
  if (commentsArray.length === 0) return comments;

  let likedSet = new Set();

  // 2. Agar user logged in hai (userId hai), tabhi DB se likes nikalenge
  if (userId) {
    const commentIds = [];
    commentsArray.forEach(c => {
      commentIds.push(c.id || c._previousDataValues?.id);
      if (c.replies && Array.isArray(c.replies)) {
        c.replies.forEach(r => commentIds.push(r.id || r._previousDataValues?.id));
      }
    });

    if (commentIds.length > 0) {
      const userLikes = await CommentLike.findAll({
        where: { userId, commentId: { [Op.in]: commentIds } },
        attributes: ["commentId"],
        raw: true
      });
      likedSet = new Set(userLikes.map(like => like.commentId));
    }
  }

  // 3. 🔥 GUARANTEE: Har comment aur reply me isLiked zaroor add hoga
  const formattedComments = commentsArray.map(comment => {
    // Copy the object safely
    const commentJson = typeof comment.get === "function" ? comment.get({ plain: true }) : { ...comment };
    
    // Add isLiked to main comment
    commentJson.isLiked = likedSet.has(commentJson.id);

    // Add isLiked to nested replies
    if (commentJson.replies && Array.isArray(commentJson.replies)) {
      commentJson.replies = commentJson.replies.map(reply => {
        const replyJson = typeof reply.get === "function" ? reply.get({ plain: true }) : { ...reply };
        replyJson.isLiked = likedSet.has(replyJson.id);
        return replyJson;
      });
    }

    return commentJson;
  });

  return isSingleObject ? formattedComments[0] : formattedComments;
};