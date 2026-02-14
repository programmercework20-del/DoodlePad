export default (sequelize, DataTypes) => {
  const Follower = sequelize.define(
    "Follower",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },

      followerId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: "followerId",   // 👈 IMPORTANT
      },

      followingId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: "followingId",  // 👈 IMPORTANT
      },
    },
    {
      tableName: "followers",
      timestamps: true,
      createdAt: "createdAt",
      updatedAt: false, // you don’t have updatedAt column
    }
  );

  return Follower;
};
