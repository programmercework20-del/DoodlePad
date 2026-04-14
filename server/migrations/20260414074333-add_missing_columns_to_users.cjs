'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. CREATE ENUMS FIRST (Bypasses "type does not exist" error)
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_comments_status') THEN
          CREATE TYPE "enum_comments_status" AS ENUM('active', 'hidden', 'deleted');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_shares_type') THEN
          CREATE TYPE "enum_shares_type" AS ENUM('dm', 'story', 'external');
        END IF;
      END $$;
    `);

    // 2. SYNC TABLES (Ensures all columns from your local models are present)
    
    // ADS TABLE
    await queryInterface.createTable('ads', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      title: { type: Sequelize.STRING },
      imageUrl: { type: Sequelize.STRING },
      redirectUrl: { type: Sequelize.STRING },
      status: { type: Sequelize.ENUM('active', 'inactive'), defaultValue: 'active' },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });

    // SHARES TABLE (Adding missing columns if any)
    await queryInterface.createTable('shares', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      postId: { type: Sequelize.UUID, allowNull: false },
      userId: { type: Sequelize.UUID, allowNull: false },
      targetUserId: { type: Sequelize.UUID, allowNull: true },
      type: { type: Sequelize.ENUM('dm', 'story', 'external'), allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });
    
    // TOKEN BLACKLIST
    await queryInterface.createTable('token_blacklist', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      token: { type: Sequelize.TEXT, allowNull: false },
      expiresAt: { type: Sequelize.DATE, allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Not recommended for live use unless resetting
  }
};