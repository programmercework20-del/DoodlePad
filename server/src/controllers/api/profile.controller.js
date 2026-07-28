import { Op } from "sequelize";
import { User, Follower, Post, DoodleRequest } from "../../models/index.js";
import Block from "../../models/Block.js";
import { createNotification } from "../../services/notification.service.js";
import { formatDoodleRequestResponseItem } from "../../services/requestPayload.js";
import redisClient from "../../config/redis.js";
import { bucket } from "../../config/firebase.js";

// 🔥 Helper: Ensures safe array parsing & unified keys for Frontend
const normalizeDoodles = (arr) => {
  let parsed = arr;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch (e) {
      parsed = [];
    }
  }
  if (!Array.isArray(parsed)) return [];

  return parsed.map(d => ({
    ...d,
    senderId: d.senderId || d.ownerId || null,
    ownerId: d.ownerId || d.senderId || null,
    senderName: d.senderName || d.name || null,
    name: d.name || d.senderName || null,
    senderUsername: d.senderUsername || d.username || null,
    username: d.username || d.senderUsername || null,
    senderProfilePhoto: d.senderProfilePhoto || d.profilePhoto || null,
    profilePhoto: d.profilePhoto || d.senderProfilePhoto || null,
  }));
};

const isPrivacyEnabled = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
  }
  return Boolean(value);
};

