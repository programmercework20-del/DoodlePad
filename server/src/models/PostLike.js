import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const PostLike = sequelize.define("PostLike", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  postId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: "posts",
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
  tableName: "post_likes",
  timestamps: true,
  updatedAt: false
});

export default PostLike;
