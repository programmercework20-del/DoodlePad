import sequelize from '../config/db.js';

// Import all models
import Admin from './Admin.js';
import User from './User.js';
import Post from './Post.js';
import Comment from './Comment.js';
import Report from './Report.js';
import Live from './Live.js';
import Message from './Message.js';
import Follower from "./Follower.js";
import CommentLike from './CommentLike.js';
import PostLike from "./PostLike.js";
import Share from "./Share.js";


/* ================= USER RELATIONS ================= */
User.hasMany(Post, { foreignKey: "userId", as: "posts" });
User.hasMany(Comment, { foreignKey: "userId", as: "comments" });
User.hasMany(CommentLike, { foreignKey: "userId", as: "commentLikes" });

User.hasMany(Live, { foreignKey: "hostId", as: "liveStreams" });
User.hasMany(Message, { foreignKey: "senderId", as: "sentMessages" });
User.hasMany(Message, { foreignKey: "receiverId", as: "receivedMessages" });
User.hasMany(Report, { foreignKey: "reporterId", as: "reportsMade" });

/* ================= POST RELATIONS ================= */
Post.belongsTo(User, {
  foreignKey: "userId",
  as: "author"
});
Post.hasMany(Comment, { foreignKey: "postId", as: "comments" });

/* ================= COMMENT RELATIONS ================= */
Comment.belongsTo(Post, { foreignKey: "postId", as: "post" });
Comment.belongsTo(User, { foreignKey: "userId", as: "user" });
Comment.hasMany(CommentLike, { foreignKey: "commentId", as: "likes" });

/* ================= COMMENT LIKE RELATIONS ================= */
CommentLike.belongsTo(Comment, { foreignKey: "commentId", as: "comment" });
CommentLike.belongsTo(User, { foreignKey: "userId", as: "user" });

/* ================= REPORT RELATIONS ================= */
Report.belongsTo(User, { foreignKey: "reporterId", as: "reporter" });
Report.belongsTo(Admin, { foreignKey: "reviewedBy", as: "reviewer" });

/* ================= LIVE RELATIONS ================= */
Live.belongsTo(User, { foreignKey: "hostId", as: "host" });
Live.belongsTo(Admin, { foreignKey: "terminatedBy", as: "terminator" });

/* ================= MESSAGE RELATIONS ================= */
Message.belongsTo(User, { foreignKey: "senderId", as: "sender" });
Message.belongsTo(User, { foreignKey: "receiverId", as: "receiver" });

/* ================= ADMIN RELATIONS ================= */
Admin.hasMany(Report, { foreignKey: "reviewedBy", as: "reviewedReports" });
Admin.hasMany(Live, { foreignKey: "terminatedBy", as: "terminatedLives" });

//follower assciations 


User.belongsToMany(User, {
  through: Follower,
  as: "followers",
  foreignKey: "following_id",
  otherKey: "follower_id"
});

User.belongsToMany(User, {
  through: Follower,
  as: "following",
  foreignKey: "follower_id",
  otherKey: "following_id"
});

Follower.belongsTo(User, {
  foreignKey: "follower_id",
  as: "follower"
});

Follower.belongsTo(User, {
  foreignKey: "following_id",
  as: "following"
});

/* POST LIKE RELATIONS */
Post.hasMany(PostLike, { foreignKey: "postId", as: "likes" });
User.hasMany(PostLike, { foreignKey: "userId", as: "likedPosts" });

PostLike.belongsTo(Post, { foreignKey: "postId", as: "post" });
PostLike.belongsTo(User, { foreignKey: "userId", as: "user" });




/* ===== SHARE RELATIONS ===== */
User.hasMany(Share, { foreignKey: "userId", as: "shares" });
Post.hasMany(Share, { foreignKey: "postId", as: "shares" });

Share.belongsTo(User, { foreignKey: "userId", as: "sharedBy" });
Share.belongsTo(User, { foreignKey: "targetUserId", as: "sharedTo" });
Share.belongsTo(Post, { foreignKey: "postId", as: "post" });




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
  Share
};
