'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 🎨 Adding doodleData column
    await queryInterface.addColumn('doodle_requests', 'doodleData', {
      type: Sequelize.TEXT, // TEXT use kar rahe hain kyunki doodle path data lamba ho sakta hai
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    // 🔙 Removing the column if we need to rollback
    await queryInterface.removeColumn('doodle_requests', 'doodleData');
  }
};