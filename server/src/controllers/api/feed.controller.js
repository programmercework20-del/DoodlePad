import { Op } from "sequelize";
import { User, Follower } from "../../models/index.js";
import Post from "../../models/Post.js";
import Ad from "../../models/Ad.js";
import { calculateFeedScore } from "../../utils/feedRanking.js";

export const getFeed = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const userId = req.user.id;

    // 1️⃣ Get following users
    const following = await Follower.findAll({
      where: {
        followerId: userId,
        status: "accepted"
      },
      attributes: ["followingId"]
    });

    const followingIds = following.map(f => f.followingId);
    followingIds.push(userId); // include self

    // 2️⃣ Fetch posts
    const posts = await Post.findAll({
      where: {
        userId: { [Op.in]: followingIds },
        status: "active",
        [Op.or]: [
          { isSaved: true },
          { expiresAt: { [Op.gt]: new Date() } }
        ]
      },
      include: [{
        model: User,
        as: "author",
        attributes: ["id", "username", "profilePhoto", "isVerified"]
      }],
      order: [["createdAt", "DESC"]],
      limit: limit * 2 // fetch extra for ranking
    });

    // 3️⃣ Format posts
    let feed = posts.map(post => ({
      id: post.id,
      type: "post",
      caption: post.caption,
      mediaUrls: post.mediaUrls,
      createdAt: post.createdAt,
      likesCount: post.likesCount,
      commentsCount: post.commentsCount,
      sharesCount: post.sharesCount,
      user: post.author
    }));

    // 4️⃣ Apply ranking
    feed = feed.map(item => {
      const relationshipBoost = followingIds.includes(item.user.id) ? 10 : 0;
      const score = calculateFeedScore(item) + relationshipBoost;

      return { ...item, score };
    });

    // 5️⃣ Sort by score
    feed.sort((a, b) => b.score - a.score);

    // 6️⃣ Remove score
    feed = feed.slice(0, limit).map(({ score, ...rest }) => rest);

    // 7️⃣ Fetch Ads
    const ads = await Ad.findAll({
      where: { status: "active" },
      limit: Math.ceil(feed.length / 5)
    });

    // 8️⃣ Mix posts + ads
    let finalFeed = [];
    let adIndex = 0;

    for (let i = 0; i < feed.length; i++) {
      finalFeed.push(feed[i]);

      // every 5 posts insert ad
      if ((i + 1) % 5 === 0 && ads[adIndex]) {
        finalFeed.push({
          type: "ad",
          id: ads[adIndex].id,
          title: ads[adIndex].title,
          imageUrl: ads[adIndex].imageUrl,
          redirectUrl: ads[adIndex].redirectUrl
        });
        adIndex++;
      }
    }

    return res.json({
      success: true,
      feed: finalFeed
    });

  } catch (err) {
    console.error("Feed error:", err);
    res.status(500).json({ message: "Failed to load feed" });
  }
};