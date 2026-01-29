import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const Live = sequelize.define("Live", {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    hostId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: "users",
            key: "id"
        }
    },
    title: {
        type: DataTypes.STRING,
        allowNull: true
    },
    type: {
        type: DataTypes.ENUM("audio", "video"),
        defaultValue: "video"
    },
    status: {
        type: DataTypes.ENUM("scheduled", "live", "ended", "terminated"),
        defaultValue: "scheduled"
    },
    viewerCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    peakViewers: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    reportCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    startedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    endedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    duration: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "Duration in seconds"
    },
    terminatedBy: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: "admins",
            key: "id"
        }
    },
    terminationReason: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: "live_sessions",
    timestamps: true
});

export default Live;
