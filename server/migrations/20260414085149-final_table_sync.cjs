// Followers Table
await queryInterface.createTable('followers', {
  id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
  followerId: { type: Sequelize.UUID, allowNull: false },
  followingId: { type: Sequelize.UUID, allowNull: false },
  status: { type: Sequelize.ENUM('pending', 'accepted', 'rejected'), defaultValue: 'pending' },
  createdAt: { type: Sequelize.DATE, allowNull: false }
});

// Comments Table
await queryInterface.createTable('comments', {
  id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
  postId: { type: Sequelize.UUID, allowNull: false },
  userId: { type: Sequelize.UUID, allowNull: false },
  parentId: { type: Sequelize.UUID, allowNull: true },
  content: { type: Sequelize.TEXT },
  mediaUrl: { type: Sequelize.STRING },
  likesCount: { type: Sequelize.INTEGER, defaultValue: 0 },
  createdAt: { type: Sequelize.DATE, allowNull: false },
  updatedAt: { type: Sequelize.DATE, allowNull: false }
});