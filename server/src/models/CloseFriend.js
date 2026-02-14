import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const CloseFriend = sequelize.define(
  "CloseFriend",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    friendId: {
      type: DataTypes.UUID,
      allowNull: false
    }
  },
  {
    tableName: "close_friends",
    timestamps: true,
    updatedAt: false
  }
);

export default CloseFriend;
