import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Hashtag = sequelize.define("Hashtag", {
  id:{
    type:DataTypes.UUID,
    defaultValue:DataTypes.UUIDV4,
    primaryKey:true
  },

  name:{
    type:DataTypes.STRING,
    unique:true
  }

},{
  tableName:"hashtags",
  timestamps:true
});

export default Hashtag;
