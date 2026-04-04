import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const DoodleRequest = sequelize.define("DoodleRequest", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },

  senderId: {
    type: DataTypes.UUID,
    allowNull: false
  },

  receiverId: {
    type: DataTypes.UUID,
    allowNull: false
  },

  doodleImage: {
    type: DataTypes.STRING,
    allowNull: false
  },

  status: {
    type: DataTypes.ENUM("pending", "accepted", "rejected"),
    defaultValue: "pending"
  }

}, {
  tableName: "doodle_requests",
  timestamps: true
});

export default DoodleRequest;