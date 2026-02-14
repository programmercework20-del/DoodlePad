 import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

// ================= IMPORT MODEL FACTORIES =================
import AdminModel from "./Admin.js";
import UserModel from "./User.js";
import PostModel from "./Post.js";
import CommentModel from "./Comment.js";
import ReportModel from "./Report.js";
import LiveModel from "./Live.js";
import MessageModel from "./Message.js";
import FollowerModel from "./Follower.js";
import CommentLikeModel from "./CommentLike.js";
import PostLikeModel from "./PostLike.js";
import ShareModel from "./Share.js";
import ReelModel from "./Reel.js";
import ReelCommentModel from "./ReelComment.js";
import ReelCommentLikeModel from "./ReelCommentLike.js";
import ReelShareModel from "./ReelShare.js";
import ReelLikeModel from "./ReelLike.js";
import ReelViewModel from "./ReelView.js";


// ================= INITIALIZE MODELS =================
const Admin = AdminModel(sequelize, DataTypes);
const User = UserModel(sequelize, DataTypes);
const Post = PostModel(sequelize, DataTypes);
const Comment = CommentModel(sequelize, DataTypes);
const Report = ReportModel(sequelize, DataTypes);
const Live = LiveModel(sequelize, DataTypes);
const Message = MessageModel(sequelize, DataTypes);
const Follower = FollowerModel(sequelize, DataTypes);
const CommentLike = CommentLikeModel(sequelize, DataTypes);
const PostLike = PostLikeModel(sequelize, DataTypes);
const Share = ShareModel(sequelize, DataTypes);
const Reel = ReelModel(sequelize, DataTypes);
const ReelComment = ReelCommentModel(sequelize, DataTypes);
const ReelCommentLike = ReelCommentLikeModel(sequelize, DataTypes);
const ReelShare = ReelShareModel(sequelize, DataTypes);
const ReelLike = ReelLikeModel(sequelize, DataTypes);
const ReelView = ReelViewModel(sequelize, DataTypes);


// 🔥 VERY IMPORTANT — REGISTER MODELS IN SEQUELIZE
sequelize.models.Admin = Admin;
sequelize.models.User = User;
sequelize.models.Post = Post;
sequelize.models.Comment = Comment;
sequelize.models.Report = Report;
sequelize.models.Live = Live;
sequelize.models.Message = Message;
sequelize.models.Follower = Follower;
sequelize.models.CommentLike = CommentLike;
sequelize.models.PostLike = PostLike;
sequelize.models.Share = Share;
sequelize.models.Reel = Reel;
sequelize.models.ReelComment = ReelComment;
sequelize.models.ReelCommentLike = ReelCommentLike;
sequelize.models.ReelShare = ReelShare;
sequelize.models.ReelLike = ReelLike;
sequelize.models.ReelView = ReelView;


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
// ================= FOLLOW SYSTEM ======================
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
// ================= POST SYSTEM ========================
// =====================================================
Post.belongsTo(User, { foreignKey: "userId", as: "author" });
Post.hasMany(Comment, { foreignKey: "postId", as: "comments" });

Comment.belongsTo(Post, { foreignKey: "postId", as: "post" });
Comment.belongsTo(User, { foreignKey: "userId", as: "user" });
Comment.hasMany(CommentLike, { foreignKey: "commentId", as: "likes" });

CommentLike.belongsTo(Comment, { foreignKey: "commentId", as: "comment" });
CommentLike.belongsTo(User, { foreignKey: "userId", as: "user" });


// =====================================================
// ================= ADMIN / REPORT =====================
// =====================================================
Report.belongsTo(User, { foreignKey: "reporterId", as: "reporter" });
Report.belongsTo(Admin, { foreignKey: "reviewedBy", as: "reviewer" });

Admin.hasMany(Report, { foreignKey: "reviewedBy", as: "reviewedReports" });
Admin.hasMany(Live, { foreignKey: "terminatedBy", as: "terminatedLives" });


// =====================================================
// ================= MESSAGE SYSTEM =====================
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
// ================= SHARE SYSTEM =======================
// =====================================================
User.hasMany(Share, { foreignKey: "userId", as: "shares" });
Post.hasMany(Share, { foreignKey: "postId", as: "shares" });

Share.belongsTo(User, { foreignKey: "userId", as: "sharedBy" });
Share.belongsTo(User, { foreignKey: "targetUserId", as: "sharedTo" });
Share.belongsTo(Post, { foreignKey: "postId", as: "post" });


// =====================================================
// ================= REELS SYSTEM =======================
// =====================================================
User.hasMany(Reel, { foreignKey: "userId", as: "reels" });
Reel.belongsTo(User, { foreignKey: "userId", as: "author" });

Reel.hasMany(ReelLike, { foreignKey: "reelId", as: "likes" });
User.hasMany(ReelLike, { foreignKey: "userId" });
ReelLike.belongsTo(Reel, { foreignKey: "reelId" });

Reel.hasMany(ReelComment, { foreignKey: "reelId", as: "comments" });
ReelComment.belongsTo(Reel, { foreignKey: "reelId", as: "reel" });
ReelComment.belongsTo(User, { foreignKey: "userId", as: "user" });
User.hasMany(ReelComment, { foreignKey: "userId", as: "reelComments" });

ReelCommentLike.belongsTo(ReelComment, { foreignKey: "commentId" });
ReelComment.hasMany(ReelCommentLike, { foreignKey: "commentId" });

User.hasMany(ReelShare, { foreignKey: "userId", as: "reelShares" });
Reel.hasMany(ReelShare, { foreignKey: "reelId", as: "shares" });
ReelShare.belongsTo(User, { foreignKey: "userId", as: "sharedBy" });
ReelShare.belongsTo(User, { foreignKey: "targetUserId", as: "sharedTo" });
ReelShare.belongsTo(Reel, { foreignKey: "reelId", as: "reel" });

Reel.hasMany(ReelView, { foreignKey: "reelId", as: "views" });
ReelView.belongsTo(Reel, { foreignKey: "reelId" });
User.hasMany(ReelView, { foreignKey: "userId", as: "watchedReels" });
ReelView.belongsTo(User, { foreignKey: "userId" });


// ================= EXPORT =================
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
  ReelView
};
