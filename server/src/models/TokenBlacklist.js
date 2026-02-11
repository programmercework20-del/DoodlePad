import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const TokenBlacklist = sequelize.define("TokenBlacklist", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },

  token: {
    type: DataTypes.TEXT,
    allowNull: false,
  },

  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
  }

}, {
  tableName: "token_blacklist",
  timestamps: true
});

export default TokenBlacklist;