export const getUserProfile = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const targetUserId = req.params.id;


    // 🛡️ GUARD CHECK: DB hit hone se pehle hi invalid ID ko rok do
    if (!targetUserId || targetUserId === "undefined" || targetUserId === "null") {
      return res.status(400).json({ success: false, message: "Invalid target user ID" });
    }

    const isOwnProfile = String(currentUserId) === String(targetUserId);

    const user = await User.findByPk(targetUserId, {
      attributes: {
        exclude: ['password', 'otp', 'otpExpires', 'phoneOtp',
                  'phoneOtpExpires', 'fcmToken', 'resetPasswordToken']
      }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (isOwnProfile) {
      const [followersCount, followingCount, postsCount] = await Promise.all([
        Follower.count({ where: { followingId: targetUserId, status: "accepted" } }),
        Follower.count({ where: { followerId: targetUserId, status: "accepted" } }),
        Post.count({ where: { userId: targetUserId, status: "active" } })
      ]);

      const userPosts = await Post.findAll({
        where: {
          userId: targetUserId,
          status: "active"
        },
        order: [['createdAt', 'DESC']],
        limit: 50
      });

      // Ensure activeDoodles always include explicit owner fields so FE maps correctly
      const normalizeDoodles = (arr) => (Array.isArray(arr) ? arr.map(d => ({
        ...d,
        name: d.senderName || d.name || null,
        username: d.senderUsername || d.username || null,
        profilePhoto: d.senderProfilePhoto || d.profilePhoto || null,
        ownerId: d.senderId || d.ownerId || null
      })) : []);

      return res.status(200).json({
        success: true,
        data: {
          profile: {
            user: {
              id: user.id,
              name: user.name,
              username: user.username,
              bio: user.bio,
              profilePhoto: user.profilePhoto,
              isPrivate: user.isPrivate,
              isVerified: user.isVerified,
              activeDoodles: normalizeDoodles(user.activeDoodles),
              doodleImage: user.doodleImage,
              doodleData: user.doodleData,
              doodleOwnerId: user.doodleOwnerId,
              isFollowing: false,
              isRequestPending: false,
              canViewProfile: true,
              isMutualFollow: false,
              followsYou: false
            },
            stats: {
              followers: followersCount,
              following: followingCount,
              posts: postsCount
            },
            posts: userPosts,
            isFollowing: false,
            isRequestPending: false,
            canViewProfile: true,
            isMutualFollow: false,
            followsYou: false
          },
          isFollowing: false,
          isRequestPending: false,
          canViewProfile: true,
          isMutualFollow: false,
          followsYou: false
        }
      });
    }

    // 🛡️ 1. BLOCK CHECK
    const blockRecord = await Block.findOne({
      where: {
        [Op.or]: [
          { blockerId: currentUserId, blockedId: targetUserId },
          { blockerId: targetUserId, blockedId: currentUserId }
        ]
      }
    });

    if (blockRecord) {
      return res.status(403).json({
        success: false,
        message: "This profile is not available."
      });
    }

    // 📊 2. STATS
    const [followersCount, followingCount, postsCount] = await Promise.all([
      Follower.count({ where: { followingId: targetUserId, status: "accepted" } }),
      Follower.count({ where: { followerId: targetUserId, status: "accepted" } }),
      Post.count({ where: { userId: targetUserId, status: "active" } })
    ]);

    // 🤝 3. FOLLOW STATUS
    const currentUserFollowsTarget = await Follower.findOne({
      where: {
        followerId: currentUserId,
        followingId: targetUserId,
        status: "accepted"
      }
    });
    const targetFollowsCurrentUser = await Follower.findOne({
      where: {
        followerId: targetUserId,
        followingId: currentUserId,
        status: "accepted"
      }
    });
    const isFollowing = !!currentUserFollowsTarget;
    const isMutualFollow = !!currentUserFollowsTarget && !!targetFollowsCurrentUser;

    // 🔥 4. PENDING REQUEST CHECK
    const pendingRequest = await Follower.findOne({
      where: {
        followerId: currentUserId,
        followingId: targetUserId,
        status: "pending"
      }
    });
    const isRequestPending = !!pendingRequest;

    // 🖼️ 5. POSTS — Privacy wall
    const isTargetPrivate = isPrivacyEnabled(user.isPrivate);
    let userPosts = [];
    const canViewProfile = !isTargetPrivate || isFollowing || isMutualFollow || !!targetFollowsCurrentUser;

    if (canViewProfile) {
      userPosts = await Post.findAll({
        where: {
          userId: targetUserId,
          status: "active"
        },
        order: [['createdAt', 'DESC']],
        limit: 50
      });
    }

    // activeDoodles (cover slider) should be visible to everyone regardless of privacy
    const showDoodle = true;

    const normalizeDoodles = (arr) => (Array.isArray(arr) ? arr.map(d => ({
      ...d,
      name: d.senderName || d.name || null,
      username: d.senderUsername || d.username || null,
      profilePhoto: d.senderProfilePhoto || d.profilePhoto || null,
      ownerId: d.senderId || d.ownerId || null
    })) : []);

    return res.status(200).json({
      success: true,
      data: {
        profile: {
          user: {
            id: user.id,
            name: user.name,
            username: user.username,
            bio: user.bio,
            profilePhoto: user.profilePhoto,
              isPrivate: user.isPrivate,
              isVerified: user.isVerified,
              activeDoodles: normalizeDoodles(user.activeDoodles),
              doodleImage: showDoodle ? user.doodleImage : null,
              doodleData: showDoodle ? user.doodleData : null,
              doodleOwnerId: showDoodle ? user.doodleOwnerId : null,
            isFollowing,
            isRequestPending,
            canViewProfile,
            isMutualFollow,
            followsYou: !!targetFollowsCurrentUser
          },
          stats: {
            followers: followersCount,
            following: followingCount,
            posts: postsCount
          },
          posts: userPosts,
          isFollowing,
          isRequestPending,
          canViewProfile,
          isMutualFollow,
          followsYou: !!targetFollowsCurrentUser
        },
        isFollowing,
        isRequestPending,
        canViewProfile,
        isMutualFollow,
        followsYou: !!targetFollowsCurrentUser
      }
    });
  } catch (error) {
    console.error("🔥 GET USER PROFILE ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch user profile"
    });
  }
};

