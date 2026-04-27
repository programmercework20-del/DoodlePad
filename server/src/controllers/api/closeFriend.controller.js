import CloseFriend from "../../models/CloseFriend.js";
import User from "../../models/User.js";
import redisClient from "../../config/redis.js";

// ============================================================
// ADD CLOSE FRIEND (With Cache Invalidation)
// ============================================================
export const addCloseFriend = async (req, res) => {
  try {
    const { friendId } = req.body;
    const userId = req.user.id;

    if (!friendId) {
      return res.status(400).json({ success: false, message: "friendId is required" });
    }

    // Khud ko close friend nahi bana sakte logic (Optional but good)
    if (friendId === userId) {
      return res.status(400).json({ success: false, message: "You cannot add yourself" });
    }

    await CloseFriend.findOrCreate({
      where: { userId, friendId }
    });

    // 🚀 Clear Redis Cache for Close Friends List
    if (redisClient?.isReady) {
      await redisClient.del(`close_friends:${userId}`);
    }

    return res.json({ success: true, message: "Added to close friends" });
  } catch (err) {
    console.error("ADD CLOSE FRIEND ERROR:", err);
    return res.status(500).json({ success: false, message: "Failed to add close friend" });
  }
};

// ============================================================
// REMOVE CLOSE FRIEND
// ============================================================
export const removeCloseFriend = async (req, res) => {
  try {
    const { friendId } = req.body;
    const userId = req.user.id;

    await CloseFriend.destroy({
      where: { userId, friendId }
    });

    // 🚀 Clear Redis Cache
    if (redisClient?.isReady) {
      await redisClient.del(`close_friends:${userId}`);
    }

    return res.json({ success: true, message: "Removed from close friends" });
  } catch (err) {
    console.error("REMOVE CLOSE FRIEND ERROR:", err);
    return res.status(500).json({ success: false, message: "Failed to remove" });
  }
};

// ============================================================
// GET MY CLOSE FRIENDS (With Redis & User Info)
// ============================================================
export const getMyCloseFriends = async (req, res) => {
  try {
    const userId = req.user.id;
    const cacheKey = `close_friends:${userId}`;

    // 🚀 1. Redis Cache Check
    if (redisClient?.isReady) {
      const cached = await redisClient.get(cacheKey);
      if (cached) return res.json({ success: true, data: JSON.parse(cached) });
    }

    // 2. DB Fetch with User Details (App needs username/photo)
    const list = await CloseFriend.findAll({
      where: { userId },
      include: [
        {
          model: User,
          as: "friend", // Make sure this association exists in your models/index.js
          attributes: ["id", "username", "name", "profilePhoto"]
        }
      ]
    });

    // 🚀 3. Set Redis Cache (5 minutes)
    if (redisClient?.isReady && list.length > 0) {
      await redisClient.setEx(cacheKey, 300, JSON.stringify(list));
    }

    return res.json({ 
      success: true, 
      data: list 
    });

  } catch (err) {
    console.error("GET CLOSE FRIENDS ERROR:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch list" });
  }
};