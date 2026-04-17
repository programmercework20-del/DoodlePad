import User from "../../models/User.js";
import Post from "../../models/Post.js";
import Follower from "../../models/Follower.js";
import DoodleRequest from "../../models/DoodleRequest.js";
import { createNotification } from "../../services/notification.service.js";
import redisClient from "../../config/redis.js";
import bucket from "../../config/firebase.js";

// ============================================================
// GET USER PROFILE
// ============================================================
export const getUserProfile = async (req, res) => {
  try {
    const profileUserId = req.params.id;
    const viewerId = req.user?.id;
    const cacheKey = `userProfile:${profileUserId}:viewer:${viewerId || "guest"}`;

    // 🚀 1. Redis Cache Check
    if (redisClient?.isReady) {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return res.json({ success: true, ...JSON.parse(cached) });
      }
    }

    const user = await User.findByPk(profileUserId, {
      attributes: [
        "id", "username", "name", "bio", "profilePhoto",
        "doodleImage", "doodleOwnerId", "isPrivate"
      ]
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const followersCount = await Follower.count({ where: { followingId: profileUserId } });
    const followingCount = await Follower.count({ where: { followerId: profileUserId } });
    const postsCount = await Post.count({ where: { userId: profileUserId } });

    let follow = null;
    if (viewerId) {
      follow = await Follower.findOne({
        where: { followerId: viewerId, followingId: profileUserId }
      });
    }

    const isFollowing = follow?.status === "accepted";
    let canViewFullProfile = true;

    if (user.isPrivate && viewerId !== profileUserId) {
      if (!isFollowing) canViewFullProfile = false;
    }

    const showDoodle = viewerId === profileUserId ? true : isFollowing;

    let posts = [];
    if (canViewFullProfile) {
      posts = await Post.findAll({
        where: { userId: profileUserId },
        order: [["createdAt", "DESC"]]
      });
    }

    const profileData = {
      profile: {
        user,
        stats: canViewFullProfile
          ? { followers: followersCount, following: followingCount, posts: postsCount }
          : null,
        isFollowing,
        isPrivate: user.isPrivate,
        canViewFullProfile,
        showDoodle,
        posts
      }
    };

    // 🚀 2. Cache Store (5 min)
    if (redisClient?.isReady) {
      await redisClient.setEx(cacheKey, 300, JSON.stringify(profileData));
    }

    return res.json({ success: true, ...profileData });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Profile failed" });
  }
};

// ============================================================
// UPDATE MY PROFILE
// ============================================================
export const updateMyProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    let { name, bio, dateOfBirth, gender, username } = req.body;
    username = username?.trim();
    name = name?.trim();
    bio = bio?.trim();

    // Username check
    if (username && username !== user.username) {
      const existingUsername = await User.findOne({ where: { username } });
      if (existingUsername) {
        return res.status(400).json({ message: "Username already taken" });
      }
    }

    // 🔥 Profile Photo — GCS Bucket Upload
    let profilePhoto = user.profilePhoto;

    if (req.file) {
      if (!req.file.buffer) {
        return res.status(400).json({ message: "File buffer missing" });
      }

      const fileName = `profile_images/user_${req.user.id}_${Date.now()}`;
      const blob = bucket.file(fileName);

      await new Promise((resolve, reject) => {
        const stream = blob.createWriteStream({
          metadata: { contentType: req.file.mimetype },
          resumable: false
        });
        stream.on("error", reject);
        stream.on("finish", resolve);
        stream.end(req.file.buffer);
      });

      profilePhoto = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    }

    await user.update({
      name: name ?? user.name,
      username: username ?? user.username,
      bio: bio ?? user.bio,
      dateOfBirth: dateOfBirth ?? user.dateOfBirth,
      gender: gender || null,
      profilePhoto
    });

    // 🚀 Cache Invalidation
    if (redisClient?.isReady) {
      await redisClient.del(`userProfile:${req.user.id}:viewer:${req.user.id}`);
      await redisClient.del(`userProfile:${req.user.id}:viewer:guest`);
    }

    return res.json({ success: true, message: "Profile updated successfully", user });

  } catch (error) {
    console.error("UPDATE PROFILE ERROR:", error);
    res.status(500).json({ message: "Profile update failed" });
  }
};

