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
import Notification from "./Notification.js";
import Conversation from "./Conversation.js";
import ConversationParticipant from "./ConversationParticipant.js";
import DoodleRequest from "./DoodleRequest.js";


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
// ================= USER ↔ POST =================
Post.belongsTo(User, {
  foreignKey: "userId",
  as: "author"
});

// ================= POST ↔ COMMENT =================
Post.hasMany(Comment, {
  foreignKey: "postId",
  as: "comments"
});

Comment.belongsTo(Post, {
  foreignKey: "postId",
  as: "post"   // ✅ keep ONLY ONE
});

// ================= COMMENT ↔ USER =================
Comment.belongsTo(User, {
  foreignKey: "userId",
  as: "user"
});

// ================= COMMENT SELF (REPLIES) =================
Comment.hasMany(Comment, {
  foreignKey: "parentId",
  as: "replies"
});

Comment.belongsTo(Comment, {
  foreignKey: "parentId",
  as: "parent"
});

// ================= COMMENT LIKE =================
Comment.hasMany(CommentLike, {
  foreignKey: "commentId",
  as: "likes"
});

CommentLike.belongsTo(Comment, {
  foreignKey: "commentId",
  as: "comment"
});

CommentLike.belongsTo(User, {
  foreignKey: "userId",
  as: "user"
});

// ================= POST LIKE =================
Post.hasMany(PostLike, {
  foreignKey: "postId",
  as: "postLikes"
});

PostLike.belongsTo(Post, {
  foreignKey: "postId",
  as: "post"   // ✅ safe now (unique usage)
});

PostLike.belongsTo(User, {
  foreignKey: "userId",
  as: "user"
});

User.hasMany(PostLike, {
  foreignKey: "userId",
  as: "likedPosts"
});

// ================= SHARE =================
Post.hasMany(Share, {
  foreignKey: "postId",
  as: "shares"
});

User.hasMany(Share, {
  foreignKey: "userId",
  as: "shares"
});

// POST → SHARE
Share.belongsTo(Post, {
  foreignKey: "postId",
  onDelete: "CASCADE"
});
Share.belongsTo(User, {
  foreignKey: "userId",
  as: "sharedBy"
});

Share.belongsTo(User, {
  foreignKey: "targetUserId",
  as: "sharedTo"
});

// =====================================================
// ================= MESSAGE ==============================
// =====================================================

// Conversation ↔ Participants
Conversation.hasMany(ConversationParticipant, {
  foreignKey: "conversationId",
  as: "participants"
});

ConversationParticipant.belongsTo(Conversation, {
  foreignKey: "conversationId"
});

User.hasMany(ConversationParticipant, {
  foreignKey: "userId",
  as: "userConversations"
});

// Conversation ↔ Messages
Conversation.hasMany(Message, {
  foreignKey: "conversationId",
  as: "messages"
});

Message.belongsTo(Conversation, {
  foreignKey: "conversationId"
});


ConversationParticipant.belongsTo(User, {
  foreignKey: "userId",
  as: "user"
});

// models/index.js mein aisi line honi chahiye:
DoodleRequest.belongsTo(User, { as: 'sender', foreignKey: 'senderId' });



// =====================================================
// ================= ADMIN ==============================
// =====================================================
Report.belongsTo(User, { foreignKey: "reporterId", as: "reporter" });
Report.belongsTo(Admin, { foreignKey: "reviewedBy", as: "reviewer" });

Admin.hasMany(Report, { foreignKey: "reviewedBy", as: "reviewedReports" });
Admin.hasMany(Live, { foreignKey: "terminatedBy", as: "terminatedLives" });




// relations
Notification.belongsTo(User, { as: "sender", foreignKey: "senderId" });
Notification.belongsTo(Post, {
  foreignKey: "postId",
  onDelete: "CASCADE"
});
Notification.belongsTo(Comment, { foreignKey: "commentId" });

User.hasMany(Notification, { foreignKey: "receiverId", as: "notifications" });



// =====================================================
// ================= MESSAGE ============================
// =====================================================
Message.belongsTo(User, { foreignKey: "senderId", as: "sender" });
Message.belongsTo(User, { foreignKey: "receiverId", as: "receiver" });

Message.belongsTo(Post, {
  foreignKey: "postId",
  as: "post"   // ✅ THIS MUST MATCH
});

Post.hasMany(Message, {
  foreignKey: "postId",
  as: "messages"
});
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
  DoodleRequest,
  Notification,
  Conversation,              // ✅ ADD THIS
  ConversationParticipant 
};