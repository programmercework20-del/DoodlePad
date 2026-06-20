import { Op } from "sequelize";
import User from "../../models/User.js";
import Hashtag from "../../models/Hashtag.js";
import SearchHistory from "../../models/SearchHistory.js";
import redisClient from "../../config/redis.js";

// ============================================================
// GLOBAL SEARCH (With Redis Caching & Search History)
// ============================================================
export const globalSearch = async (req, res) => {
  try {
    let query = req.query.q;

    if (!query) {
      return res.json({
        success: true,
        users: [],
        hashtags: []
      });
    }

    query = decodeURIComponent(query).trim();

    const userId = req.user.id;

    // ===============================
    // SAVE SEARCH HISTORY
    // ===============================
    await SearchHistory.destroy({
      where: {
        userId,
        keyword: query.toLowerCase()
      }
    });

    await SearchHistory.create({
      userId,
      keyword: query.toLowerCase()
    });

    // =====================================================
    // 🔥 HASHTAG SEARCH ONLY WHEN USER TYPES #
    // =====================================================
    if (query.startsWith("#")) {

      const cleanQuery = query.replace("#", "").toLowerCase();

      // avoid empty #
      if (!cleanQuery) {
        return res.json({
          success: true,
          hashtags: []
        });
      }

      const hashtags = await Hashtag.findAll({
        where: {
          name: {
            [Op.iLike]: `%${cleanQuery}%`
          }
        },
        attributes: [
          "id",
          "name",
          "postsCount"
        ],
        order: [
          ["postsCount", "DESC"]
        ],
        limit: 10
      });

      return res.json({
        success: true,
        type: "hashtag",
        hashtags
      });
    }

    // =====================================================
    // 👤 USER SEARCH
    // =====================================================

    const users = await User.findAll({
      where: {
        isDeactivated: false,
        [Op.or]: [
          {
            username: {
              [Op.iLike]: `%${query}%`
            }
          },
          {
            name: {
              [Op.iLike]: `%${query}%`
            }
          }
        ]
      },
      attributes: [
        "id",
        "username",
        "name",
        "profilePhoto",
        "isVerified"
      ],
      order: [
        ["isVerified", "DESC"],
        ["username", "ASC"]
      ],
      limit: 10
    });

    return res.json({
      success: true,
      type: "user",
      users
    });

  } catch (error) {

    console.error("Search error:", error);

    res.status(500).json({
      success: false,
      message: "Search failed"
    });
  }
};

// ============================================================
// GET RECENT SEARCHES
// ============================================================
export const getRecentSearches = async (req, res) => {
  try {
    const searches = await SearchHistory.findAll({
      where: { userId: req.user.id },
      order: [["updatedAt", "DESC"]],
      limit: 10
    });

    return res.json({
      success: true,
      searches
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch history" });
  }
};

// ============================================================
// DELETE SINGLE SEARCH
// ============================================================
export const deleteSingleSearch = async (req, res) => {
  try {
    const userId = req.user.id;
    const searchId = req.params.id;

    const deleted = await SearchHistory.destroy({
      where: { id: searchId, userId }
    });

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Search not found" });
    }

    return res.json({ success: true, message: "Search removed successfully" });
  } catch (error) {
    console.error("Delete single search error:", error);
    res.status(500).json({ success: false, message: "Failed to delete search" });
  }
};

// ============================================================
// CLEAR ALL SEARCH HISTORY
// ============================================================
export const clearSearchHistory = async (req, res) => {
  try {
    await SearchHistory.destroy({ where: { userId: req.user.id } });
    return res.json({ success: true, message: "Search history cleared" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to clear history" });
  }
};