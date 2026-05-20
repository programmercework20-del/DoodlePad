import User from "../../models/User.js";
import Post from "../../models/Post.js";
import Follower from "../../models/Follower.js";
import DoodleRequest from "../../models/DoodleRequest.js";
import { createNotification } from "../../services/notification.service.js";
import Block from "../../models/Block.js";
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

    const isBlocked = await Block.findOne({
      where:{
        [Op.or]: [
          {
            blockerId: viewerId,
            blockedId: profileUserId
          },
          {
            blockerId: profileUserId,
            blockedId: viewerId
          }
        ]
      }
    });

    if(isBlocked){
      return res.status(403).json({ message: "Action not allowed due to block status" });
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
// UPDATE MY PROFILE (With GCS Fixed URL)
// ============================================================
export const updateMyProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    let { name, bio, dateOfBirth, gender, username } = req.body;
    
    username = username?.trim();
    name = name?.trim();
    bio = bio?.trim();

    if (username && username !== user.username) {
      const existing = await User.findOne({ where: { username } });
      if (existing) return res.status(400).json({ message: "Username already taken" });
    }

    let profilePhoto = user.profilePhoto;
    if (req.file) {
      const fileName = `profile_images/user_${req.user.id}_${Date.now()}`;
      const blob = bucket.file(fileName);
      
      await blob.save(req.file.buffer, {
        metadata: { contentType: req.file.mimetype },
        resumable: false
      });
      
      // ✅ Live GCS URL Format
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
      attributes: ["id", "name", "username", "profilePhoto", "bio", "dateOfBirth", "gender", "doodleImage", "doodleOwnerId", "doodleData"]
    });

    if (!user) return res.status(404).json({ message: "User not found" });

    if (redisClient?.isReady) await redisClient.setEx(cacheKey, 600, JSON.stringify(user));

    res.json({
      success: true,
      data: {
        profile: {
          user: user
        }
      }
    });
  } catch (error) {
    console.error("GET PROFILE ERROR:", error);
    res.status(500).json({ message: "Failed to fetch profile" });
  }
};

// ============================================================
// SEND DOODLE REQUEST (GCS Fixed URL)
// ============================================================
// export const sendDoodleRequest = async (req, res) => {
//   try {
//     const senderId = req.user.id;
//     const { receiverId, base64Image, doodleData, paths } = req.body;

//     if (!receiverId) return res.status(400).json({ message: "Receiver ID is required" });

//     let finalDoodleImage = null;
//     let finalDoodleData = (Array.isArray(paths) && paths.length > 0) ? JSON.stringify(paths) : doodleData;

//     if (req.file) {
//       const fileName = `doodles/doodle_${senderId}_${Date.now()}`;
//       const blob = bucket.file(fileName);
//       await blob.save(req.file.buffer, { 
//         metadata: { contentType: req.file.mimetype },
//         resumable: false 
//       });
//       finalDoodleImage = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
//     } else if (base64Image) {
//       const base64Clean = base64Image.replace(/^data:image\/\w+;base64,/, "");
//       const buffer = Buffer.from(base64Clean, "base64");
//       const fileName = `doodles/doodle_${senderId}_${Date.now()}.png`;
//       const blob = bucket.file(fileName);
//       await blob.save(buffer, { 
//         metadata: { contentType: "image/png" },
//         resumable: false 
//       });
//       finalDoodleImage = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
//     }

//     const request = await DoodleRequest.create({
//       senderId,
//       receiverId,
//       doodleImage: finalDoodleImage,
//       doodleData: finalDoodleData || null,
//       status: "pending",
//     });

//     await createNotification({
//       senderId,
//       receiverId,
//       type: "DOODLE_REQUEST",
//       doodleRequestId: request.id,
//     });

//     return res.status(201).json({ success: true, message: "Doodle request sent", request });
//   } catch (error) {
//     console.error("DOODLE SEND ERROR:", error);
//     return res.status(500).json({ message: "Failed to send request" });
//   }
// };
// export const sendDoodleRequest = async (req, res) => {
//   try {
//     const senderId = req.user.id;
//     const { receiverId, base64Image, paths, doodleData } = req.body;

//     if (!receiverId) {
//       return res.status(400).json({ success: false, message: "Receiver ID is required" });
//     }

//     let finalDoodleImage = null;
//     let finalDoodleData = null;

//     // 🎨 1. Handle Doodle Data (Paths logic from BE Dev)
//     if (Array.isArray(paths) && paths.length > 0) {
//       finalDoodleData = JSON.stringify(paths);
//     } else if (typeof doodleData === "string" && doodleData.trim()) {
//       finalDoodleData = doodleData;
//     }

//     // 📂 2. Handle File Upload to GCP Bucket
//     if (req.file) {
//       // BE Dev ke logic ko Bucket ke saath integrate kiya
//       const fileName = `doodles/doodle_${senderId}_${Date.now()}`;
//       const blob = bucket.file(fileName);

//       await blob.save(req.file.buffer, {
//         metadata: { contentType: req.file.mimetype },
//         resumable: false,
//       });

