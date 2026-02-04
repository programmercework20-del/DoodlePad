import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const CommentLike = sequelize.define("CommentLike", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  commentId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: "comments",
      key: "id"
    }
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: "users",
      key: "id"
    }
  }
}, {
  tableName: "comment_likes",
  timestamps: true
});

export default CommentLike;
