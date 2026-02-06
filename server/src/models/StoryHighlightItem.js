import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const StoryHighlightItem = sequelize.define("StoryHighlightItem", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  highlightId: DataTypes.UUID,
  archiveStoryId: DataTypes.UUID
}, {
  tableName: "story_highlight_items",
  timestamps: false
});

export default StoryHighlightItem;
