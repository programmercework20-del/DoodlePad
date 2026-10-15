import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const Message = sequelize.define("Message", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  conversationId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  senderId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  content: {
    type: DataTypes.TEXT
  },
  mediaUrl: {
    type: DataTypes.STRING
  },
  type: {
    // 🔥 "card" ENUM me add kar diya gaya hai
    type: DataTypes.ENUM("text", "image", "video", "audio", "doodle", "shared_post", "card"),
    defaultValue: "text"
  },
  thumbnail: {
    type: DataTypes.STRING
  },
  duration: {
    type: DataTypes.INTEGER
  },
  status: {
    type: DataTypes.ENUM("sent", "delivered", "seen", "deleted"),
    defaultValue: "sent"
  },
  receiverId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  postId: {          
    type: DataTypes.UUID,
    allowNull: true
  },
  // 🔥 NAYA COLUMN: JSONB for Pro-Level Card Handling
  cardSlides: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: null
  },
  reactions: {
  type: DataTypes.JSON, 
  defaultValue: {},
  allowNull: false
},
  // 🔥 PHASE 3: Reply-to-Message Reference
  replyToId: {
    type: DataTypes.UUID,
    allowNull: true,
    defaultValue: null,
    references: {
      model: "messages",
      key: "id"
    },
    onDelete: "SET NULL"
  }
}, {
  tableName: "messages",
  timestamps: true
});

export default Message;