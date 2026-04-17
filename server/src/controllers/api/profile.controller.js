import User from "../../models/User.js";
import Post from "../../models/Post.js";
import Follower from "../../models/Follower.js";
import DoodleRequest from "../../models/DoodleRequest.js";
import { createNotification } from "../../services/notification.service.js";

// 🔥 REDIS & BUCKET IMPORT
import redisClient from "../../config/redis.js";
import bucket from "../../config/firebase.js";

/* ============================================================
   GET USER PROFILE (Instagram Style with Cache)
   ============================================================ */
export const getUserProfile = async (req, res) => {
  try {
    const profileUserId = req.params.id;
    const viewerId = req.user?.id;
    const cacheKey = `user_profile:${profileUserId}`;

    // 🚀 1. Check Redis Cache
    if (redisClient?.isReady) {
      const cachedProfile = await redisClient.get(cacheKey);
      if (cachedProfile) {
        // Cache mil gaya, par follow check live karna padega
        const profileData = JSON.parse(cachedProfile);
        
        let isFollowing = false;
        if (viewerId) {
          const follow = await Follower.findOne({
            where: { followerId: viewerId, followingId: profileUserId }
          });
          isFollowing = follow?.status === "accepted";
        }
        
        return res.json({ success: true, profile: { ...profileData, isFollowing } });
      }
    }

    // 🚀 2. DB Fetch if no cache
    const user = await User.findByPk(profileUserId, {
      attributes: ["id", "username", "name", "bio", "profilePhoto", "doodleImage", "doodleOwnerId", "isPrivate"]
    });

    if (!user) return res.status(404).json({ message: "User not found" });

    const [followersCount, followingCount, postsCount] = await Promise.all([
      Follower.count({ where: { followingId: profileUserId } }),
      Follower.count({ where: { followerId: profileUserId } }),
      Post.count({ where: { userId: profileUserId } })
    ]);

    let follow = null;
    if (viewerId) {
      follow = await Follower.findOne({
        where: { followerId: viewerId, followingId: profileUserId }
      });
    }

    const isFollowing = follow?.status === "accepted";
    let canViewFullProfile = true;
    if (user.isPrivate && viewerId !== profileUserId && !isFollowing) {
      canViewFullProfile = false;
    }

    let showDoodle = viewerId === profileUserId || isFollowing;
    let posts = canViewFullProfile 
      ? await Post.findAll({ where: { userId: profileUserId }, order: [["createdAt", "DESC"]] })
      : [];

    const finalProfile = {
      user,
      stats: canViewFullProfile ? { followers: followersCount, following: followingCount, posts: postsCount } : null,
      isPrivate: user.isPrivate,
      canViewFullProfile,
      showDoodle,
      posts
    };

    // 🚀 3. Set Cache for 1 Hour
    if (redisClient?.isReady) {
      await redisClient.setEx(cacheKey, 3600, JSON.stringify(finalProfile));
    }

    return res.json({ success: true, profile: { ...finalProfile, isFollowing } });

  } catch (error) {
    console.error("GET PROFILE ERROR:", error);
    res.status(500).json({ message: "Profile failed" });
  }
};

/* ============================================================
   UPDATE PROFILE (With GCS Bucket & Cache Invalidation)
   ============================================================ */
export const updateMyProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findByPk(userId);

    if (!user) return res.status(404).json({ message: "User not found" });

    let { name, bio, dateOfBirth, gender, username } = req.body;
    let profilePhoto = user.profilePhoto;

    // 🚀 1. GCS UPLOAD LOGIC
    if (req.file) {
      const fileName = `profile_images/user_${userId}_${Date.now()}_${req.file.originalname}`;
      const blob = bucket.file(fileName);

      const stream = blob.createWriteStream({
        metadata: { contentType: req.file.mimetype },
        resumable: false // 🔥 0B Fix
      });

      profilePhoto = await new Promise((resolve, reject) => {
        stream.on("error", (err) => reject(err));
        stream.on("finish", () => {
          resolve(`https://storage.googleapis.com/${bucket.name}/${fileName}`);
        });
        stream.end(req.file.buffer); // 🔥 Buffer management
      });
    }

    // 🚀 2. Username check
    username = username?.trim();
    if (username && username !== user.username) {
      const existing = await User.findOne({ where: { username } });
      if (existing) return res.status(400).json({ message: "Username already taken" });
    }

    // 🚀 3. Update DB
    await user.update({
      name: name?.trim() ?? user.name,
      username: username ?? user.username,
      bio: bio?.trim() ?? user.bio,
      dateOfBirth: dateOfBirth ?? user.dateOfBirth,
      gender: gender || null,
      profilePhoto
    });

    // 🚀 4. CACHE INVALIDATION
    if (redisClient?.isReady) {
      await redisClient.del(`user_profile:${userId}`);
      await redisClient.del(`my_profile:${userId}`);
    }

    return res.json({ success: true, message: "Profile updated successfully", user });

  } catch (error) {
    console.error("UPDATE PROFILE ERROR:", error);
    res.status(500).json({ message: "Profile update failed" });
  }
};

