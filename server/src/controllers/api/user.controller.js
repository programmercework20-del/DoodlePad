import bcrypt from "bcryptjs";
import TokenBlacklist from "../../models/TokenBlacklist.js";
import jwt from "jsonwebtoken";
import { User, Follower } from "../../models/index.js";
import { Op } from "sequelize";
import crypto from "crypto";
import { sendEmail } from "../../utils/sendEmail.js";
import { createNotification } from "../../services/notification.service.js";

// 🔥 REDIS & BUCKET IMPORT (Check paths carefully)
import redisClient from "../../config/redis.js"; 
import { bucket } from "../../config/firebase.js";

export const signup = async (req, res) => {
  try {
    let { fullName, username, password, confirmPassword } = req.body;

    fullName = fullName?.trim();
    username = username?.trim();

    if (!fullName || !username || !password || !confirmPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const existingUser = await User.findOne({ where: { username } });

    if (existingUser) {
      return res.status(400).json({ message: "Username already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: fullName,
      username,
      password: hashedPassword,
      isVerified: false,
      email: null,
      phone: null
    });

    res.status(201).json({
      message: "Signup successful. Please verify your account",
      userId: user.id
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Signup failed" });
  }
};

export const sendVerificationOtp = async (req, res) => {
  try {
    const { userId, method, value } = req.body;
    const user = await User.findByPk(userId);

    if (!user) return res.status(404).json({ message: "User not found" });

    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    await user.update({
      otp,
      otpExpires: new Date(Date.now() + 5 * 60 * 1000), // 5 min
      email: method === "email" ? value : user.email,
      phone: method === "phone" ? value : user.phone
    });

    if (method === "email") {
      await sendEmail(value, "Your OTP", "otp", { otp });
    }

    if (method === "phone") {
      console.log(`📱 OTP for ${value}: ${otp}`);
    }

    res.json({ message: "OTP sent successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to send OTP" });
  }
};

export const sendOtp = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ message: "Phone number required" });
    }

    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    let user = await User.findOne({ where: { phone } });

    if (!user) {
      user = await User.create({ phone });
    }

    await user.update({
      phoneOtp: otp,
      phoneOtpExpires: new Date(Date.now() + 5 * 60 * 1000)
    });

    console.log(`📱 OTP for ${phone}: ${otp}`);

    return res.json({
      message: "OTP sent successfully",
      otp 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to send OTP" });
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const { userId, otp } = req.body;
    const user = await User.findByPk(userId);

    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.otp !== otp || user.otpExpires < new Date()) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    await user.update({
      isVerified: true,
      otp: null,
      otpExpires: null
    });

    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      message: "Verified successfully",
      token,
      user: { id: user.id, username: user.username, name: user.name, email: user.email, phone: user.phone, profilePhoto: user.profilePhoto }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "OTP verification failed" });
  }
};

export const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    const user = await User.findOne({
      where: {
        [Op.or]: [ { username: identifier }, { email: identifier }, { phone: identifier } ]
      }
    });

    if (!user) return res.status(404).json({ message: "User not found" });
    if (!user.isVerified) return res.status(403).json({ message: "Please verify your account first" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid password" });

    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      message: "Login successful",
      token,
      user: { id: user.id, username: user.username, name: user.name, email: user.email, phone: user.phone, profilePhoto: user.profilePhoto }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Login failed" });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier) return res.status(400).json({ message: "Email or phone required" });

    const user = await User.findOne({
      where: { [Op.or]: [{ email: identifier }, { phone: identifier }] }
    });

    if (!user) return res.status(404).json({ message: "User not found" });

    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    await user.update({
      otp,
      otpExpires: new Date(Date.now() + 5 * 60 * 1000)
    });

    if (user.email) {
      await sendEmail(user.email, "Reset Password OTP", "otp", { otp });
    } else {
      console.log(`📱 Reset OTP for ${user.phone}: ${otp}`);
    }

    res.json({ message: "OTP sent successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to send OTP" });
  }
};

