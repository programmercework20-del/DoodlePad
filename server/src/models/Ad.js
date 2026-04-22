import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const Ad = sequelize.define('Ad', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    imageUrl: {
        type: DataTypes.STRING,
        allowNull: false
    },
    redirectUrl: {
        type: DataTypes.STRING,
        allowNull: false
    },
    type: {
        type: DataTypes.ENUM('banner', 'feed', 'popup'),
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('draft', 'active', 'inactive', 'pending_payment'),
        allowNull: false,
        defaultValue: 'pending_payment'
    },
    budget: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
            min: 0.01
        }
    },
    impressions: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    clicks: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    startDate: {
        type: DataTypes.DATE,
        allowNull: false
    },
    endDate: {
        type: DataTypes.DATE,
        allowNull: false
    }
}, {
    tableName: 'ads',
    timestamps: true
});

export default Ad;
