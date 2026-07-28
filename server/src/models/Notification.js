import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Notification = sequelize.define("Notification", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },

  senderId: {
    type: DataTypes.UUID,
    allowNull: false
  },

  receiverId: {
    type: DataTypes.UUID,
    allowNull: false
  },

  type: {
    type: DataTypes.ENUM(
      "LIKE_POST",
      "COMMENT_POST",
      "REPLY_COMMENT",
      "LIKE_COMMENT",
      "FOLLOW_REQUEST",
      "FOLLOW_ACCEPTED",
      "DOODLE_REQUEST",
      "DOODLE_ACCEPTED",
      "MESSAGE"
    ),
    allowNull: false
  },

  postId: DataTypes.UUID,
  commentId: DataTypes.UUID,
  doodleRequestId: DataTypes.UUID,

  conversationId: {
    type: DataTypes.UUID,
    allowNull: true
  },

  messagePreview: {
    type: DataTypes.STRING(150),
    allowNull: true
  },

  isRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }

}, {
  tableName: "notifications",
  timestamps: true
});

export default Notification;