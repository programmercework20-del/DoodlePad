import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const Post = sequelize.define("Post", {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: "users",
            key: "id"
        }
    },
    type: {
        type: DataTypes.ENUM("image", "video", "audio", "doodle", "text"),
        allowNull: false
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    mediaUrls: {
        type: DataTypes.ARRAY(DataTypes.STRING), // multiple images/videos
        allowNull: true
    },
    caption: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM("active", "archived", "deleted", "hidden", "sensitive"),
        defaultValue: "active"
    },
    likesCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    commentsCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    sharesCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    reportCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    commentsEnabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    isSaved: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    expiresAt: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: "posts",
    timestamps: true
});

export default Post;