// 2. UPDATE MY PROFILE
export const updateMyProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    // 🔥 TRAP 1: Dekhte hain Frontend ne actual mein kya bheja hai
    console.log("🕵️‍♂️ [DEBUG] Frontend se ye payload aaya:", req.body);

    let { name, bio, dateOfBirth, gender, username, isPrivate } = req.body;

    // 🔥 TRAP 2: Dekhte hain extract kya hua
    console.log("🕵️‍♂️ [DEBUG] isPrivate ki raw value:", isPrivate);

    username = username?.trim();
    name = name?.trim();
    bio = bio?.trim();

    if (username && username !== user.username) {
      const existing = await User.findOne({ where: { username } });
      if (existing) return res.status(400).json({ success: false, message: "Username already taken" });
    }

    // 🔥 FIX: Restored Google Cloud Storage Upload Logic
    let profilePhoto = user.profilePhoto;
    if (req.file) {
      const fileName = `profile_images/user_${userId}_${Date.now()}`;
      const blob = bucket.file(fileName);
      await blob.save(req.file.buffer, { 
        metadata: { contentType: req.file.mimetype },
        resumable: false 
      });
      profilePhoto = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
      console.log("📸 [SUCCESS] New profile photo uploaded to GCS:", profilePhoto);
    }

    let parsedIsPrivate = user.isPrivate;
    if (isPrivate !== undefined) {
      parsedIsPrivate = isPrivate === "true" || isPrivate === true;
    }

    // 🔥 TRAP 3: DB mein save hone se pehle final value kya bani
    console.log("🕵️‍♂️ [DEBUG] Database mein save hone wali value:", parsedIsPrivate);

    // Update the database record
    await user.update({
      name: name ?? user.name,
      username: username ?? user.username,
      bio: bio ?? user.bio,
      dateOfBirth: dateOfBirth ?? user.dateOfBirth,
      gender: gender || null,
      profilePhoto,
      isPrivate: parsedIsPrivate 
    });

   // 🔥 COMPLETE CACHE INVALIDATION (Updated with Feed & Posts clearing)
try {
  if (redisClient?.isReady) {
    // 1. Profile cache version badhao
    const versionKey = `profileCacheVersion:${userId}`;
    const currentVersion = await redisClient.get(versionKey);
    const newVersion = currentVersion ? `v${parseInt(currentVersion.replace('v', '')) + 1}` : 'v2';
    await redisClient.setEx(versionKey, 86400, newVersion);

    // 2. Personal profile cache delete karo
    await redisClient.del(`myProfile:${userId}`);

    // 3. 🔥 NEW FIX: User ke apne posts ka cache clear karo (Taaki uski purani pic posts se hate)
    await redisClient.del(`userPosts:${userId}`);

    // 4. 🔥 NEW FIX: Feed ka cache clear karo (Apni feed aur common feed key jo bhi aap use kar rahe ho)
    await redisClient.del(`feed:${userId}`); 
    // Agar aapke paas koi global ya main feed ki key hai jaise 'mainFeed' ya 'globalFeed', toh use bhi yahan del karein:
    // await redisClient.del(`mainFeed`);

    console.log(`🧹 [PROFILE UPDATE] All related caches (Profile, Posts, Feed) cleared for user: ${userId}`);
  }
} catch (cacheErr) {
  console.error("⚠️ Redis Cache clearance exception:", cacheErr.message);
}

    return res.json({ success: true, message: "Profile updated successfully", user });
  } catch (error) {
    console.error("🔥 UPDATE PROFILE ERROR:", error);
    return res.status(500).json({ success: false, message: "Profile update execution failed" });
  }
};

