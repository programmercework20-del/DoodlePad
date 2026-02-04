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


/* ================= USER RELATIONS ================= */
User.hasMany(Post, { foreignKey: "userId", as: "posts" });
User.hasMany(Comment, { foreignKey: "userId", as: "comments" });
User.hasMany(CommentLike, { foreignKey: "userId", as: "commentLikes" });

User.hasMany(Live, { foreignKey: "hostId", as: "liveStreams" });
User.hasMany(Message, { foreignKey: "senderId", as: "sentMessages" });
User.hasMany(Message, { foreignKey: "receiverId", as: "receivedMessages" });
User.hasMany(Report, { foreignKey: "reporterId", as: "reportsMade" });

/* ================= POST RELATIONS ================= */
Post.belongsTo(User, { foreignKey: "userId", as: "author" });
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

export {
  sequelize,
  Admin,
  User,
  Post,
  Comment,
  CommentLike,
  Report,
  Live,
  Message
};
