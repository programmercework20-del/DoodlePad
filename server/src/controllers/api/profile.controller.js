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
    const currentUserId = req.user.id;
    const targetUserId = req.params.id; // URL se target user ki ID aayegi

    // Agar khud ki profile mang raha hai, toh roko (uske liye getMyProfile hai)
    if (currentUserId === targetUserId) {
      return res.status(400).json({ success: false, message: "Use /my-profile endpoint for your own profile" });
    }

    // 🛡️ STRICT BLOCK VALIDATION (Jaisa aapne comment mein manga tha)
    const blockRecord = await Block.findOne({
      where: {
        [Op.or]: [
          { blockerId: currentUserId, blockedId: targetUserId },
          { blockerId: targetUserId, blockedId: currentUserId }
        ]
      }
    });

    // Agar block hai (kisi ne bhi kisi ko kiya ho), toh profile mat dikhao
    if (blockRecord) {
      return res.status(403).json({ success: false, message: "This profile is not available." });
    }

    // 👤 FETCH USER DATA (Sensitive data jaise password hide karke)
    const user = await User.findByPk(targetUserId, {
      attributes: { exclude: ['password', 'otp', 'otpExpires', 'phoneOtp', 'phoneOtpExpires'] }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.status(200).json({
      success: true,
      data: {
        profile: {
          user: user
        }
      }
    });

  } catch (error) {
    console.error("🔥 GET USER PROFILE ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch user profile" });
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

    // 🔥 FIX: 'isPrivate' ko attributes array mein add kar diya gaya hai
    const user = await User.findByPk(userId, {
      attributes: [
        "id", "name", "username", "profilePhoto", "bio", 
        "dateOfBirth", "gender", "doodleImage", "doodleOwnerId", 
        "doodleData", "isDeactivated", "isPrivate" 
      ]
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
// export const getDoodleRequests = async (req, res) => {
//   try {
//     const requests = await DoodleRequest.findAll({
//       where: { receiverId: req.user.id, status: "pending" },
//       include: [
//         {
//           model: User,
//           as: "sender",
//           attributes: ["id", "name", "username", "profilePhoto"],
//         },
//       ],
//       order: [["createdAt", "DESC"]],
//     });

//     return res.json({
//       success: true,
//       requests
//     });
//   } catch (error) {
//     console.error("🔥 FETCH DOODLE REQUESTS ERROR:", error);
//     return res.status(500).json({ success: false, message: "Failed to fetch requests" });
//   }
// };

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
// 6. ACCEPT DOODLE REQUEST (PRO-LEVEL CACHE FIX)
// ============================================================
export const acceptDoodleRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user.id; // Jisne accept kiya (Receiver)

    const request = await DoodleRequest.findByPk(requestId);

    if (!request || request.receiverId !== userId) {
      return res.status(403).json({ success: false, message: "Not allowed" });
    }

    if (request.status !== "pending") {
      return res.status(400).json({ success: false, message: "Already processed" });
    }

    // 1. Status Update
    await request.update({ status: "accepted" });

    // 2. User Table Update
    await User.update(
      {
        doodleImage: request.doodleImage || null,
        doodleData: request.doodleData || null,
        doodleOwnerId: request.senderId
      },
      { where: { id: userId } }
    );

    // 3. 🚀 CARPET BOMBING CACHE (Invisible Bug Killer)
    if (redisClient?.isReady) {
      try {
        const keysToDelete = [
          `myProfile:${userId}`,
          `profile:${userId}`,
          `userProfile:${userId}:viewer:guest`,
          `userProfile:${userId}:viewer:${userId}`,
          `userProfile:${userId}:viewer:${request.senderId}`,
          // Sender ka apna cache bhi clear karo in case frontend wahan se data uthata ho
          `myProfile:${request.senderId}`,
          `profile:${request.senderId}`
        ];
        
        await Promise.all(keysToDelete.map(key => redisClient.del(key)));
        console.log(`🧹 [DOODLE CACHE CLEARED] Wiped profile caches for Receiver: ${userId} & Sender: ${request.senderId}`);
      } catch (ce) { 
        console.error("⚠️ Redis Cache clearance exception:", ce.message); 
      }
    }

    // 4. Send Notification
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
      doodleData: request.doodleData || null,
      doodleOwnerId: request.senderId // Frontend ko state update karne me kaam aayega
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