import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const StoryReaction = sequelize.define(
  "StoryReaction",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    storyId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    type: {
      type: DataTypes.ENUM("emoji", "text", "image", "audio", "doodle"),
      allowNull: false
    },
    content: {
      type: DataTypes.TEXT
    }
  },
  {
    tableName: "story_reactions",
    updatedAt: false
  }
);

export default StoryReaction;
