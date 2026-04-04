import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Ad = sequelize.define("Ad", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  title: DataTypes.STRING,
  imageUrl: DataTypes.STRING,
  redirectUrl: DataTypes.STRING,
  status: {
    type: DataTypes.ENUM("active", "inactive"),
    defaultValue: "active"
  }
}, {
  tableName: "ads",
  timestamps: true
});

export default Ad;