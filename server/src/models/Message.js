import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const Message = sequelize.define("Message", {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    senderId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: "users",
            key: "id"
        }
    },
    receiverId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: "users",
            key: "id"
        }
    },
    conversationType: {
        type: DataTypes.ENUM("direct", "group"),
        defaultValue: "direct"
    },
    type: {
        type: DataTypes.ENUM("text", "emoji", "image", "video", "audio", "gif", "doodle"),
        defaultValue: "text"
    },
    // Privacy: Only metadata, not actual content
    hasMedia: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    isReported: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    reportCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    status: {
        type: DataTypes.ENUM("active", "deleted", "flagged"),
        defaultValue: "active"
    }
}, {
    tableName: "messages",
    timestamps: true,
    comment: "Privacy-focused: stores only metadata, not message content"
});

export default Message;
