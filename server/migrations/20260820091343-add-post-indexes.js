'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // 🚀 Index for User Feed & Explore Posts (Speeds up WHERE userId = X AND status = 'active' ORDER BY createdAt)
    await queryInterface.addIndex('Posts', ['userId', 'status', 'createdAt'], {
      name: 'idx_posts_user_status_date'
    });

    // 🚀 Index for Trending Posts (Speeds up WHERE status = 'active' AND createdAt >= X)
    await queryInterface.addIndex('Posts', ['status', 'createdAt'], {
      name: 'idx_posts_status_date'
    });
  },

  async down (queryInterface, Sequelize) {
    // 🔙 Rollback logic in case we need to undo
    await queryInterface.removeIndex('Posts', 'idx_posts_user_status_date');
    await queryInterface.removeIndex('Posts', 'idx_posts_status_date');
  }
};