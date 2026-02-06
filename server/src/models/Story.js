import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Story = sequelize.define("Story", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  contentType: {
    type: DataTypes.STRING,
    allowNull: false
  },
  mediaUrl: {
    type: DataTypes.TEXT
  },
  textContent: {
    type: DataTypes.TEXT
  },
  expiresAt: {
    type: DataTypes.DATE
  }
}, {
  tableName: "stories",
  timestamps: true
});

export default Story;
