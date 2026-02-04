import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Follower = sequelize.define("Follower", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  follower_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  following_id: {
    type: DataTypes.UUID,
    allowNull: false
  }, 
}, {
    tableName: "followers",
    timestamps: true,
    updatedAt: false,
    // 🔥 VERY IMPORTANT PART
   createdAt: "created_at",
   updatedAt: false
});

export default Follower;
