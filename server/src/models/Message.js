// import { DataTypes } from 'sequelize';
// import sequelize from '../config/db.js';

// const Message = sequelize.define("Message", {
//   id: {
//     type: DataTypes.UUID,
//     defaultValue: DataTypes.UUIDV4,
//     primaryKey: true
//   },

//   conversationId: {
//     type: DataTypes.UUID,
//     allowNull: false
//   },

//   senderId: {
//     type: DataTypes.UUID,
//     allowNull: false
//   },

//   content: {
//     type: DataTypes.TEXT
//   },

//   mediaUrl: {
//     type: DataTypes.STRING
//   },

//   type: {
//     type: DataTypes.ENUM("text", "image", "video", "audio", "doodle", "shared_post"),
//     defaultValue: "text"
//   },

// thumbnail: {
//     type: DataTypes.STRING
//   },

// duration: {
//     type:     DataTypes.INTEGER
//   },


//   status: {
//     type: DataTypes.ENUM("sent", "delivered", "seen"),
//     defaultValue: "sent"
//   },
//   receiverId: {
//   type: DataTypes.UUID,
//   allowNull: false
// },
// postId: {         
//   type: DataTypes.UUID,
//   allowNull: true
// }

// }, {
//   tableName: "messages",
//   timestamps: true
// });
// export default Message;

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
    type: DataTypes.ENUM("sent", "delivered", "seen"),
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
  }
}, {
  tableName: "messages",
  timestamps: true
});

export default Message;