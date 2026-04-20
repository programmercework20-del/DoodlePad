
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
    allowNull: true
  },

  status: {
    type: DataTypes.ENUM("pending", "accepted", "rejected"),
    allowNull: true
  },
  
  doodleData: {
    // Use DataTypes.TEXT for long strings or DataTypes.JSON for objects
    type: DataTypes.TEXT, 
    defaultValue: null 
  } // Add this line

}, {
  tableName: "doodle_requests",
  timestamps: true
});

export default DoodleRequest;