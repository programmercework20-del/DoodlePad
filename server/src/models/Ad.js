import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Ad = sequelize.define("Ad", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },

  advertiserName: {
    type: DataTypes.STRING,
    allowNull: false
  },

  advertiserEmail: {
    type: DataTypes.STRING,
    allowNull: true
  },

  title: {
    type: DataTypes.STRING,
    allowNull: false
  },

  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },

  imageUrl: {
    type: DataTypes.STRING,
    allowNull: false
  },

  redirectUrl: {
    type: DataTypes.TEXT,
    allowNull: true
  },

  buttonText: {
    type: DataTypes.STRING,
    defaultValue: "Learn More"
  },

  type: {
    type: DataTypes.ENUM("image", "video"),
    defaultValue: "image"
  },

  placement: {
    type: DataTypes.ENUM("feed", "story", "explore"),
    defaultValue: "feed"
  },

  priority: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },

  impressions: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },

  clicks: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },

  budget: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },

  startDate: {
    type: DataTypes.DATE,
    allowNull: true
  },

  endDate: {
    type: DataTypes.DATE,
    allowNull: true
  },

  status: {
    type: DataTypes.ENUM(
      "pending",
      "approved",
      "rejected",
      "active",
      "paused",
      "expired"
    ),
    defaultValue: "pending"
  }

}, {
  tableName: "ads",
  timestamps: true
});

export default Ad;