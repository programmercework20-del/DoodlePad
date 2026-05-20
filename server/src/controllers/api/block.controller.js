import Block from "../../models/Block.js";
import Follower from "../../models/Follower.js";
import Message from "../../models/Message.js";
import User from "../../models/User.js";
import { Op } from "sequelize";
import sequelize from "../../config/db.js"; // 🔥 Import connection for transaction
import redisClient from "../../config/redis.js"; // 🔥 Cache clearance module

// ============================================================
// 1. BLOCK USER (With Transaction & Multi-Level Cache Clear)
// ============================================================
export const blockUser = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const blockerId = req.user.id;
    const blockedId = req.params.id;

    if (blockerId === blockedId) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: "You cannot block yourself" });
    }

    const existing = await Block.findOne({
      where: { blockerId, blockedId },
      transaction
    });

    if (existing) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: "Already blocked" });
    }

    // ✅ Step A: Remove follow relationships from both directions
    await Follower.destroy({
      where: {
        [Op.or]: [
          { followerId: blockerId, followingId: blockedId },
          { followerId: blockedId, followingId: blockerId }
        ]
      },
      transaction
    });

    // ✅ Step B: Hard delete chats between these two users (Optional but secures data)
    await Message.destroy({
      where: {
        [Op.or]: [
          { senderId: blockerId, receiverId: blockedId },
          { senderId: blockedId, receiverId: blockerId }
        ]
      },
      transaction
    });

    // ✅ Step C: Create Block Entry
    await Block.create({ blockerId, blockedId }, { transaction });

    // Commit changes safely to DB
    await transaction.commit();

    // ============================================================
    // 🧠 REDIS CACHE INVALIDATION (Post-Commit Background Tasks)
    // ============================================================
    if (redisClient?.isReady) {
      Promise.all([
        // Clear inbox caches so rooms disappear immediately from layout lists
        redisClient.del(`conversations:${blockerId}`),
        redisClient.del(`conversations:${blockedId}`),
        // Clear global profile/followers lists cache metrics
        redisClient.del(`userPosts:${blockerId}`),
        redisClient.del(`userPosts:${blockedId}`)
      ]).catch(e => console.error("⚠️ Cache clear error inside block handling:", e));
    }

    return res.json({
      success: true,
      message: "User blocked successfully"
    });

  } catch (error) {
    await transaction.rollback();
    console.error("🔥 BLOCK CRITICAL TRANSACTION ERROR:", error);
    return res.status(500).json({ success: false, message: "Block engine failure context" });
  }
};

// ============================================================
// 2. UNBLOCK USER
// ============================================================
export const unblockUser = async (req, res) => {
  try {
    const blockerId = req.user.id;
    const blockedId = req.params.id;

    const deleted = await Block.destroy({
      where: { blockerId, blockedId }
    });

    if (!deleted) {
      return res.status(404).json({ success: false, message: "User not blocked" });
    }

    // Unblock hone par cache clear karein taaki profile restrictions update ho sakein
    if (redisClient?.isReady) {
      await redisClient.del(`conversations:${blockerId}`);
    }

    return res.json({
      success: true,
      message: "User unblocked successfully"
    });

  } catch (error) {
    console.error("🔥 UNBLOCK ERROR:", error);
    return res.status(500).json({ success: false, message: "Unblock system action failed" });
  }
};

// ============================================================
// 3. GET BLOCKED USERS (Flattened Formatting for App Client)
// ============================================================
export const getBlockedUsers = async (req, res) => {
  try {
    const userId = req.user.id;

    const blockedUsers = await Block.findAll({
      where: { blockerId: userId },
      include: [
        {
          model: User,
          as: "blockedUser",
          attributes: [
            "id",
            "username",
            "name",
            "profilePhoto",
            "isVerified"
          ]
        }
      ],
      order: [["createdAt", "DESC"]],
      limit: 100 // Scale protection limit
    });

    // 🔥 FE Developer-Friendly Formatting: Nested structure ko clean and flat karke bhejein
    const formattedUsers = blockedUsers.map(b => {
      if (!b.blockedUser) return null;
      return {
        blockId: b.id,
        blockedAt: b.createdAt,
        id: b.blockedUser.id,
        username: b.blockedUser.username,
        name: b.blockedUser.name,
        profilePhoto: b.blockedUser.profilePhoto,
        isVerified: b.blockedUser.isVerified
      };
    }).filter(u => u !== null);

    return res.json({
      success: true,
      users: formattedUsers
    });

  } catch (error) {
    console.error("🔥 FETCH BLOCKED USERS CONFIG REJECTION:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch blocked records profile scope"
    });
  }
};