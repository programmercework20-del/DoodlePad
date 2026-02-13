import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const StoryShare = sequelize.define(
  "StoryShare",
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
    token: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false
    }
  },
  {
    tableName: "story_shares",
    updatedAt: false
  }
);

export default StoryShare;
