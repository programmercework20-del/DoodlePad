import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const Report = sequelize.define("Report", {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    reporterId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: "users",
            key: "id"
        }
    },
    targetType: {
        type: DataTypes.ENUM("post", "comment", "user", "live", "message"),
        allowNull: false
    },
    targetId: {
        type: DataTypes.UUID,
        allowNull: false
    },
    reason: {
        type: DataTypes.ENUM("spam", "abuse", "hate_speech", "fake_content", "nudity", "violence", "other"),
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM("pending", "reviewing", "resolved", "rejected"),
        defaultValue: "pending"
    },
    priority: {
        type: DataTypes.ENUM("low", "medium", "high"),
        defaultValue: "medium"
    },
    reviewedBy: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: "admins",
            key: "id"
        }
    },
    reviewedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    adminNotes: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: "reports",
    timestamps: true
});

export default Report;
