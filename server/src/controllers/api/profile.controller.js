import { Op } from "sequelize";
import { User, Follower, Post, DoodleRequest } from "../../models/index.js";
import Block from "../../models/Block.js";
import { createNotification } from "../../services/notification.service.js";
import redisClient from "../../config/redis.js";
import { bucket } from "../../config/firebase.js";



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
      attributes: [
        "id", "name", "username", "profilePhoto", "bio",
        "dateOfBirth", "gender", "doodleImage", "doodleOwnerId",
        "doodleData", "isDeactivated", "isPrivate",
        "activeDoodles" // 🔥 FIX: Add kiya
      ]
    });

    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const userData = user.toJSON ? user.toJSON() : user;
    const normalizeDoodles = (arr) => (Array.isArray(arr) ? arr.map(d => ({
      ...d,
      name: d.senderName || d.name || null,
      username: d.senderUsername || d.username || null,
      profilePhoto: d.senderProfilePhoto || d.profilePhoto || null,
      ownerId: d.senderId || d.ownerId || null
    })) : []);

    const profileUser = {
      ...userData,
      activeDoodles: normalizeDoodles(userData.activeDoodles)
    };

    if (redisClient?.isReady) {
      await redisClient.setEx(cacheKey, 600, JSON.stringify(profileUser)).catch(() => { });
    }

    return res.json({
      success: true,
      data: {
        profile: {
          user: profileUser
        }
      }
    });
  } catch (error) {
    console.error("🔥 GET PROFILE ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch profile layout" });
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

    return res.json({
      success: true,
      pending: pendingRequests,
      history: historyRequests
    });

  } catch (error) {
    console.error("🔥 FETCH DOODLE REQUESTS ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch requests" });
  }
};

// ============================================================
// 6. ACCEPT DOODLE REQUEST (Fixed Replacement & JSONB DB Update)
// ============================================================
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

    console.log("========== ACCEPT ==========");
console.log("Logged In User :", req.user.id);
console.log("Receiver ID    :", request.receiverId);
console.log("Sender ID      :", request.senderId);
console.log("============================");

    const user = await User.findByPk(userId);

    console.log("Updating user:", user.id);
console.log("Updating username:", user.username);

console.log(
  "Saved activeDoodles:",
  user.activeDoodles
);

console.log("Receiver:", user.username);

console.log(
    "DB activeDoodles before accept:",
    JSON.stringify(user.activeDoodles, null, 2)
);
    

    let activeDoodles = [];

    if (Array.isArray(user.activeDoodles)) {
      activeDoodles = [...user.activeDoodles];
    } else if (typeof user.activeDoodles === "string") {
      try {
        activeDoodles = JSON.parse(user.activeDoodles);
      } catch {
        activeDoodles = [];
      }
    }

    const newDoodle = {
      senderId: request.senderId,
      senderName: request.sender?.name || null,
      senderUsername: request.sender?.username || null,
      senderProfilePhoto: request.sender?.profilePhoto || null,
      doodleImage: request.doodleImage,
      doodleData: request.doodleData,
      acceptedAt: new Date().toISOString()
    };

    // 🔥 FIX 1: Strict String Comparison for Replacement Check
    const existingIndex = activeDoodles.findIndex(
      d => String(d.senderId) === String(request.senderId)
    );

    if (existingIndex !== -1) {
      // Same friend ka doodle replace ho jayega
      activeDoodles[existingIndex] = newDoodle;
    } else {
      // Naya friend hai, max 10 limit check karo
      if (activeDoodles.length >= 10) {
        activeDoodles.shift(); // Purana sabse pehla doodle remove hoga
      }
      activeDoodles.push(newDoodle);
    }

    // Status update
    await request.update({ status: "accepted" });

    // 🔥 FIX 2: Force Sequelize to recognize JSONB mutation and update DB
    // 🔥 FIX: Save JSONB explicitly
    await User.update(
      {
        activeDoodles
      },
      {
        where: { id: userId }
      }
    );

    // 🔥 Verify DB update
    const updatedUser = await User.findByPk(userId);

    console.log(
      "✅ Updated activeDoodles:",
      updatedUser.activeDoodles
    );

    // Redis Cache Clearance
    if (redisClient?.isReady) {
      try {
        const keysToDelete = [
          `myProfile:${userId}`,
          `profile:${userId}`,
          `userProfile:${userId}:viewer:guest`,
          `userProfile:${userId}:viewer:${userId}`,
          `userProfile:${userId}:viewer:${request.senderId}`,
          `myProfile:${request.senderId}`,
          `profile:${request.senderId}`
        ];

        await Promise.all(keysToDelete.map(key => redisClient.del(key)));
        console.log(`🧹 [DOODLE CACHE CLEARED] Wipe successful`);
      } catch (ce) {
        console.error("⚠️ Redis Cache clearance exception:", ce.message);
      }
    }

    // Send Notification back to sender
    await createNotification({
      senderId: userId,
      receiverId: request.senderId,
      type: "DOODLE_ACCEPTED",
      doodleRequestId: request.id
    }).catch(() => { });

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

console.log("========== REQUEST ==========");
console.log(request.toJSON());
console.log("=============================");

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