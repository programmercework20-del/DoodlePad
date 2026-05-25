import { Op } from "sequelize";
import { User, Follower, Post, DoodleRequest } from "../../models/index.js";
import Block from "../../models/Block.js"; // 🔥 FIXED: Imported directly because it's missing in models/index.js
import { createNotification } from "../../services/notification.service.js";
import redisClient from "../../config/redis.js";
import { bucket } from "../../config/firebase.js";

// ============================================================
// 1. GET USER PROFILE (With Strict Block Validation Prioritization)
// ============================================================
export const getUserProfile = async (req, res) => {
  try {
    const profileUserId = req.params.id;
    const viewerId = req.user?.id;

    // UUID Format Validation Strategy
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(profileUserId)) {
      return res.status(400).json({ success: false, message: "Invalid ID format" });
    }

    // 🛡️ Block layers check must execute BEFORE checking cache layers
    if (viewerId) {
      const isBlocked = await Block.findOne({
        where: {
          [Op.or]: [
            { blockerId: viewerId, blockedId: profileUserId },
            { blockerId: profileUserId, blockedId: viewerId }
          ]
        },
        raw: true
      });

      if (isBlocked) {
        return res.status(403).json({ success: false, message: "Action not allowed due to block status" });
      }
    }

    const cacheKey = `userProfile:${profileUserId}:viewer:${viewerId || "guest"}`;

    // Redis Memory Fetch Execution
    if (redisClient?.isReady) {
      try {
        const cached = await redisClient.get(cacheKey);
        if (cached) return res.json({ success: true, ...JSON.parse(cached) });
      } catch (e) {
        console.error("⚠️ Redis Read Error inside Profile context:", e.message);
      }
    }

    const user = await User.findOne({
      where: {
        id: profileUserId,
        isDeactivated: false,
      },
      attributes: ["id", "username", "name", "bio", "profilePhoto", "doodleImage", "doodleData", "doodleOwnerId", "isPrivate"]
    });

    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    // Concurrent DB Counts optimization execution
    const [followersCount, followingCount, postsCount] = await Promise.all([
      Follower.count({ where: { followingId: profileUserId, status: "accepted" } }),
      Follower.count({ where: { followerId: profileUserId, status: "accepted" } }),
      Post.count({ where: { userId: profileUserId, status: "active" } })
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
      posts = await Post.findAll({
        where: { userId: profileUserId, status: "active" },
        order: [["createdAt", "DESC"]],
        limit: 100
      });
    }

    // Dynamic Doodle Processing Logic Layer
    let effectiveDoodleImage = user.doodleImage;
    let effectiveDoodleData = user.doodleData;
    let effectiveDoodleOwnerId = user.doodleOwnerId;

    if (viewerId && viewerId !== profileUserId) {
      const acceptedRequest = await DoodleRequest.findOne({
        where: { senderId: viewerId, receiverId: profileUserId, status: "accepted" },
        order: [["updatedAt", "DESC"]],
        raw: true
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
        stats: { followers: followersCount, following: followingCount, posts: postsCount },
        isFollowing,
        canViewFullProfile,
        showDoodle,
        posts
      }
    };

    if (redisClient?.isReady) {
      await redisClient.setEx(cacheKey, 300, JSON.stringify(profileData)).catch(() => { });
    }

    return res.json({ success: true, ...profileData });

  } catch (error) {
    console.error("🔥 GET USER PROFILE ERROR:", error);
    return res.status(500).json({ success: false, message: "Profile compilation layer failed" });
  }
};

// ============================================================
// 2. UPDATE MY PROFILE
// ============================================================
export const updateMyProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    let { name, bio, dateOfBirth, gender, username } = req.body;

    username = username?.trim();
    name = name?.trim();
    bio = bio?.trim();

    if (username && username !== user.username) {
      const existing = await User.findOne({ where: { username } });
      if (existing) return res.status(400).json({ success: false, message: "Username already taken" });
    }

    let profilePhoto = user.profilePhoto;
    if (req.file) {
      const fileName = `profile_images/user_${userId}_${Date.now()}`;
      const blob = bucket.file(fileName);

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

    if (redisClient?.isReady) {
      try {
        await redisClient.del(`myProfile:${userId}`);
        const defaultGuestKey = `userProfile:${userId}:viewer:guest`;
        const defaultSelfKey = `userProfile:${userId}:viewer:${userId}`;
        await Promise.all([
          redisClient.del(defaultGuestKey),
          redisClient.del(defaultSelfKey)
        ]);
      } catch (cacheErr) {
        console.error("⚠️ Redis Cache clearance exception:", cacheErr.message);
      }
    }

    return res.json({ success: true, message: "Profile updated successfully", user });
  } catch (error) {
    console.error("🔥 UPDATE PROFILE ERROR:", error);
    return res.status(500).json({ success: false, message: "Profile update execution failed" });
  }
};

