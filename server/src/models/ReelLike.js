import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const ReelLike = sequelize.define("ReelLike", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: "user_id",
  },
  reelId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: "reel_id",
  },
}, {
  tableName: "reel_likes",
  timestamps: true,
  createdAt: "created_at",
  updatedAt: false,
});

export default ReelLike;
