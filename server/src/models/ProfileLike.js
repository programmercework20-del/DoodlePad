import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js'; // ⚠️ Apna db.js ka path check kar lena

const ProfileLike = sequelize.define('ProfileLike', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4, // Naya UUID auto-generate karega
    primaryKey: true,
  },
  profileId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  likerId: {
    type: DataTypes.UUID,
    allowNull: false
  }
}, {
  tableName: 'profile_likes', // Jo table tumne pgAdmin me banayi hai
  timestamps: true // createdAt aur updatedAt automatically handle karega
});

export default ProfileLike;