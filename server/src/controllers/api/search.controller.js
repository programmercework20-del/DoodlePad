import { Op } from "sequelize";
import User from "../../models/User.js";
import Hashtag from "../../models/Hashtag.js";

export const globalSearch = async (req, res) => {
  try {
    const query = req.query.q?.trim();

    if (!query)
      return res.json({ success: true, users: [], hashtags: [] });

    // =========================================
    // CASE 1 → HASHTAG SEARCH (#)
    // =========================================
    if (query.startsWith("#")) {
      const keyword = query.substring(1); // remove #

      const hashtags = await Hashtag.findAll({
        where: {
          name: { [Op.iLike]: `${keyword}%` }
        },
        order: [["postsCount", "DESC"]],
        limit: 10
      });

      return res.json({
        success: true,
        type: "hashtag",
        hashtags
      });
    }

    // =========================================
    // CASE 2 → USER SEARCH (TEXT)
    // =========================================

    const users = await User.findAll({
      where: {
        [Op.or]: [
          { username: { [Op.iLike]: `${query}%` } },
          { name: { [Op.iLike]: `${query}%` } }
        ]
      },
      attributes: ["id", "username", "name", "profilePhoto", "isVerified"],

      // ⭐⭐ SMART RANKING ⭐⭐
      order: [
        ["isVerified", "DESC"], // celebrities first
        ["username", "ASC"]
      ],

      limit: 10
    });

    res.json({
      success: true,
      type: "user",
      users
    });

  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ success: false, message: "Search failed" });
  }
};
