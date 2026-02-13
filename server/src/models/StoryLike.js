import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const StoryLike = sequelize.define(
  "StoryLike",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    storyId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false
    }
  },
  {
    tableName: "story_likes",
    updatedAt: false
  }
);

export default StoryLike;