// ============================================================
// GET MY PROFILE
// ============================================================
export const getMyProfile = async (req, res) => {
  try {
    const cacheKey = `myProfile:${req.user.id}`;

    // 🚀 Cache Check
    if (redisClient?.isReady) {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return res.json({ success: true, user: JSON.parse(cached) });
      }
    }

    const user = await User.findByPk(req.user.id, {
      attributes: [
        "id", "name", "username", "profilePhoto", "bio",
        "dateOfBirth", "gender", "doodleImage", "doodleOwnerId"
      ]
    });

    if (!user) return res.status(404).json({ message: "User not found" });

    // 🚀 Cache Store (10 min)
    if (redisClient?.isReady) {
      await redisClient.setEx(cacheKey, 600, JSON.stringify(user));
    }

    res.json({ success: true, user });

  } catch (error) {
    console.error("GET PROFILE ERROR:", error);
    res.status(500).json({ message: "Failed to fetch profile" });
  }
};

// ============================================================
// SEND DOODLE REQUEST
// ============================================================
export const sendDoodleRequest = async (req, res) => {
  try {
    const senderId = req.user.id;
    const { receiverId, base64Image } = req.body;

    let doodleImage = null;

    // ✅ CASE 1: File upload → GCS
    if (req.file) {
      if (!req.file.buffer) {
        return res.status(400).json({ message: "File buffer missing" });
      }

      const fileName = `doodle_images/doodle_${senderId}_${Date.now()}`;
      const blob = bucket.file(fileName);

      await new Promise((resolve, reject) => {
        const stream = blob.createWriteStream({
          metadata: { contentType: req.file.mimetype },
          resumable: false
        });
        stream.on("error", reject);
        stream.on("finish", resolve);
        stream.end(req.file.buffer);
      });

      doodleImage = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    }

    // ✅ CASE 2: Base64 canvas → GCS
    else if (base64Image) {
      const matches = base64Image.match(/^data:image\/png;base64,(.+)$/);
      if (!matches) {
        return res.status(400).json({ message: "Invalid base64 image" });
      }

      const buffer = Buffer.from(matches[1], "base64");
      const fileName = `doodle_images/doodle_${senderId}_${Date.now()}.png`;
      const blob = bucket.file(fileName);

      await new Promise((resolve, reject) => {
        const stream = blob.createWriteStream({
          metadata: { contentType: "image/png" },
          resumable: false
        });
        stream.on("error", reject);
        stream.on("finish", resolve);
        stream.end(buffer);
      });

      doodleImage = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
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

    await createNotification({
      senderId,
      receiverId,
      type: "DOODLE_REQUEST",
      doodleRequestId: request.id
    });

    return res.json({ success: true, message: "Doodle request sent", request });

  } catch (error) {
    console.error("DOODLE SEND ERROR:", error);
    res.status(500).json({ message: "Failed to send doodle request" });
  }
};

// ============================================================
// ACCEPT DOODLE REQUEST
// ============================================================
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

    await request.update({ status: "accepted" });

    await User.update(
      { doodleImage: request.doodleImage, doodleOwnerId: request.senderId },
      { where: { id: userId } }
    );

    // 🚀 Cache Invalidation
    if (redisClient?.isReady) {
      await redisClient.del(`userProfile:${userId}:viewer:${userId}`);
      await redisClient.del(`myProfile:${userId}`);
    }

    await createNotification({
      senderId: userId,
      receiverId: request.senderId,
      type: "DOODLE_ACCEPTED",
      doodleRequestId: request.id
    });

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

// ============================================================
// REJECT DOODLE REQUEST
// ============================================================
export const rejectDoodleRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user.id;

    const request = await DoodleRequest.findByPk(requestId);
    if (!request || request.receiverId !== userId) {
      return res.status(403).json({ message: "Not allowed" });
    }

    await request.update({ status: "rejected" });

    return res.json({ success: true, message: "Doodle request rejected" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to reject request" });
  }
};

// ============================================================
// GET DOODLE REQUESTS
// ============================================================
export const getDoodleRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    const cacheKey = `doodleRequests:${userId}`;

    // 🚀 Cache Check
    if (redisClient?.isReady) {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return res.json({ success: true, requests: JSON.parse(cached) });
      }
    }

    const requests = await DoodleRequest.findAll({
      where: { receiverId: userId, status: "pending" },
      order: [["createdAt", "DESC"]]
    });

    // 🚀 Cache Store (2 min)
    if (redisClient?.isReady) {
      await redisClient.setEx(cacheKey, 120, JSON.stringify(requests));
    }

    res.json({ success: true, requests });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch doodle requests" });
  }
};