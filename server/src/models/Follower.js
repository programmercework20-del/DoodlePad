import { Model, DataTypes } from "sequelize";
import sequelize from "../config/db.js";

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
      field: "followerId",
    },

    followingId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "followingId",
    },

    createdAt: {
      type: DataTypes.DATE,
      field: "createdAt",
    },
  },
  {
    sequelize,
    modelName: "Follower",
    tableName: "followers",
    timestamps: true,
    updatedAt: false,
  }
);

export default Follower;
