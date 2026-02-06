import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const StoryArchive = sequelize.define("StoryArchive", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: DataTypes.UUID,
  contentType: DataTypes.STRING,
  mediaUrl: DataTypes.TEXT,
  textContent: DataTypes.TEXT,
  createdAt: DataTypes.DATE,
  expiredAt: DataTypes.DATE
}, {
  tableName: "story_archives",
  timestamps: false
});

export default StoryArchive;
