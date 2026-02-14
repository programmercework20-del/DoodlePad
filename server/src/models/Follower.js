import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Follower = sequelize.define("Follower", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },

  followerId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: "follower_id"   // 🔥 map DB column
  },

  followingId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: "following_id"  // 🔥 map DB column
  },
    status: {
    type: DataTypes.STRING,
    defaultValue: "accepted"
  }

},{
  tableName:"followers",
  timestamps:true,
  createdAt:"created_at",
  updatedAt:false
});

export default Follower;