// ============================================================
// 3. GET MY PROFILE
// ============================================================
export const getMyProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const cacheKey = `myProfile:${userId}`;

    if (redisClient?.isReady) {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          data: { profile: { user: JSON.parse(cached) } }
        });
      }
    }

    const user = await User.findByPk(userId, {
      attributes: ["id", "name", "username", "profilePhoto", "bio", "dateOfBirth", "gender", "doodleImage", "doodleOwnerId", "doodleData", "isDeactivated"]
    });

    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    if (redisClient?.isReady) await redisClient.setEx(cacheKey, 600, JSON.stringify(user)).catch(() => { });

    return res.json({
      success: true,
      data: {
        profile: {
          user: user
        }
      }
    });
  } catch (error) {
    console.error("🔥 GET PROFILE ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch profile layout" });
  }
};

// ============================================================
// 4. SEND DOODLE REQUEST
// ============================================================
export const sendDoodleRequest = async (req, res) => {
  try {
    const senderId = req.user.id;
    const { receiverId, base64Image, paths, doodleData } = req.body;

    if (!receiverId) {
      return res.status(400).json({ success: false, message: "Receiver ID is required" });
    }

    let finalDoodleImage = null;
    let finalDoodleData = null;

    if (Array.isArray(paths) && paths.length > 0) {
      finalDoodleData = JSON.stringify(paths);
    } else if (typeof doodleData === "string" && doodleData.trim()) {
      finalDoodleData = doodleData;
    }

    if (req.file) {
      const fileName = `doodles/doodle_${senderId}_${Date.now()}`;
      const blob = bucket.file(fileName);
      await blob.save(req.file.buffer, {
        metadata: { contentType: req.file.mimetype },
        resumable: false,
      });
      finalDoodleImage = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    }
    else if (base64Image) {
      const base64Clean = base64Image.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Clean, "base64");
      const fileName = `doodles/doodle_${senderId}_${Date.now()}.png`;
      const blob = bucket.file(fileName);
      await blob.save(buffer, {
        metadata: { contentType: "image/png" },
        resumable: false,
      });
      finalDoodleImage = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    }

    if (!finalDoodleImage && !finalDoodleData) {
      return res.status(400).json({ success: false, message: "Doodle paths or image required" });
    }

    const request = await DoodleRequest.create({
      senderId,
      receiverId,
      doodleImage: finalDoodleImage,
      doodleData: finalDoodleData,
      status: "pending",
    });

    await createNotification({
      senderId,
      receiverId,
      type: "DOODLE_REQUEST",
      doodleRequestId: request.id,
    }).catch(err => console.error("⚠️ Notification Error:", err.message));

    if (redisClient?.isReady) {
      await redisClient.del(`doodle_requests:${receiverId}`).catch(() => { });
    }

    return res.status(201).json({
      success: true,
      message: "Doodle request sent successfully",
      request,
    });

  } catch (error) {
    console.error("🔥 DOODLE SEND ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to send doodle request" });
  }
};

// ============================================================
// 5. GET DOODLE REQUESTS
// ============================================================
export const getDoodleRequests = async (req, res) => {
  try {
    const requests = await DoodleRequest.findAll({
      where: { receiverId: req.user.id, status: "pending" },
      include: [
        {
          model: User,
          as: "sender",
          attributes: ["id", "name", "username", "profilePhoto"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    return res.json({
      success: true,
      requests
    });
  } catch (error) {
    console.error("🔥 FETCH DOODLE REQUESTS ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch requests" });
  }
};

// ============================================================
// 6. ACCEPT DOODLE REQUEST
// ============================================================
export const acceptDoodleRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user.id;

    const request = await DoodleRequest.findByPk(requestId);

    if (!request || request.receiverId !== userId) {
      return res.status(403).json({ success: false, message: "Not allowed" });
    }

    if (request.status !== "pending") {
      return res.status(400).json({ success: false, message: "Already processed" });
    }

    await request.update({ status: "accepted" });

    await User.update(
      {
        doodleImage: request.doodleImage || null,
        doodleData: request.doodleData || null,
        doodleOwnerId: request.senderId
      },
      { where: { id: userId } }
    );

    if (redisClient?.isReady) {
      try {
        await redisClient.del(`myProfile:${userId}`);
        const guestKey = `userProfile:${userId}:viewer:guest`;
        const selfKey = `userProfile:${userId}:viewer:${userId}`;
        const senderKey = `userProfile:${userId}:viewer:${request.senderId}`;
        await Promise.all([
          redisClient.del(guestKey),
          redisClient.del(selfKey),
          redisClient.del(senderKey)
        ]);
      } catch (ce) { console.error(ce); }
    }

    await createNotification({
      senderId: userId,
      receiverId: request.senderId,
      type: "DOODLE_ACCEPTED",
      doodleRequestId: request.id
    }).catch(() => { });

    return res.json({
      success: true,
      message: "Doodle applied to profile",
      doodleImage: request.doodleImage || null,
      doodleData: request.doodleData || null
    });
  } catch (error) {
    console.error("🔥 DOODLE ACCEPT ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to accept request" });
  }
};

// ============================================================
// 7. REJECT DOODLE REQUEST
// ============================================================
export const rejectDoodleRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const request = await DoodleRequest.findByPk(requestId);
    if (!request || request.receiverId !== req.user.id) return res.status(403).json({ success: false, message: "Not allowed" });

    await request.update({ status: "rejected" });
    return res.json({ success: true, message: "Doodle request rejected" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to reject request" });
  }
};