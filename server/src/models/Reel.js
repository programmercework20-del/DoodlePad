import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Reel = sequelize.define(
  "Reel",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
    },

    videoUrl: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    thumbnailUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    caption: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // ⭐⭐⭐ THIS IS THE FIX ⭐⭐⭐
    duration: {
      type: DataTypes.INTEGER,   // must use DataTypes
      allowNull: false,
    },

    viewsCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },

    likesCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },

    commentsCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },

    sharesCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },

    status: {
      type: DataTypes.ENUM("active", "hidden", "deleted"),
      defaultValue: "active",
    },
  },
  {
    tableName: "reels",
    timestamps: true,
  }
);

export default Reel;
