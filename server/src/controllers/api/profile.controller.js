import User from "../../models/User.js";
import Post from "../../models/Post.js";
import Follower from "../../models/Follower.js";
import DoodleRequest from "../../models/DoodleRequest.js";
import { createNotification } from "../../services/notification.service.js";
import redisClient from "../../config/redis.js";
import { bucket } from "../../config/firebase.js";

// ============================================================
// GET USER PROFILE (With Redis Caching)
// ============================================================
export const getUserProfile = async (req, res) => {
  try {
    const profileUserId = req.params.id;
    const viewerId = req.user?.id;

    // UUID Validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(profileUserId)) {
      return res.status(400).json({ success: false, message: "Invalid ID format" });
    }

    const cacheKey = `userProfile:${profileUserId}:viewer:${viewerId || "guest"}`;

    // Redis Check
    if (redisClient?.isReady) {
      const cached = await redisClient.get(cacheKey);
      if (cached) return res.json({ success: true, ...JSON.parse(cached) });
    }

    const user = await User.findByPk(profileUserId, {
      attributes: ["id", "username", "name", "bio", "profilePhoto", "doodleImage", "doodleData", "doodleOwnerId", "isPrivate"]
    });

    if (!user) return res.status(404).json({ message: "User not found" });

    // Concurrent fetching for speed
    const [followersCount, followingCount, postsCount] = await Promise.all([
      Follower.count({ where: { followingId: profileUserId } }),
      Follower.count({ where: { followerId: profileUserId } }),
      Post.count({ where: { userId: profileUserId } })
    ]);

    let follow = null;
    if (viewerId) {
      follow = await Follower.findOne({ where: { followerId: viewerId, followingId: profileUserId } });
    }

    const isFollowing = follow?.status === "accepted";
    let canViewFullProfile = true;
    if (user.isPrivate && viewerId !== profileUserId && !isFollowing) {
      canViewFullProfile = false;
    }

    const showDoodle = viewerId === profileUserId || isFollowing;

    let posts = [];
    if (canViewFullProfile) {
      posts = await Post.findAll({ where: { userId: profileUserId }, order: [["createdAt", "DESC"]] });
    }

    // Doodle Logic
    let effectiveDoodleImage = user.doodleImage;
    let effectiveDoodleData = user.doodleData;
    let effectiveDoodleOwnerId = user.doodleOwnerId;

    if (viewerId && viewerId !== profileUserId) {
      const acceptedRequest = await DoodleRequest.findOne({
        where: { senderId: viewerId, receiverId: profileUserId, status: "accepted" },
        order: [["updatedAt", "DESC"]]
      });

      if (acceptedRequest) {
        effectiveDoodleImage = acceptedRequest.doodleImage || null;
        effectiveDoodleData = acceptedRequest.doodleData || null;
        effectiveDoodleOwnerId = acceptedRequest.senderId;
      }
    }

    const profileData = {
      profile: {
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          bio: user.bio,
          profilePhoto: user.profilePhoto,
          doodleImage: showDoodle ? effectiveDoodleImage : null,
          doodleData: showDoodle ? effectiveDoodleData : null,
          doodleOwnerId: showDoodle ? effectiveDoodleOwnerId : null,
          isPrivate: user.isPrivate
        },
        stats: canViewFullProfile ? { followers: followersCount, following: followingCount, posts: postsCount } : null,
        isFollowing,
        canViewFullProfile,
        showDoodle,
        posts
      }
    };

    if (redisClient?.isReady) await redisClient.setEx(cacheKey, 300, JSON.stringify(profileData));

    return res.json({ success: true, ...profileData });
  } catch (error) {
    console.error("GET USER PROFILE ERROR:", error);
    return res.status(500).json({ message: "Profile failed" });
  }
};

