import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const ReelCommentLike = sequelize.define("ReelCommentLike", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },

  commentId: {
    type: DataTypes.UUID,
    allowNull: false,
  },

  userId: {
    type: DataTypes.UUID,
    allowNull: false,
  },

}, {
  tableName: "reel_comment_likes",
  timestamps: true,
});

export default ReelCommentLike;
