import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const ReelComment = sequelize.define("ReelComment", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },

  reelId: {
    type: DataTypes.UUID,
    allowNull: false,
  },

  userId: {
    type: DataTypes.UUID,
    allowNull: false,
  },

  type: {
    type: DataTypes.ENUM("text"),
    defaultValue: "text",
  },

  content: {
    type: DataTypes.TEXT,
    allowNull: false,
  },

  likesCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },

  status: {
    type: DataTypes.ENUM("active", "deleted"),
    defaultValue: "active",
  },

}, {
  tableName: "reel_comments",
  timestamps: true,
});

export default ReelComment;
