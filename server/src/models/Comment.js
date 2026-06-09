import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const Comment = sequelize.define("Comment", {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    postId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: "posts",
            key: "id"
        }
    },
    userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: "users",
            key: "id"
        }
    },
    parentId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: "comments",
            key: "id"
        }
    },
    type: {
        type: DataTypes.ENUM(
            "text",
            "emoji",
            "image",
            "audio",
            "video",
            "doodle",
            "gif"
        ),
        defaultValue: "text"
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    mediaUrl: {
        type: DataTypes.STRING,
        allowNull: true
    },
    // 🔥 NEW PREMIUM FIELDS ADDED HERE
    mediaWidth: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    mediaHeight: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    audioDuration: {
        type: DataTypes.FLOAT, // Float taaki 2.5 seconds jaisi value bhi save ho sake
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM("active", "hidden", "deleted"),
        defaultValue: "active"
    },
    reportCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    likesCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    }
}, {
    tableName: "comments",
    timestamps: true
});

export default Comment;