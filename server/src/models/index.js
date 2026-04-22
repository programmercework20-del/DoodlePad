import sequelize from '../config/db.js';

// Import all models
import Admin from './Admin.js';
import User from './User.js';
import Post from './Post.js';
import Comment from './Comment.js';
import Report from './Report.js';
import Live from './Live.js';
import Message from './Message.js';
import Ad from './Ad.js';
import Payment from './Payment.js';

// Define associations

// User associations
User.hasMany(Post, { foreignKey: "userId", as: "posts" });
User.hasMany(Comment, { foreignKey: "userId", as: "comments" });
User.hasMany(Live, { foreignKey: "hostId", as: "liveStreams" });
User.hasMany(Message, { foreignKey: "senderId", as: "sentMessages" });
User.hasMany(Message, { foreignKey: "receiverId", as: "receivedMessages" });
User.hasMany(Report, { foreignKey: "reporterId", as: "reportsMade" });

// Post associations
Post.belongsTo(User, { foreignKey: "userId", as: "author" });
Post.hasMany(Comment, { foreignKey: "postId", as: "comments" });

// Comment associations
Comment.belongsTo(Post, { foreignKey: "postId", as: "post" });
Comment.belongsTo(User, { foreignKey: "userId", as: "author" });

// Report associations
Report.belongsTo(User, { foreignKey: "reporterId", as: "reporter" });
Report.belongsTo(Admin, { foreignKey: "reviewedBy", as: "reviewer" });

// Live associations
Live.belongsTo(User, { foreignKey: "hostId", as: "host" });
Live.belongsTo(Admin, { foreignKey: "terminatedBy", as: "terminator" });

// Message associations
Message.belongsTo(User, { foreignKey: "senderId", as: "sender" });
Message.belongsTo(User, { foreignKey: "receiverId", as: "receiver" });

// Advertisement associations
Ad.hasMany(Payment, { foreignKey: 'adId', as: 'payments', onDelete: 'CASCADE' });
Payment.belongsTo(Ad, { foreignKey: 'adId', as: 'ad' });

// Admin associations
Admin.hasMany(Report, { foreignKey: "reviewedBy", as: "reviewedReports" });
Admin.hasMany(Live, { foreignKey: "terminatedBy", as: "terminatedLives" });

export {
    sequelize,
    Admin,
    User,
    Post,
    Comment,
    Report,
    Live,
    Message,
    Ad,
    Payment
};
