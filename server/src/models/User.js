import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const User = sequelize.define("User", {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true
        }
    },
    username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    password: {
    type: DataTypes.STRING,
    allowNull: false
}
,
    profilePhoto: {
        type: DataTypes.STRING,
        allowNull: true
    },
    bio: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    dateOfBirth: {
        type: DataTypes.DATE,
        allowNull: true
    },
    gender: {
        type: DataTypes.ENUM("male", "female", "other"),
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM("active", "warned", "blocked", "banned"),
        defaultValue: "active"
    },
    canComment: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    canLive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    canMessage: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    warningCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    reportCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    lastActiveAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: "users",
    timestamps: true
});

export default User;
