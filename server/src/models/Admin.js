import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const Admin = sequelize.define("Admin", {
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
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    role: {
        type: DataTypes.ENUM("admin", "super_admin", "moderator"),
        defaultValue: "admin"
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    otp: {
        type: DataTypes.STRING,
        allowNull: true
    },

    otpExpires: {
        type: DataTypes.DATE,
        allowNull: true
    },

    otpVerified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }

}, {
    tableName: "admins",
    timestamps: true
});

export default Admin;