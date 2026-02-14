import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const StoryReply = sequelize.define(
  "StoryReply",
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
    senderId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    receiverId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false
    }
  },
  {
    tableName: "story_replies",
    updatedAt: false
  }
);

export default StoryReply;