export const verifyResetOtp = async (req, res) => {
  try {
    const { identifier, otp } = req.body;
    if (!identifier || !otp) return res.status(400).json({ message: "All fields required" });

    const user = await User.findOne({
      where: { [Op.or]: [{ email: identifier }, { phone: identifier }] }
    });

    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.otp !== otp || user.otpExpires < new Date()) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    await user.update({
      otp: null,
      otpExpires: null,
      otpVerified: true
    });

    res.json({ message: "OTP verified successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "OTP verification failed" });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { identifier, password, confirmPassword } = req.body;

    if (!identifier || !password || !confirmPassword) return res.status(400).json({ message: "All fields required" });
    if (password !== confirmPassword) return res.status(400).json({ message: "Passwords do not match" });
    if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });

    const user = await User.findOne({
      where: { [Op.or]: [{ email: identifier }, { phone: identifier }] }
    });

    if (!user) return res.status(404).json({ message: "User not found" });
    if (!user.otpVerified) return res.status(403).json({ message: "Please verify OTP first" });

    const hashedPassword = await bcrypt.hash(password, 10);

    await user.update({
      password: hashedPassword,
      otpVerified: false
    });

    res.json({ message: "Password reset successful" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Reset failed" });
  }
};

export const logout = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader.split(" ")[1];
    const decoded = jwt.decode(token);

    await TokenBlacklist.create({
      token,
      expiresAt: new Date(decoded.exp * 1000)
    });

    res.json({ success: true, message: "Logout successful" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Logout failed" });
  }
};

// ==========================================
// 🔥 FOLLOW / UNFOLLOW (CACHE INVALIDATION)
// ==========================================

export const followUser = async (req, res) => {
  try {
    const followerId = req.user.id;
    const followingId = req.params.id;

    if (followerId === followingId) return res.status(400).json({ message: "You cannot follow yourself" });

    const targetUser = await User.findByPk(followingId);
    if (!targetUser) return res.status(404).json({ message: "User not found" });

    const existing = await Follower.findOne({ where: { followerId, followingId } });

    if (existing) {
      if (existing.status === "pending") return res.status(400).json({ message: "Request already sent" });
      if (existing.status === "accepted") return res.status(400).json({ message: "Already following" });
      if (existing.status === "rejected") {
        await existing.update({ status: targetUser.isPrivate ? "pending" : "accepted" });
        return res.json({ message: targetUser.isPrivate ? "Follow request sent again" : "User followed successfully" });
      }
    }

    const status = targetUser.isPrivate ? "pending" : "accepted";
    await Follower.create({ followerId, followingId, status });

    if (status === "pending") {
      await createNotification({ senderId: followerId, receiverId: followingId, type: "FOLLOW_REQUEST" });
    }

    if (status === "accepted") {
      await createNotification({ senderId: followerId, receiverId: followingId, type: "FOLLOW_ACCEPTED" });
      
      // 🚀 CACHE INVALIDATION
      if (redisClient?.isReady) {
        await redisClient.del(`followers:${followingId}`);
        await redisClient.del(`following:${followerId}`);
        await redisClient.del(`followCounts:${followingId}`);
        await redisClient.del(`followCounts:${followerId}`);
      }
    }

    return res.json({ message: targetUser.isPrivate ? "Follow request sent" : "User followed successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

export const acceptFollowRequest = async (req, res) => {
  try {
    const requestId = req.params.id;
    const userId = req.user.id;

    const request = await Follower.findByPk(requestId);
    if (!request) return res.status(404).json({ message: "Request not found" });
    if (request.followingId !== userId) return res.status(403).json({ message: "Not authorized" });
    if (request.status !== "pending") return res.status(400).json({ message: "Invalid request state" });

    request.status = "accepted";
    await request.save();

    await createNotification({ senderId: userId, receiverId: request.followerId, type: "FOLLOW_ACCEPTED" });

    // 🚀 CACHE INVALIDATION
    if (redisClient?.isReady) {
      await redisClient.del(`followers:${userId}`);
      await redisClient.del(`following:${request.followerId}`);
      await redisClient.del(`followCounts:${userId}`);
      await redisClient.del(`followCounts:${request.followerId}`);
    }

    res.json({ message: "Follow request accepted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const rejectFollowRequest = async (req, res) => {
  try {
    const requestId = req.params.id;
    const userId = req.user.id;

    const request = await Follower.findByPk(requestId);
    if (!request) return res.status(404).json({ message: "Request not found" });
    if (request.followingId !== userId) return res.status(403).json({ message: "Not authorized" });
    if (request.status !== "pending") return res.status(400).json({ message: "Invalid request state" });

    request.status = "rejected";
    await request.save();

    res.json({ message: "Follow request rejected" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getFollowRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    const requests = await Follower.findAll({
      where: { followingId: userId, status: "pending" },
      include: [{ model: User, as: "follower", attributes: ["id", "username", "profilePhoto"] }]
    });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const unfollowUser = async (req, res) => {
  try {
    const followerId = req.user.id;
    const followingId = req.params.id;

    const deleted = await Follower.destroy({ where: { followerId, followingId } });

    if (!deleted) return res.status(404).json({ message: "Not following this user" });

    // 🚀 CACHE INVALIDATION
    if (redisClient?.isReady) {
      await redisClient.del(`followers:${followingId}`);
      await redisClient.del(`following:${followerId}`);
      await redisClient.del(`followCounts:${followingId}`);
      await redisClient.del(`followCounts:${followerId}`);
    }

    res.json({ message: "Unfollowed successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// 🚀 CACHED GET METHODS
// ==========================================

export const getFollowers = async (req, res) => {
  try {
    const userId = req.params.id;
    const cacheKey = `followers:${userId}`;

    if (redisClient?.isReady) {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) return res.json(JSON.parse(cachedData));
    }

    const followers = await Follower.findAll({
      where: { followingId: userId, status: "accepted" },
      include: [{ model: User, as: "follower", attributes: ["id", "username", "profilePhoto"] }]
    });

    if (redisClient?.isReady) {
      await redisClient.setEx(cacheKey, 3600, JSON.stringify(followers));
    }

    res.json(followers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getFollowing = async (req, res) => {
  try {
    const userId = req.params.id;
    const cacheKey = `following:${userId}`;

    if (redisClient?.isReady) {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) return res.json(JSON.parse(cachedData));
    }

    const following = await Follower.findAll({
      where: { followerId: userId, status: "accepted" },
      include: [{ model: User, as: "following", attributes: ["id", "username", "profilePhoto"] }]
    });

    if (redisClient?.isReady) {
      await redisClient.setEx(cacheKey, 3600, JSON.stringify(following));
    }

    res.json(following);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getFollowCounts = async (req, res) => {
  try {
    const userId = req.params.id;
    const cacheKey = `followCounts:${userId}`;

    if (redisClient?.isReady) {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) return res.json(JSON.parse(cachedData));
    }

    const followers = await Follower.count({ where: { followingId: userId, status: "accepted" } });
    const following = await Follower.count({ where: { followerId: userId, status: "accepted" } });

    const counts = { followers, following };

    if (redisClient?.isReady) {
      await redisClient.setEx(cacheKey, 3600, JSON.stringify(counts));
    }

    res.json(counts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getFollowStatus = async (req, res) => {
  try {
    const loggedInUserId = req.user.id;
    const targetUserId = req.params.id;

    const record = await Follower.findOne({
      where: { followerId: loggedInUserId, followingId: targetUserId }
    });

    if (!record) return res.json({ status: "none" });

    return res.json({ status: record.status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};  

export const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) return res.status(400).json({ message: "Old password incorrect" });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await user.update({ password: hashedPassword });

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ message: "Failed to change password" });
  }
};

export const togglePrivacy = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const { isPrivate } = req.body;
    if (isPrivate === undefined) return res.status(400).json({ message: "isPrivate is required" });

    const isPrivateBool = isPrivate === true || isPrivate === "true";
    await user.update({ isPrivate: isPrivateBool });

    return res.json({
      success: true,
      message: isPrivate ? "Account switched to private" : "Account switched to public",
      isPrivate: user.isPrivate
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update privacy" });
  }
};

export const saveFcmToken = async (req, res) => {
  const userId = req.user.id;
  const { token } = req.body;

  await User.update({ fcmToken: token }, { where: { id: userId } });

  res.json({ success: true });
};

// ==========================================
// 🚀 UPLOAD PROFILE PHOTO TO GCP BUCKET
// ==========================================

export const uploadProfilePhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image provided" });
    }

    const userId = req.user.id;
    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Bucket ka path aur naam set karo
    const fileName = `profile_photos/user_${userId}_${Date.now()}.webp`;
    const file = bucket.file(fileName);

    // Stream shuru karo aur image bucket me daalo
    const stream = file.createWriteStream({
      metadata: {
        contentType: req.file.mimetype,
      },
    });

    stream.on("error", (err) => {
      console.error("Bucket upload error:", err);
      return res.status(500).json({ message: "Upload failed" });
    });

    stream.on("finish", async () => {
      // Image public hone par uska URL banao
      await file.makePublic();
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

      // Purani image bucket se delete karne ka logic (optional but good for space)
      if (user.profilePhoto && user.profilePhoto.includes("storage.googleapis.com")) {
        const oldFileName = user.profilePhoto.split(`${bucket.name}/`)[1];
        if (oldFileName) {
          try {
            await bucket.file(oldFileName).delete();
          } catch (delErr) {
            console.log("Old profile photo deletion failed (might not exist):", delErr.message);
          }
        }
      }

      // Naya URL database me update karo
      await user.update({ profilePhoto: publicUrl });

      // Cache invalidation taaki nayi photo followers/following list me dikhe
      if (redisClient?.isReady) {
        await redisClient.del(`followers:${userId}`);
        await redisClient.del(`following:${userId}`);
      }

      res.json({
        success: true,
        message: "Profile photo updated",
        profilePhoto: publicUrl
      });
    });

    // Multer se aaya buffer stream me pass karo
    stream.end(req.file.buffer);

  } catch (error) {
    console.error("Profile photo update error:", error);
    res.status(500).json({ message: "Failed to update profile photo" });
  }
};