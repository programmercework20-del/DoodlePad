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
        allowNull: true,
        unique: true,
        validate: {
            isEmail: true
        }
    },
    username: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: true
    },
    password: {
        type: DataTypes.STRING,
        allowNull: true
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
    },
    isVerified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },

    phone: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true
    },

    isPhoneVerified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },

    phoneOtp: {
        type: DataTypes.STRING
    },

    phoneOtpExpires: {
        type: DataTypes.DATE
    },

    emailVerificationToken: {
        type: DataTypes.STRING
    },

    resetPasswordToken: {
        type: DataTypes.STRING
    },

    resetPasswordExpires: {
        type: DataTypes.DATE
    },
    doodleImage: {
  type: DataTypes.STRING,
  allowNull: true
},

doodleOwnerId: {
  type: DataTypes.UUID,
  allowNull: true
},

isPrivate: {
  type: DataTypes.BOOLEAN,
  defaultValue: false
},
emailVerificationExpires: {
  type: DataTypes.DATE
},
provider: {
  type: DataTypes.ENUM("local", "google"),
  defaultValue: "local"
},

googleId: {
  type: DataTypes.STRING,
  allowNull: true,
  unique: true
},
fcmToken: {
  type: DataTypes.STRING,
  allowNull: true
},
otp: {
  type: DataTypes.STRING
},
otpExpires: {
  type: DataTypes.DATE
},
otpAttempts: {
  type: DataTypes.INTEGER,
  defaultValue: 0
},
otpVerified: {
  type: DataTypes.BOOLEAN,
  defaultValue: false
}

}, 
{
    tableName: "users",
    timestamps: true
});

export default User;
