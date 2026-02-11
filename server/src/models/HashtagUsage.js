import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const HashtagUsage = sequelize.define("HashtagUsage", {
  id:{
    type:DataTypes.UUID,
    defaultValue:DataTypes.UUIDV4,
    primaryKey:true
  },

  hashtagId:{
    type:DataTypes.UUID
  },

  postId:{
    type:DataTypes.UUID,
    allowNull:true
  },

  reelId:{
    type:DataTypes.UUID,
    allowNull:true
  }

},{
  tableName:"hashtag_usage",
  timestamps:false
});

export default HashtagUsage;
