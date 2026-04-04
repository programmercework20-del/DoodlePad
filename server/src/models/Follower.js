import { Model, DataTypes } from "sequelize";
import sequelize from "../config/db.js";
import User from "./User.js";

class Follower extends Model {}

Follower.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },

    followerId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    followingId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    status: {
      type: DataTypes.ENUM("pending", "accepted", "rejected"),
      defaultValue: "pending"
    }
  },
  {
    sequelize,
    modelName: "Follower",
    tableName: "followers",
    timestamps: true,
    updatedAt: false,
  }
);

// 🔥 IMPORTANT RELATIONS
Follower.belongsTo(User, {
  foreignKey: "followerId",
  as: "follower"
});

Follower.belongsTo(User, {
  foreignKey: "followingId",
  as: "following"
});

export default Follower;