'use strict';
//2
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. ADS TABLE: Adding columns if they are missing
    await queryInterface.createTable('ads', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      title: { type: Sequelize.STRING },
      imageUrl: { type: Sequelize.STRING },
      redirectUrl: { type: Sequelize.STRING },
      status: { type: Sequelize.ENUM('active', 'inactive'), defaultValue: 'active' },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });

    // 2. SHARES TABLE: Adding columns
    await queryInterface.createTable('shares', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      postId: { type: Sequelize.UUID, allowNull: false },
      userId: { type: Sequelize.UUID, allowNull: false },
      targetUserId: { type: Sequelize.UUID, allowNull: true },
      type: { type: Sequelize.ENUM('dm', 'story', 'external'), allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });

    // 3. DOODLE REQUESTS
    await queryInterface.createTable('doodle_requests', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      senderId: { type: Sequelize.UUID, allowNull: false },
      receiverId: { type: Sequelize.UUID, allowNull: false },
      doodleImage: { type: Sequelize.STRING, allowNull: false },
      status: { type: Sequelize.ENUM('pending', 'accepted', 'rejected'), defaultValue: 'pending' },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Leave blank for now
  }
};