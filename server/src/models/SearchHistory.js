import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const SearchHistory = sequelize.define(
  "SearchHistory",
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

    keyword: {
      type: DataTypes.STRING,
      allowNull: false
    }
  },
  {
    tableName: "search_history",

    // 🔥 THIS IS THE FIX
    createdAt: "createdat",
    updatedAt: "updatedat",
    timestamps: true
  }
);

export default SearchHistory;