//       finalDoodleImage = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
//     } 
//     // 🖼️ 3. Handle Base64 Image upload to GCP Bucket
//     else if (base64Image) {
//       const base64Clean = base64Image.replace(/^data:image\/\w+;base64,/, "");
//       const buffer = Buffer.from(base64Clean, "base64");
      
//       const fileName = `doodles/doodle_${senderId}_${Date.now()}.png`;
//       const blob = bucket.file(fileName);

//       await blob.save(buffer, {
//         metadata: { contentType: "image/png" },
//         resumable: false,
//       });

//       finalDoodleImage = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
//     }

//     // 🛑 4. Final Validation
//     if (!finalDoodleImage && !finalDoodleData) {
//       return res.status(400).json({ success: false, message: "Doodle paths or image required" });
//     }

//     // 💾 5. Create Database Entry
//     const request = await DoodleRequest.create({
//       senderId,
//       receiverId,
//       doodleImage: finalDoodleImage,
//       doodleData: finalDoodleData,
//       status: "pending",
//     });

//     // 🔔 6. Create Notification
//     await createNotification({
//       senderId,
//       receiverId,
//       type: "DOODLE_REQUEST",
//       doodleRequestId: request.id,
//     });

//     // 🚀 7. Clear Redis Cache (Optional but recommended)
//     // Taki receiver ko turant update mil sake agar cache use ho raha hai
//     if (redisClient?.isReady) {
//       await redisClient.del(`doodle_requests:${receiverId}`);
//     }

//     return res.status(201).json({
//       success: true,
//       message: "Doodle request sent successfully",
//       request,
//     });

//   } catch (error) {
//     console.error("🔥 DOODLE SEND ERROR:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to send doodle request",
//       error: error.message,
//     });
//   }
// };
// // ============================================================
// // ACCEPT / REJECT / GET DOODLE REQUESTS
// // ============================================================
// export const acceptDoodleRequest = async (req, res) => {
//   try {
//     const { requestId } = req.params;
//     const userId = req.user.id;

//     const request = await DoodleRequest.findByPk(requestId);

//     if (!request || request.receiverId !== userId) {
//       return res.status(403).json({ message: "Not allowed" });
//     }

//     if (request.status !== "pending") {
//       return res.status(400).json({ message: "Already processed" });
//     }

//     await request.update({ status: "accepted" });

//     await User.update(
//       {
//         doodleImage: request.doodleImage || null,
//         doodleData: request.doodleData || null,
//         doodleOwnerId: request.senderId
//       },
//       { where: { id: userId } }
//     );

//     // Redis Cache Clear
//     if (redisClient?.isReady) {
//       const keys = await redisClient.keys(`userProfile:${userId}:*`);
//       if (keys.length > 0) await redisClient.del(keys);
//       await redisClient.del(`myProfile:${userId}`);
//     }

//     await createNotification({
//       senderId: userId,
//       receiverId: request.senderId,
//       type: "DOODLE_ACCEPTED",
//       doodleRequestId: request.id
//     });

//     return res.json({
//       success: true,
//       message: "Doodle applied to profile",
//       doodleImage: request.doodleImage || null,
//       doodleData: request.doodleData || null
//     });
//   } catch (error) {
//     console.error("DOODLE ACCEPT ERROR:", error);
//     return res.status(500).json({ message: "Failed to accept request" });
//   }
// };

// export const rejectDoodleRequest = async (req, res) => {
//   try {
//     const { requestId } = req.params;
//     const request = await DoodleRequest.findByPk(requestId);
//     if (!request || request.receiverId !== req.user.id) return res.status(403).json({ message: "Not allowed" });

//     await request.update({ status: "rejected" });
//     return res.json({ success: true, message: "Doodle request rejected" });
//   } catch (error) {
//     return res.status(500).json({ message: "Failed to reject request" });
//   }
// };

// export const getDoodleRequests = async (req, res) => {
//   try {
//     const requests = await DoodleRequest.findAll({
//       where: { receiverId: req.user.id, status: "pending" },
//       order: [["createdAt", "DESC"]],
//     });
//     return res.json({ success: true, requests });
//   } catch (error) {
//     return res.status(500).json({ message: "Failed to fetch requests" });
//   }
// };

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
    });

    if (redisClient?.isReady) {
      await redisClient.del(`doodle_requests:${receiverId}`);
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
// GET DOODLE REQUESTS (WITH SENDER METADATA)
// ============================================================
export const getDoodleRequests = async (req, res) => {
  try {
    const requests = await DoodleRequest.findAll({
      where: { receiverId: req.user.id, status: "pending" },
      include: [
        {
          model: User,
          as: "sender", // 👈 Make sure association in models/index.js uses this alias
          attributes: ["id", "name", "username", "profilePhoto"], // Added metadata
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
// ACCEPT / REJECT DOODLE REQUESTS
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
      const keys = await redisClient.keys(`userProfile:${userId}:*`);
      if (keys.length > 0) await redisClient.del(keys);
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
      doodleImage: request.doodleImage || null,
      doodleData: request.doodleData || null
    });
  } catch (error) {
    console.error("DOODLE ACCEPT ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to accept request" });
  }
};

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