 import sequelize from "../config/db.js";

// import models directly (NO factory calling)
import Admin from "./Admin.js";
import User from "./User.js";
import Post from "./Post.js";
import Comment from "./Comment.js";
import Report from "./Report.js";
import Live from "./Live.js";
import Message from "./Message.js";
import Follower from "./Follower.js";
import CommentLike from "./CommentLike.js";
import PostLike from "./PostLike.js";
import Share from "./Share.js";
import Reel from "./Reel.js";
import ReelComment from "./ReelComment.js";
import ReelCommentLike from "./ReelCommentLike.js";
import ReelShare from "./ReelShare.js";
import ReelLike from "./ReelLike.js";
import ReelView from "./ReelView.js";


// =====================================================
// ================= FOLLOW RELATION =====================
// =====================================================
User.belongsToMany(User, {
  through: Follower,
  as: "Following",
  foreignKey: "followerId",
  otherKey: "followingId",
});

User.belongsToMany(User, {
  through: Follower,
  as: "Followers",
  foreignKey: "followingId",
  otherKey: "followerId",
});


// =====================================================
// ================= USER RELATIONS =====================
// =====================================================
User.hasMany(Post, { foreignKey: "userId", as: "posts" });
User.hasMany(Comment, { foreignKey: "userId", as: "comments" });
User.hasMany(CommentLike, { foreignKey: "userId", as: "commentLikes" });
User.hasMany(Live, { foreignKey: "hostId", as: "liveStreams" });
User.hasMany(Message, { foreignKey: "senderId", as: "sentMessages" });
User.hasMany(Message, { foreignKey: "receiverId", as: "receivedMessages" });
User.hasMany(Report, { foreignKey: "reporterId", as: "reportsMade" });


// =====================================================
// ================= POST SYSTEM =========================
// =====================================================
Post.belongsTo(User, { foreignKey: "userId", as: "author" });
Post.hasMany(Comment, { foreignKey: "postId", as: "comments" });

Comment.belongsTo(Post, { foreignKey: "postId", as: "post" });
Comment.belongsTo(User, { foreignKey: "userId", as: "user" });
Comment.hasMany(CommentLike, { foreignKey: "commentId", as: "likes" });

CommentLike.belongsTo(Comment, { foreignKey: "commentId", as: "comment" });
CommentLike.belongsTo(User, { foreignKey: "userId", as: "user" });


// =====================================================
// ================= ADMIN ==============================
// =====================================================
Report.belongsTo(User, { foreignKey: "reporterId", as: "reporter" });
Report.belongsTo(Admin, { foreignKey: "reviewedBy", as: "reviewer" });

Admin.hasMany(Report, { foreignKey: "reviewedBy", as: "reviewedReports" });
Admin.hasMany(Live, { foreignKey: "terminatedBy", as: "terminatedLives" });


// =====================================================
// ================= MESSAGE ============================
// =====================================================
Message.belongsTo(User, { foreignKey: "senderId", as: "sender" });
Message.belongsTo(User, { foreignKey: "receiverId", as: "receiver" });


// =====================================================
// ================= POST LIKE ==========================
// =====================================================
Post.hasMany(PostLike, { foreignKey: "postId", as: "likes" });
User.hasMany(PostLike, { foreignKey: "userId", as: "likedPosts" });
PostLike.belongsTo(Post, { foreignKey: "postId", as: "post" });
PostLike.belongsTo(User, { foreignKey: "userId", as: "user" });


// =====================================================
// ================= SHARE ==============================
// =====================================================
User.hasMany(Share, { foreignKey: "userId", as: "shares" });
Post.hasMany(Share, { foreignKey: "postId", as: "shares" });

Share.belongsTo(User, { foreignKey: "userId", as: "sharedBy" });
Share.belongsTo(User, { foreignKey: "targetUserId", as: "sharedTo" });
Share.belongsTo(Post, { foreignKey: "postId", as: "post" });


// =====================================================
// ================= REELS ==============================
// =====================================================
User.hasMany(Reel, { foreignKey: "userId", as: "reels" });
Reel.belongsTo(User, { foreignKey: "userId", as: "author" });

Reel.hasMany(ReelLike, { foreignKey: "reelId", as: "likes" });
ReelLike.belongsTo(Reel, { foreignKey: "reelId" });
User.hasMany(ReelLike, { foreignKey: "userId" });

Reel.hasMany(ReelComment, { foreignKey: "reelId", as: "comments" });
ReelComment.belongsTo(Reel, { foreignKey: "reelId", as: "reel" });
ReelComment.belongsTo(User, { foreignKey: "userId", as: "user" });
User.hasMany(ReelComment, { foreignKey: "userId", as: "reelComments" });

ReelCommentLike.belongsTo(ReelComment, { foreignKey: "commentId" });
ReelComment.hasMany(ReelCommentLike, { foreignKey: "commentId" });

Reel.hasMany(ReelShare, { foreignKey: "reelId", as: "shares" });
ReelShare.belongsTo(Reel, { foreignKey: "reelId", as: "reel" });

Reel.hasMany(ReelView, { foreignKey: "reelId", as: "views" });
ReelView.belongsTo(Reel, { foreignKey: "reelId" });
User.hasMany(ReelView, { foreignKey: "userId", as: "watchedReels" });
ReelView.belongsTo(User, { foreignKey: "userId" });


// EXPORT
export {
  sequelize,
  Admin,
  User,
  Post,
  Comment,
  CommentLike,
  Report,
  Live,
  Message,
  Follower,
  PostLike,
  Share,
  Reel,
  ReelComment,
  ReelCommentLike,
  ReelShare,
  ReelLike,
  ReelView,
};
