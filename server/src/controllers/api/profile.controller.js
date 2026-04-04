import User from "../../models/User.js";
import Post from "../../models/Post.js";
import Follower from "../../models/Follower.js";
import DoodleRequest from "../../models/DoodleRequest.js";

/*
GET USER PROFILE
Instagram style profile endpoint
*/
export const getUserProfile = async (req, res) => {
  try {
    const profileUserId = req.params.id;
    const viewerId = req.user?.id;

    const user = await User.findByPk(profileUserId, {
      attributes: [
        "id",
        "username",
        "name",
        "bio",
        "profilePhoto",
        "doodleImage",
        "doodleOwnerId",
        "isPrivate"
      ]
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // followers
    const followersCount = await Follower.count({
      where: { followingId: profileUserId }
    });

    const followingCount = await Follower.count({
      where: { followerId: profileUserId }
    });

    const postsCount = await Post.count({
      where: { userId: profileUserId }
    });

    // 🔥 FOLLOW CHECK
    let isFollowing = false;

    if (viewerId) {
      const follow = await Follower.findOne({
        where: {
          followerId: viewerId,
          followingId: profileUserId
        }
      });

      isFollowing = !!follow;
    }

    // 🔥 DOODLE VISIBILITY LOGIC
    let showDoodle = false;

    if (viewerId === profileUserId) {
      showDoodle = true;
    } else {
      const isFriend = await Follower.findOne({
        where: {
          followerId: viewerId,
          followingId: profileUserId
        }
      });

      showDoodle = !!isFriend;
    }

    const posts = await Post.findAll({
      where: { userId: profileUserId },
      order: [["createdAt", "DESC"]]
    });

    return res.json({
      success: true,
      profile: {
        user,
        stats: {
          followers: followersCount,
          following: followingCount,
          posts: postsCount
        },
        isFollowing,
        showDoodle,
        posts
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Profile failed" });
  }
};

//update profile 
export const updateMyProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let { name,bio, dateOfBirth, gender, username } = req.body;

    // 🔥 Normalize input (important)
    username = username?.trim();
    name = name?.trim();
    bio = bio?.trim();

    /* ================= USERNAME CHECK ================= */
    if (username && username !== user.username) {
      const existingUsername = await User.findOne({
        where: { username }
      });

      if (existingUsername) {
        return res.status(400).json({
          message: "Username already taken"
        });
      }
    }

    /* ================= PROFILE PHOTO ================= */
    const baseUrl = `${req.protocol}://${req.get("host")}`;

const profilePhoto = req.file
  ? `${baseUrl}/uploads/stories/${req.file.filename}`
  : user.profilePhoto;

    /* ================= UPDATE ONLY PROVIDED FIELDS ================= */
    await user.update({
      name: name ?? user.name,
      username: username ?? user.username,
      bio: bio ?? user.bio, // ✅ editable bio
      dateOfBirth: dateOfBirth ?? user.dateOfBirth,
      gender: gender || null, // ✅ optional gender (important fix)
      profilePhoto
    });

    return res.json({
      success: true,
      message: "Profile updated successfully",
      user
    });

  } catch (error) {
    console.error("UPDATE PROFILE ERROR:", error);
    res.status(500).json({ message: "Profile update failed" });
  }
};


// GET MY PROFILE (for update form)
export const getMyProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: [
        "id",
        "name",
        "username",
        "profilePhoto",
        "bio",
        "dateOfBirth",
        "gender",
        "doodleImage",       // ✅ NEW
        "doodleOwnerId"      // ✅ NEW
      ]
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      success: true,
      user
    });

  } catch (error) {
    console.error("GET PROFILE ERROR:", error);
    res.status(500).json({ message: "Failed to fetch profile" });
  }
};

export const sendDoodleRequest = async (req, res) => {
  try {
    const senderId = req.user.id;
    const { receiverId, base64Image } = req.body;

    let doodleImage = null;

    // ✅ CASE 1: File upload
    if (req.file) {
      doodleImage = `${req.protocol}://${req.get("host")}/uploads/doodles/${req.file.filename}`;
    }

    // ✅ CASE 2: Base64 canvas image
    else if (base64Image) {
      const matches = base64Image.match(/^data:image\/png;base64,(.+)$/);

      if (!matches) {
        return res.status(400).json({ message: "Invalid base64 image" });
      }

      const buffer = Buffer.from(matches[1], "base64");

      const fileName = `doodle-${Date.now()}.png`;
      const filePath = `uploads/doodles/${fileName}`;

      const fs = await import("fs");
      fs.writeFileSync(filePath, buffer);

      doodleImage = `${req.protocol}://${req.get("host")}/${filePath}`;
    }

    else {
      return res.status(400).json({ message: "Doodle image required" });
    }

    const request = await DoodleRequest.create({
      senderId,
      receiverId,
      doodleImage,
      status: "pending"
    });

    return res.json({
      success: true,
      message: "Doodle request sent",
      request
    });

  } catch (error) {
    console.error("DOODLE SEND ERROR:", error);
    res.status(500).json({ message: "Failed to send doodle request" });
  }
};

export const acceptDoodleRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user.id;

    const request = await DoodleRequest.findByPk(requestId);

    if (!request || request.receiverId !== userId) {
      return res.status(403).json({ message: "Not allowed" });
    }

    if (request.status !== "pending") {
      return res.status(400).json({ message: "Already processed" });
    }

    // ✅ update request
    await request.update({ status: "accepted" });

    // ✅ update profile doodle
    await User.update(
      {
        doodleImage: request.doodleImage,
        doodleOwnerId: request.senderId
      },
      { where: { id: userId } }
    );

    return res.json({
      success: true,
      message: "Doodle applied to profile",
      doodleImage: request.doodleImage
    });

  } catch (error) {
    console.error("DOODLE ACCEPT ERROR:", error);
    res.status(500).json({ message: "Failed to accept request" });
  }
};

export const rejectDoodleRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user.id;

    const request = await DoodleRequest.findByPk(requestId);

    if (!request || request.receiverId !== userId) {
      return res.status(403).json({ message: "Not allowed" });
    }

    await request.update({ status: "rejected" });

    return res.json({
      success: true,
      message: "Doodle request rejected"
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to reject request" });
  }
};

export const getDoodleRequests = async (req, res) => {
  const userId = req.user.id;

  const requests = await DoodleRequest.findAll({
    where: {
      receiverId: userId,
      status: "pending"
    },
    order: [["createdAt", "DESC"]]
  });

  res.json({ success: true, requests });
};
