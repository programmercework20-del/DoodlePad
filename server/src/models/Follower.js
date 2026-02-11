import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Follower = sequelize.define("Follower", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },

  // 👇 camelCase in code
  followerId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: "follower_id"   // 👈 maps to DB
  },

  followingId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: "following_id"  // 👈 maps to DB
  },

}, {
  tableName: "followers",
  timestamps: true,
  createdAt: "created_at",
  updatedAt: false
});

export default Follower;
