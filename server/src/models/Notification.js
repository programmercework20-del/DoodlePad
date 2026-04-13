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
      "DOODLE_REQUEST",
      "DOODLE_ACCEPTED"
    ),
    allowNull: false
  },

  postId: DataTypes.UUID,
  commentId: DataTypes.UUID,
  doodleRequestId: DataTypes.UUID,

  isRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }

}, {
  tableName: "notifications",
  timestamps: true
});

export default Notification;