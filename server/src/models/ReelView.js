import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const ReelView = sequelize.define("ReelView", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },

  reelId: {
    type: DataTypes.UUID,
    allowNull: false
  },

  userId: {
    type: DataTypes.UUID,
    allowNull: false
  },

  watchTime: {
    type: DataTypes.INTEGER, // seconds watched
    defaultValue: 0
  },

  completed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },

  rewatchCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },

  lastWatchedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }

},{
  tableName: "reel_views",
  timestamps: true
});

export default ReelView;