/* ============================================================
   GET MY PROFILE (For Update Form)
   ============================================================ */
export const getMyProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const cacheKey = `my_profile:${userId}`;

    if (redisClient?.isReady) {
      const cached = await redisClient.get(cacheKey);
      if (cached) return res.json({ success: true, user: JSON.parse(cached) });
    }

    const user = await User.findByPk(userId, {
      attributes: ["id", "name", "username", "profilePhoto", "bio", "dateOfBirth", "gender", "doodleImage", "doodleOwnerId"]
    });

    if (redisClient?.isReady) {
      await redisClient.setEx(cacheKey, 3600, JSON.stringify(user));
    }

    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch profile" });
  }
};

/* ============================================================
   DOODLE REQUEST LOGIC (GCS Integrated)
   ============================================================ */
export const sendDoodleRequest = async (req, res) => {
  try {
    const senderId = req.user.id;
    const { receiverId, base64Image } = req.body;
    let doodleImage = null;

    if (req.file || base64Image) {
      const fileName = `doodles/doodle_${senderId}_${Date.now()}.png`;
      const blob = bucket.file(fileName);
      const stream = blob.createWriteStream({ resumable: false });

      doodleImage = await new Promise((resolve, reject) => {
        stream.on("error", (err) => reject(err));
        stream.on("finish", () => resolve(`https://storage.googleapis.com/${bucket.name}/${fileName}`));
        
        if (req.file) {
          stream.end(req.file.buffer);
        } else {
          const buffer = Buffer.from(base64Image.replace(/^data:image\/\w+;base64,/, ""), "base64");
          stream.end(buffer);
        }
      });
    } else {
      return res.status(400).json({ message: "Doodle image required" });
    }

    const request = await DoodleRequest.create({ senderId, receiverId, doodleImage, status: "pending" });
    await createNotification({ senderId, receiverId, type: "DOODLE_REQUEST", doodleRequestId: request.id });

    return res.json({ success: true, message: "Doodle request sent", request });
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
    if (!request || request.receiverId !== userId) return res.status(403).json({ message: "Not allowed" });
    if (request.status !== "pending") return res.status(400).json({ message: "Already processed" });

    await request.update({ status: "accepted" });
    await User.update({ doodleImage: request.doodleImage, doodleOwnerId: request.senderId }, { where: { id: userId } });

    // 🔥 Invalidate profile caches
    if (redisClient?.isReady) {
      await redisClient.del(`user_profile:${userId}`);
      await redisClient.del(`my_profile:${userId}`);
    }

    await createNotification({ senderId: userId, receiverId: request.senderId, type: "DOODLE_ACCEPTED", doodleRequestId: request.id });

    return res.json({ success: true, message: "Doodle applied to profile", doodleImage: request.doodleImage });
  } catch (error) {
    res.status(500).json({ message: "Failed to accept request" });
  }
};

export const rejectDoodleRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user.id;
    const request = await DoodleRequest.findByPk(requestId);
    if (!request || request.receiverId !== userId) return res.status(403).json({ message: "Not allowed" });

    await request.update({ status: "rejected" });
    return res.json({ success: true, message: "Doodle request rejected" });
  } catch (error) {
    res.status(500).json({ message: "Failed to reject request" });
  }
};

export const getDoodleRequests = async (req, res) => {
  try {
    const requests = await DoodleRequest.findAll({
      where: { receiverId: req.user.id, status: "pending" },
      order: [["createdAt", "DESC"]]
    });
    res.json({ success: true, requests });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch requests" });
  }
};