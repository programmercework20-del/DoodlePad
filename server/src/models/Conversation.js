import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Conversation = sequelize.define("Conversation", {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },

    type: {
        type: DataTypes.ENUM("direct", "group"),
        defaultValue: "direct"
    },

    lastMessage: {
        type: DataTypes.TEXT
    },

    lastMessageAt: {
        type: DataTypes.DATE
    },
    isRequest: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }

}, {
    tableName: "conversations",
    timestamps: true
});

export default Conversation;