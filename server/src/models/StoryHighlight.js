import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const StoryHighlight = sequelize.define("StoryHighlight", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: DataTypes.UUID,
  title: DataTypes.STRING,
  coverImage: DataTypes.TEXT
}, {
  tableName: "story_highlights",
  timestamps: true
});

export default StoryHighlight;
