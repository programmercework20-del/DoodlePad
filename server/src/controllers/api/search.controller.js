import { Op } from "sequelize";
import User from "../../models/User.js";
import Hashtag from "../../models/Hashtag.js";
import SearchHistory from "../../models/SearchHistory.js";

export const globalSearch = async (req, res) => {
  try {
    let query = req.query.q;

    if (!query)
      return res.json({ success: true, type: "empty", users: [], hashtags: [] });

    // 🔥 decode encoded query (%23 -> #)
    query = decodeURIComponent(query).trim();

    const userId = req.user.id;

    // do not save single "#"
    if (query === "#") {
      return res.json({ success: true, type: "hashtag", hashtags: [] });
    }

    // save history (dedupe)
    await SearchHistory.destroy({
      where: { userId, keyword: query.toLowerCase() }
    });

    await SearchHistory.create({
      userId,
      keyword: query.toLowerCase()
    });

    // ===============================
    // 🔎 HASHTAG SEARCH
    // ===============================
    if (query.startsWith("#")) {
      const keyword = query.slice(1).toLowerCase();

      const hashtags = await Hashtag.findAll({
        where: {
          name: { [Op.iLike]: `${keyword}%` }
        },
        attributes: ["id", "name", "postsCount"],
        order: [["postsCount", "DESC"]],
        limit: 10
      });

      return res.json({
        success: true,
        type: "hashtag",
        hashtags
      });
    }

    // ===============================
    // 👤 USER SEARCH
    // ===============================
    const users = await User.findAll({
      where: {
        [Op.or]: [
          { username: { [Op.iLike]: `${query}%` } },
          { name: { [Op.iLike]: `${query}%` } }
        ]
      },
      attributes: ["id","username","name","profilePhoto","isVerified"],
      order: [["isVerified","DESC"],["username","ASC"]],
      limit: 10
    });

    return res.json({
      success: true,
      type: "user",
      users
    });

  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ success:false, message:"Search failed" });
  }
};


export const getRecentSearches = async (req, res) => {
  const searches = await SearchHistory.findAll({
    where: { userId: req.user.id },
    order: [["updatedAt", "DESC"]], // 🔥 fixed column name
    limit: 10
  });

  res.json({
    success: true,
    searches
  });
};

export const deleteSingleSearch = async (req, res) => {
  try {
    const userId = req.user.id;
    const searchId = req.params.id;

    // 🔒 delete only if it belongs to that user
    const deleted = await SearchHistory.destroy({
      where: {
        id: searchId,
        userId
      }
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Search not found"
      });
    }

    return res.json({
      success: true,
      message: "Search removed successfully"
    });

  } catch (error) {
    console.error("Delete single search error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete search"
    });
  }
};

export const clearSearchHistory = async (req, res) => {
  await SearchHistory.destroy({
    where: { userId: req.user.id }
  });

  res.json({ message: "Search history cleared" });
};
