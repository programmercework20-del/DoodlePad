import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const StoryView = sequelize.define("StoryView", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  storyId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  viewerId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  seenAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: "story_views",
  timestamps: false
});

export default StoryView;