// get my profile (with caching)
// ============================================================
// GET MY PROFILE (Fixed ReferenceError & 60s Redis TTL)
// ============================================================
export const getMyProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Check Redis Cache
    if (redisClient?.isReady) {
      try {
        const cached = await redisClient.get(`myProfile:${userId}`);
        if (cached) {
          return res.json(JSON.parse(cached));
        }
      } catch (e) {
        console.error("⚠️ Redis GET error:", e.message);
      }
    }

    // 2. Fetch User from DB
    const user = await User.findByPk(userId, {
      attributes: {
        exclude: ['password', 'otp', 'otpExpires', 'phoneOtp', 'phoneOtpExpires', 'fcmToken', 'resetPasswordToken']
      }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // 3. Normalize Active Doodles
    const activeDoodles = normalizeDoodles(user.activeDoodles);

    // 🔥 FIX: profileData variable explicitly defined here
    const profileData = {
      success: true,
      data: {
        profile: {
          user: {
            ...user.toJSON(),
            activeDoodles: activeDoodles
          }
        }
      }
    };

    // 4. Set Redis Cache with 60 seconds TTL
    if (redisClient?.isReady) {
      try {
        await redisClient.setEx(`myProfile:${userId}`, 60, JSON.stringify(profileData));
      } catch (e) {
        console.error("⚠️ Redis SET error:", e.message);
      }
    }

    return res.json(profileData);

  } catch (error) {
    console.error("🔥 GET PROFILE ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch profile" });
  }
};
// ============================================================
// 4. SEND DOODLE REQUEST (Updated GCS Path to doodle_covers)
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

    // 🔥 FIX: Upload path updated to 'doodles/doodle_covers/'
    if (req.file) {
      const fileName = `doodles/doodle_covers/doodle_${senderId}_${Date.now()}`;
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
      const fileName = `doodles/doodle_covers/doodle_${senderId}_${Date.now()}.png`;
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
    const userId = req.user.id;

    // 1. Fetch Active Pending Doodle Requests
    const pendingRequests = await DoodleRequest.findAll({
      where: { receiverId: userId, status: "pending" },
      include: [
        {
          model: User,
          as: "sender",
          attributes: ["id", "name", "username", "profilePhoto"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    // 2. 🔥 NEW: Fetch Recent Doodle History (Accepted / Rejected)
    const historyRequests = await DoodleRequest.findAll({
      where: { 
        receiverId: userId, 
        status: { [Op.in]: ["accepted", "rejected"] } 
      },
      include: [
        {
          model: User,
          as: "sender",
          attributes: ["id", "name", "username", "profilePhoto"],
        },
      ],
      order: [["updatedAt", "DESC"]],
      limit: 20
    });

    // 🔥 PRO-LEVEL FIX: Wrapper to inject type and message safely
    const formatWithUIText = (req) => {
      // Keep existing formatter intact
      const formatted = formatDoodleRequestResponseItem(req);
      return {
        ...formatted,
        type: "DOODLE_REQUEST",
        message: "sent you a doodle request"
      };
    };

    return res.json({
      success: true,
      pending: pendingRequests.map(formatWithUIText),
      history: historyRequests.map(formatWithUIText)
    });

  } catch (error) {
    console.error("🔥 FETCH DOODLE REQUESTS ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch requests" });
  }
};


export const acceptDoodleRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user.id; // Receiver

    const request = await DoodleRequest.findByPk(requestId, {
      include: [{ model: User, as: "sender", attributes: ["id", "name", "username", "profilePhoto"] }]
    });

    if (!request || String(request.receiverId) !== String(userId)) {
      return res.status(403).json({ success: false, message: "Not allowed" });
    }

    if (request.status !== "pending") {
      return res.status(400).json({ success: false, message: "Request already processed" });
    }

    const user = await User.findByPk(userId);

    // 🔥 FIX 1: Safe Parsing via normalizeDoodles
    let activeDoodles = normalizeDoodles(user.activeDoodles);

    // 🔥 FIX 2: Store both senderUsername and username to prevent @Unknown in FE
    const newDoodle = {
      senderId: request.senderId,
      ownerId: request.senderId,
      senderName: request.sender?.name || null,
      name: request.sender?.name || null,
      senderUsername: request.sender?.username || null,
      username: request.sender?.username || null,
      senderProfilePhoto: request.sender?.profilePhoto || null,
      profilePhoto: request.sender?.profilePhoto || null,
      doodleImage: request.doodleImage,
      doodleData: request.doodleData,
      acceptedAt: new Date().toISOString()
    };

    // Replacement logic (Same friend = update doodle)
    const existingIndex = activeDoodles.findIndex(
      d => String(d.senderId || d.ownerId) === String(request.senderId)
    );

    if (existingIndex !== -1) {
      activeDoodles[existingIndex] = newDoodle;
    } else {
      if (activeDoodles.length >= 10) {
        activeDoodles.shift();
      }
      activeDoodles.push(newDoodle);
    }

    // DB Update
    await request.update({ status: "accepted" });

    user.activeDoodles = activeDoodles;
    user.changed('activeDoodles', true);
    await user.save();

    // 🔥 FIX 3: Redis Cache Hard Wipe
    if (redisClient?.isReady) {
      try {
        await Promise.all([
          redisClient.del(`myProfile:${userId}`),
          redisClient.del(`profile:${userId}`),
          redisClient.del(`myProfile:${request.senderId}`),
          redisClient.del(`profile:${request.senderId}`)
        ]);
        console.log(`🧹 [REDIS WIPED] Profile caches cleared for ${userId} and ${request.senderId}`);
      } catch (ce) {
        console.error("Redis clearance error:", ce.message);
      }
    }

    return res.json({
      success: true,
      message: "Doodle accepted and added to cover slider",
      activeDoodles: activeDoodles
    });

  } catch (error) {
    console.error("🔥 DOODLE ACCEPT ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to accept request" });
  }
};

//
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