// ============================================================
// UPDATE MY PROFILE (With GCS & Cache Clear)
// ============================================================
export const updateMyProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    let { name, bio, dateOfBirth, gender, username } = req.body;
    username = username?.trim();

    if (username && username !== user.username) {
      const existing = await User.findOne({ where: { username } });
      if (existing) return res.status(400).json({ message: "Username taken" });
    }

    let profilePhoto = user.profilePhoto;
    if (req.file) {
      const fileName = `profile_images/user_${req.user.id}_${Date.now()}`;
      const blob = bucket.file(fileName);
      
      // Using blob.save for better stability with JWT
      await blob.save(req.file.buffer, {
        metadata: { contentType: req.file.mimetype },
        resumable: false
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

    // Clean Redis Cache
    if (redisClient?.isReady) {
      const keys = await redisClient.keys(`userProfile:${req.user.id}:*`);
      if (keys.length > 0) await redisClient.del(keys);
      await redisClient.del(`myProfile:${req.user.id}`);
    }

    return res.json({ success: true, message: "Profile updated", user });
  } catch (error) {
    console.error("UPDATE PROFILE ERROR:", error);
    res.status(500).json({ message: "Update failed" });
  }
};

// ============================================================
// GET MY PROFILE
// ============================================================
// export const getMyProfile = async (req, res) => {
//   try {
//     const cacheKey = `myProfile:${req.user.id}`;
//     if (redisClient?.isReady) {
//       const cached = await redisClient.get(cacheKey);
//       if (cached) return res.json({ success: true, user: JSON.parse(cached) });
//     }

//     const user = await User.findByPk(req.user.id, {
//       attributes: ["id", "name", "username", "profilePhoto", "bio", "dateOfBirth", "gender", "doodleImage", "doodleOwnerId"]
//     });

//     if (redisClient?.isReady) await redisClient.setEx(cacheKey, 600, JSON.stringify(user));
//     res.json({ success: true, user });
//   } catch (error) {
//     res.status(500).json({ message: "Failed to fetch profile" });
//   }
// };

//updated
export const getMyProfile = async (req, res) => {
  try {
    const cacheKey = `myProfile:${req.user.id}`;
    
    // Redis clear karke fresh data mangwao
    const user = await User.findByPk(req.user.id, {
      attributes: ["id", "name", "username", "profilePhoto", "bio", "dateOfBirth", "gender", "doodleImage", "doodleOwnerId", "doodleData"]
    });

    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    // Response structure ko App ke hisaab se set karo
    res.json({ 
      success: true, 
      data: {
        profile: {
          user: user
        }
      }
    });
  } catch (error) {
    console.error("GET MY PROFILE ERROR:", error);
    res.status(500).json({ success: false, message: "Failed to fetch profile" });
  }
};

// ============================================================
// SEND DOODLE REQUEST (GCS Base64 Fix)
// ============================================================
export const sendDoodleRequest = async (req, res) => {
  try {
    const senderId = req.user.id;
    const { receiverId, base64Image, doodleData } = req.body;

    let finalDoodleImage = null;

    // Case 1: Base64 Canvas
    if (base64Image) {
      const base64Clean = base64Image.includes('base64,') ? base64Image.split('base64,')[1] : base64Image;
      const buffer = Buffer.from(base64Clean, "base64");
      
      if (buffer.length < 500) throw new Error("Invalid image data");

      const fileName = `doodle_images/doodle_${senderId}_${Date.now()}.png`;
      const blob = bucket.file(fileName);

      await blob.save(buffer, {
        metadata: { contentType: "image/png" },
        resumable: false
      });

      finalDoodleImage = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    } 
    // Case 2: Multi-part File
    else if (req.file) {
      const fileName = `doodle_images/doodle_${senderId}_${Date.now()}`;
      const blob = bucket.file(fileName);
      await blob.save(req.file.buffer, { metadata: { contentType: req.file.mimetype } });
      finalDoodleImage = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    }

    const request = await DoodleRequest.create({
      senderId,
      receiverId,
      doodleImage: finalDoodleImage,
      doodleData: doodleData || null,
      status: "pending",
    });

    await createNotification({ senderId, receiverId, type: "DOODLE_REQUEST", doodleRequestId: request.id });

    return res.status(201).json({ success: true, message: "Doodle request sent", request });
  } catch (error) {
    console.error("DOODLE SEND ERROR:", error);
    return res.status(500).json({ message: "Failed to send request" });
  }
};

// ============================================================
// ACCEPT / REJECT / GET DOODLE REQUESTS
// ============================================================
export const acceptDoodleRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user.id;

    const request = await DoodleRequest.findByPk(requestId);
    if (!request || request.receiverId !== userId) return res.status(403).json({ message: "Not allowed" });

    await request.update({ status: "accepted" });
    await User.update(
      { doodleImage: request.doodleImage, doodleData: request.doodleData, doodleOwnerId: request.senderId },
      { where: { id: userId } }
    );

    if (redisClient?.isReady) {
       const keys = await redisClient.keys(`userProfile:${userId}:*`);
       if (keys.length > 0) await redisClient.del(keys);
       await redisClient.del(`myProfile:${userId}`);
    }

    await createNotification({ senderId: userId, receiverId: request.senderId, type: "DOODLE_ACCEPTED", doodleRequestId: request.id });
    res.json({ success: true, message: "Doodle applied" });
  } catch (error) {
    res.status(500).json({ message: "Accept failed" });
  }
};

export const rejectDoodleRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const request = await DoodleRequest.findByPk(requestId);
    if (!request || request.receiverId !== req.user.id) return res.status(403).json({ message: "Not allowed" });

    await request.update({ status: "rejected" });
    res.json({ success: true, message: "Rejected" });
  } catch (error) {
    res.status(500).json({ message: "Reject failed" });
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
    res.status(500).json({ message: "Fetch failed" });
  }
};