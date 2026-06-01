import { Op } from "sequelize";
import User from "../../models/User.js";
import Hashtag from "../../models/Hashtag.js";
import SearchHistory from "../../models/SearchHistory.js";
import Block from "../../models/Block.js";

// ============================================================
// GLOBAL SEARCH (No Redis Needed - Realtime Query)
// ============================================================
export const globalSearch = async (req, res) => {
  try {
    let query = req.query.q;

    if (!query) {
      return res.json({ success: true, users: [], hashtags: [] });
    }

    query = decodeURIComponent(query).trim();
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // =====================================================
    // 🔥 CASE A: HASHTAG SEARCH ONLY WHEN USER TYPES #
    // =====================================================
    if (query.startsWith("#")) {
      const cleanQuery = query.replace("#", "").toLowerCase();

      if (!cleanQuery) {
        return res.json({ success: true, type: "hashtag", hashtags: [] });
      }

      const hashtags = await Hashtag.findAll({
        where: {
          name: { [Op.iLike]: `%${cleanQuery}%` }
        },
        attributes: ["id", "name", "postsCount"],
        order: [["postsCount", "DESC"]],
        limit: 10
      });

      res.json({ success: true, type: "hashtag", hashtags });

      // BACKGROUND TASK: History logging
      SearchHistory.destroy({ where: { userId, keyword: query.toLowerCase() } })
        .then(() => SearchHistory.create({ userId, keyword: query.toLowerCase() }))
        .catch(err => console.error("⚡ Background History Log Error:", err.message));

      return;
    }

    // =====================================================
    // 👤 CASE B: USER SEARCH (WITH BLOCK FILTER)
    // =====================================================

    // 🔥 STEP 1: Find all block relations (Mujhe kisne block kiya, ya maine kisko kiya)
    const blockRecords = await Block.findAll({
      where: {
        [Op.or]: [{ blockerId: userId }, { blockedId: userId }]
      },
      attributes: ['blockerId', 'blockedId'],
      raw: true
    });

    // 🔥 STEP 2: Extract IDs to hide
    const hiddenUserIds = blockRecords.map(b => 
      b.blockerId === userId ? b.blockedId : b.blockerId
    );
    hiddenUserIds.push(userId); // Khud ko bhi hide karo

    // 🔥 STEP 3: Modified User Query
    const users = await User.findAll({
      where: {
        [Op.and]: [
          {
            [Op.or]: [
              { username: { [Op.iLike]: `%${query}%` } },
              { name: { [Op.iLike]: `%${query}%` } }
            ]
          },
          {
            id: { [Op.notIn]: hiddenUserIds } 
          }
        ]
      },
      attributes: ["id", "username", "name", "profilePhoto", "isVerified"],
      order: [
        ["isVerified", "DESC"],
        ["username", "ASC"]
      ],
      limit: 10
    });

    res.json({
      success: true,
      type: "user",
      users
    });

    // BACKGROUND TASK: History logging
    SearchHistory.destroy({ where: { userId, keyword: query.toLowerCase() } })
      .then(() => SearchHistory.create({ userId, keyword: query.toLowerCase() }))
      .catch(err => console.error("⚡ Background History Log Error:", err.message));

  } catch (error) {
    console.error("🚨 Global Search Error:", error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: "Search execution failed" });
    }
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