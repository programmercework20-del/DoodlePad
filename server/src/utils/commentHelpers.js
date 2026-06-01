import CommentLike from "../models/CommentLike.js"; // 🔥 Apne model ka sahi naam check kar lena
import { Op } from "sequelize";

export const injectCommentIsLikedFlag = async (comments, userId) => {
  if (!comments || !userId) return comments;

  const isSingleObject = !Array.isArray(comments);
  const commentsArray = isSingleObject ? [comments] : comments;
  if (commentsArray.length === 0) return comments;

  // 1. Extract IDs from main comments AND nested replies
  const commentIds = [];
  commentsArray.forEach(c => {
    commentIds.push(c.id || c._previousDataValues?.id);
    if (c.replies && Array.isArray(c.replies)) {
      c.replies.forEach(r => commentIds.push(r.id || r._previousDataValues?.id));
    }
  });

  // 2. Database query in one shot for all IDs
  const userLikes = await CommentLike.findAll({
    where: { userId, commentId: { [Op.in]: commentIds } },
    attributes: ["commentId"],
    raw: true
  });

  const likedSet = new Set(userLikes.map(like => like.commentId));

  // 3. Inject isLiked flag deeply into comments and replies
  const formattedComments = commentsArray.map(comment => {
    const commentJson = typeof comment.get === "function" ? comment.get({ plain: true }) : { ...comment };
    commentJson.isLiked = likedSet.has(commentJson.id);

    // Agar is comment ke replies hain, toh unme bhi inject karo
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