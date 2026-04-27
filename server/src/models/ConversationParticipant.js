import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const ConversationParticipant = sequelize.define("ConversationParticipant", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },

  conversationId: {
    type: DataTypes.UUID,
    allowNull: false
  },

  userId: {
    type: DataTypes.UUID,
    allowNull: false
  },

  lastSeenAt: {
    type: DataTypes.DATE
  }

}, {
  tableName: "conversation_participants",
  timestamps: true
});

export default ConversationParticipant;