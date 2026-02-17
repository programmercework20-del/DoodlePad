import User from "../../models/User.js";
import Post from "../../models/Post.js";
import Reel from "../../models/Reel.js";
import Follower from "../../models/Follower.js";

/*
GET USER PROFILE
Instagram style profile endpoint
*/
export const getUserProfile = async (req, res) => {
  try {
    const profileUserId = req.params.id;   // profile owner
    const viewerId = req.user?.id || null; // logged user (optional)

    /* ================= BASIC USER INFO ================= */
    const user = await User.findByPk(profileUserId, {
      attributes: [
        "id",
        "username",
        "name",
        "bio",
        "profilePhoto",
        "isVerified"
      ]
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    /* ================= FOLLOW COUNTS ================= */

    const followersCount = await Follower.count({
      where: { followingId: profileUserId }
    });

    const followingCount = await Follower.count({
      where: { followerId: profileUserId }
    });

    /* ================= CONTENT COUNTS ================= */

    const postsCount = await Post.count({
      where: { userId: profileUserId }
    });

    const reelsCount = await Reel.count({
      where: { userId: profileUserId }
    });

    /* ================= FOLLOW STATUS ================= */
    let isFollowing = false;

    if (viewerId) {
      const followRecord = await Follower.findOne({
        where: {
          followerId: viewerId,
          followingId: profileUserId
        }
      });

      isFollowing = !!followRecord;
    }

    /* ================= USER POSTS ================= */
    const posts = await Post.findAll({
      where: { userId: profileUserId },
      // attributes: ["id", "media", "caption", "createdAt"],
      order: [["createdAt", "DESC"]]
    });

    /* ================= USER REELS ================= */
    const reels = await Reel.findAll({
      where: { userId: profileUserId },
      // attributes: ["id", "videoUrl", "thumbnail", "createdAt"],
      order: [["createdAt", "DESC"]]
    });

    /* ================= FINAL RESPONSE ================= */
    return res.json({
      success: true,
      profile: {
        user,
        stats: {
          followers: followersCount,
          following: followingCount,
          posts: postsCount,
          reels: reelsCount
        },
        isFollowing,
        posts,
        reels
      }
    });

  } catch (error) {
    console.error("Profile error:", error);
    res.status(500).json({ message: "Profile fetch failed" });
  }
};
