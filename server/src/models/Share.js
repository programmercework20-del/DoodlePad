import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Share = sequelize.define("Share", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  postId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  targetUserId: {
    type: DataTypes.UUID,
    allowNull: true   // only for DM share
  },
  type: {
    type: DataTypes.ENUM("dm","story","external"),
    allowNull: false
  }
},{
  tableName: "shares",
  timestamps: true
});

export default Share;
