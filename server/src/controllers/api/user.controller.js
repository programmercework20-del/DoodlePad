import bcrypt from "bcryptjs";
import TokenBlacklist from "../../models/TokenBlacklist.js";
import jwt from "jsonwebtoken";
import { User, Follower } from "../../models/index.js";
import { Op } from "sequelize";
import crypto from "crypto";
import { sendEmail } from "../../utils/sendEmail.js";
import { createNotification } from "../../services/notification.service.js";
import Block from "../../models/Block.js";
import { sendSmsOtp } from "../../utils/sendSmsOtp.js";
// 🔥 REDIS & BUCKET IMPORT (Check paths carefully)
import redisClient from "../../config/redis.js"; 
import { bucket } from "../../config/firebase.js";

export const signup = async (req, res) => {
  try {
    let { fullName, username, password, gender, confirmPassword } = req.body;

    fullName = fullName?.trim();
    username = username?.trim();

    if (!fullName || !username || !password || !gender || !confirmPassword) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: "Passwords do not match" });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }

    const existingUser = await User.findOne({ where: { username } });

    if (existingUser) {
      return res.status(400).json({ success: false, message: "Username already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: fullName,
      username,
      password: hashedPassword,
      gender: gender ? gender.toLowerCase() : null, // 🔥 Our custom fix
      isVerified: false,
      email: null,
      phone: null
    });

    res.status(201).json({
      success: true,
      message: "Signup successful. Please verify your account",
      userId: user.id
    });

  } catch (error) {
    console.error("🔥 SIGNUP ERROR:", error);
    res.status(500).json({ success: false, message: "Signup failed", error: error.message });
  }
};

export const sendVerificationOtp = async (req, res) => {
  try {
    const { userId, method, value } = req.body;
    const user = await User.findByPk(userId);

    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    // ==========================================
    // 🛡️ STEP 1: STRICT VALIDATION (Pehle check karo)
    // ==========================================
    if (method === "email") {
      const existingEmail = await User.findOne({
        where: { email: value, id: { [Op.ne]: user.id } }
      });
      if (existingEmail) {
        return res.status(400).json({ success: false, message: "Email is already registered to another account." });
      }
    }

    if (method === "phone") {
      // 🧹 Sanitization: Agar frontend galti se '+91' bhej de, toh use hata do
      const cleanPhone = value.replace(/^\+91/, '').trim();
      const existingPhone = await User.findOne({
        where: { phone: cleanPhone, id: { [Op.ne]: user.id } }
      });
      
      if (existingPhone) {
        return res.status(400).json({ success: false, message: "Phone number already registered to another account." });
      }
    }

    // ==========================================
    // 🎲 STEP 2: OTP GENERATION
    // ==========================================
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const cleanValue = method === "phone" ? value.replace(/^\+91/, '').trim() : value;

    // ==========================================
    // 💾 STEP 3: DATABASE UPDATE (Ab Safe Hai)
    // ==========================================
    await user.update({
      otp,
      otpExpires: new Date(Date.now() + 5 * 60 * 1000), // 5 min
      email: method === "email" ? cleanValue : user.email,
      phone: method === "phone" ? cleanValue : user.phone
    });

    // ==========================================
    // 🚀 STEP 4: DISPATCH OTP
    // ==========================================
    if (method === "email") {
      await sendEmail(cleanValue, "Your OTP", "otp", { otp });
    }

    if (method === "phone") {
      await sendSmsOtp(cleanValue, otp, process.env.MSG91_VERIFY_TEMPLATE_ID);
    }

    return res.json({ success: true, message: "OTP sent successfully" });

  } catch (error) {
    console.error("🔥 OTP SEND ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to send OTP", error: error.message });
  }
};

export const sendOtp = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, message: "Phone number required" });
    }

    // 🧹 Sanitization
    const cleanPhone = phone.toString().replace(/^\+91/, '').trim();

    // Generate 4 digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    let user = await User.findOne({ where: { phone: cleanPhone } });

    if (!user) {
      // ⚠️ Note: Agar Database mein username vaghera required hai, 
      // toh yahan unko dummy values assign karni padengi, warna crash hoga.
      user = await User.create({ phone: cleanPhone });
    }

    await user.update({
      phoneOtp: otp, // Dhyan rahe, 'sendVerificationOtp' mein aap 'otp' column use kar rahe the, yahan 'phoneOtp' hai. Ensure database has this column!
      phoneOtpExpires: new Date(Date.now() + 5 * 60 * 1000) // 5 min
    });

    // 🔥 FIX: MSG91 ki API ko call karke asli mein SMS bhejo
    // Template ID .env file mein MSG91_LOGIN_TEMPLATE_ID ke naam se save kar lena
    await sendSmsOtp(
      cleanPhone, 
      otp, 
      process.env.MSG91_LOGIN_TEMPLATE_ID || process.env.MSG91_VERIFY_TEMPLATE_ID
    );

    return res.json({
      success: true,
      message: "OTP sent successfully"
      // 🔒 PRO-SECURITY: Production mein OTP kabhi response mein nahi bhejte!
    });

  } catch (error) {
    console.error("🔥 SEND OTP ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to send OTP", error: error.message });
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

    // ACCOUNT DEACTIVATED
    if (user.isDeactivated) {

      return res.status(403).json({
        success: false,
        isDeactivated: true,
        message: "Account is deactivated",
        restoreAvailableUntil: user.scheduledDeletionAt
      });
    }
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
    // 🔥 SMART PAYLOAD CATCHER: Frontend chahe 'identifier', 'email' ya 'phone' bheje, yeh catch kar lega!
    const incomingValue = req.body.identifier || req.body.email || req.body.phone;

    if (!incomingValue) {
      return res.status(400).json({ success: false, message: "Email or phone required" });
    }

    // 🧹 Sanitization
    const cleanIdentifier = incomingValue.toString().trim().replace(/^\+91/, '');

    const user = await User.findOne({
      where: {
        [Op.or]: [
          { email: cleanIdentifier },
          { phone: cleanIdentifier }
        ]
      }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    await user.update({
      otp,
      otpExpires: new Date(Date.now() + 5 * 60 * 1000) // 5 min
    });

    const isEmail = cleanIdentifier.includes("@");

    // 🔥 SMART DISPATCH: Decide whether to send Email or SMS
    if (isEmail && user.email) {
      await sendEmail(user.email, "Reset Password OTP", "otp", { otp });
    } else if (!isEmail && user.phone) {
      await sendSmsOtp(user.phone, otp, process.env.MSG91_RESET_TEMPLATE_ID);
    } else {
      return res.status(400).json({ success: false, message: "Valid contact method not found for this user." });
    }

    return res.json({ success: true, message: "OTP sent successfully" });

  } catch (error) {
    console.error("🔥 FORGOT PASSWORD ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to send OTP", error: error.message });
  }
};

export const resendOtp = async (req, res) => {
  try {
    // 🔥 SMART PAYLOAD CATCHER
    const incomingValue = req.body.identifier || req.body.email || req.body.phone;
    
    // Frontend batayega ki OTP kis cheez ke liye resend karna hai ('reset' ya 'verify')
    // Agar nahi batayega, toh default 'verify' maan lenge
    const otpType = req.body.type || 'verify'; 

    if (!incomingValue) {
      return res.status(400).json({ success: false, message: "Email or phone required" });
    }

    // 🧹 Sanitization
    const cleanIdentifier = incomingValue.toString().trim().replace(/^\+91/, '');

    const user = await User.findOne({
      where: {
        [Op.or]: [
          { email: cleanIdentifier },
          { phone: cleanIdentifier }
        ]
      }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // 🎲 Generate New OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    // 💾 Update DB with new OTP and extended expiry time
    await user.update({
      otp,
      otpExpires: new Date(Date.now() + 5 * 60 * 1000) // Naye 5 minute
    });

    const isEmail = cleanIdentifier.includes("@");

    // 🔥 SMART DISPATCH: Decide Route & Template
    if (isEmail && user.email) {
      const subject = otpType === "reset" ? "Resend: Reset Password OTP" : "Resend: Verification OTP";
      await sendEmail(user.email, subject, "otp", { otp });
      
    } else if (!isEmail && user.phone) {
      const templateId = otpType === "reset" 
        ? process.env.MSG91_RESET_TEMPLATE_ID 
        : process.env.MSG91_VERIFY_TEMPLATE_ID;
        
      await sendSmsOtp(user.phone, otp, templateId);
      
    } else {
      return res.status(400).json({ success: false, message: "Valid contact method not found." });
    }

    return res.json({ success: true, message: "OTP resent successfully" });

  } catch (error) {
    console.error("🔥 RESEND OTP ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to resend OTP", error: error.message });
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

    // ACCOUNT DEACTIVATED
    if (user.isDeactivated) {

      return res.status(403).json({
        success: false,
        isDeactivated: true,
        message: "Account is deactivated",
        restoreAvailableUntil: user.scheduledDeletionAt
      });
    }

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
 
export const followUser = async (req, res) => {
  try {
    const followerId = req.user.id;
    const followingId = req.params.id;

    if (followerId === followingId) return res.status(400).json({ message: "You cannot follow yourself" });

    const targetUser = await User.findByPk(followingId);
    if (!targetUser) return res.status(404).json({ message: "User not found" });

    const isBlocked = await Block.findOne({
      where:{
        [Op.or]: [
          {
            blockerId: followerId,
            blockedId: followingId
          },
          {
            blockerId: followingId,
            blockedId: followerId
          }
        ]
      }
    });

    if(isBlocked){
      return res.status(403).json({ message: "Action not allowed due to block status" });
    }


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
    const userId = req.user.id; // Profile Owner (Jo accept kar raha hai)

    const request = await Follower.findByPk(requestId);
    if (!request) return res.status(404).json({ message: "Request not found" });
    if (request.followingId !== userId) return res.status(403).json({ message: "Not authorized" });
    if (request.status !== "pending") return res.status(400).json({ message: "Invalid request state" });

    request.status = "accepted";
    await request.save();

    await createNotification({ senderId: userId, receiverId: request.followerId, type: "FOLLOW_ACCEPTED" });

    // 🚀 CACHE INVALIDATION LAYER
    if (redisClient?.isReady) {
      await redisClient.del(`followers:${userId}`);
      await redisClient.del(`following:${request.followerId}`);
      await redisClient.del(`followCounts:${userId}`);
      await redisClient.del(`followCounts:${request.followerId}`);
      
      // 🔥 NEW FIX: Clear specific userProfile cache combination instantly!
      // Jab follower profile check karega ya owner follower ka profile check karega, dono cache clear honge.
      await redisClient.del(`userProfile:${userId}:viewer:${request.followerId}`);
      await redisClient.del(`userProfile:${request.followerId}:viewer:${userId}`);
      
      console.log(`🧹 Cleared profile caches between ${userId} and ${request.followerId}`);
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

    // 1. Fetch Active Pending Follow Requests
    const pendingRequests = await Follower.findAll({
      where: { followingId: userId, status: "pending" },
      include: [
        {
          model: User,
          as: "follower",
          attributes: ["id", "name", "username", "profilePhoto"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    // 2. Fetch Recent Follow History (Accepted / Rejected)
    const historyRequests = await Follower.findAll({
      where: {
        followingId: userId,
        status: { [Op.in]: ["accepted", "rejected"] },
      },
      include: [
        {
          model: User,
          as: "follower",
          attributes: ["id", "name", "username", "profilePhoto"],
        },
      ],
      order: [["updatedAt", "DESC"]],
      limit: 20,
    });

    // ==========================================
    // 🔥 PRO-LEVEL OPTIMIZATION: Extracting 'isFollowing' without N+1 Query loop
    // ==========================================
    
    // Step A: Get all unique user IDs who sent the requests
    const allSenderIds = [
      ...pendingRequests.map(req => req.followerId),
      ...historyRequests.map(req => req.followerId)
    ];
    const uniqueSenderIds = [...new Set(allSenderIds)];

    // Step B: Check which of these users the current logged-in user is already following
    let followingSet = new Set();
    
    if (uniqueSenderIds.length > 0) {
      const myFollowings = await Follower.findAll({
        where: {
          followerId: userId, // Current user is the follower
          followingId: { [Op.in]: uniqueSenderIds }, // Checking against request senders
          status: "accepted" // Assuming mutual follow means accepted
        },
        attributes: ["followingId"],
      });
      
      // Add them to a JS Set for O(1) lightning fast lookup
      followingSet = new Set(myFollowings.map(f => f.followingId));
    }

    // Step C: Format the response to exactly match FE Dev's requirement
    const formatRequest = (request) => {
      const reqJSON = request.toJSON();
      if (reqJSON.follower) {
        // Agar us sender ka ID hamare followingSet mein hai, yani 'isFollowing' true hai
        reqJSON.follower.isFollowing = followingSet.has(reqJSON.followerId);
      }
      return reqJSON;
    };

    return res.json({
      success: true,
      pending: pendingRequests.map(formatRequest),
      history: historyRequests.map(formatRequest),
    });

  } catch (error) {
    console.error("🔥 GET FOLLOW REQUESTS ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch follow requests" });
  }
};

export const unfollowUser = async (req, res) => {
  try {
    const followerId = req.user.id; // Jo user unfollow kar raha hai
    const followingId = req.params.id; // Jise unfollow kiya ja raha hai (Target User)

    // 1. Database se relation destroy karo
    const deleted = await Follower.destroy({ where: { followerId, followingId } });

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Not following this user" });
    }

    // 2. 🚀 CARPET BOMBING CACHE INVALIDATION (Future-Proof Fix)
    if (redisClient?.isReady) {
      try {
        const keysToDelete = [
          `followers:${followingId}`,
          `following:${followerId}`,
          `followCounts:${followingId}`,
          `followCounts:${followerId}`,
          
          // 🔥 FIX: Dono users ke aamne-saamne ke saare profile relation cache delete karo
          `userProfile:${followingId}:viewer:${followerId}`,
          `userProfile:${followerId}:viewer:${followingId}`,
          `profile:${followingId}`,
          `profile:${followerId}`
        ];

        // Saari keys ko ek saath flush karo
        await Promise.all(keysToDelete.map(key => redisClient.del(key)));

        // 🔥 OMNI-VERSION FIX: Agar aap profile versioning use kar rahe hain toh dono ke versions badhao
        const myVersionKey = `profileCacheVersion:${followerId}`;
        const targetVersionKey = `profileCacheVersion:${followingId}`;
        
        const [myVer, targetVer] = await Promise.all([
          redisClient.get(myVersionKey),
          redisClient.get(targetVersionKey)
        ]);

        const newMyVer = myVer ? `v${parseInt(myVer.replace('v', '')) + 1}` : 'v2';
        const newTargetVer = targetVer ? `v${parseInt(targetVer.replace('v', '')) + 1}` : 'v2';

        await Promise.all([
          redisClient.setEx(myVersionKey, 86400, newMyVer),
          redisClient.setEx(targetVersionKey, 86400, newTargetVer)
        ]);

        console.log(`🧹 [UNFOLLOW SUCCESS] Cleared all mutual caches and bumped versions for ${followerId} and ${followingId}`);
      } catch (cacheErr) {
        console.error("⚠️ Redis Unfollow cache invalidation failed:", cacheErr.message);
      }
    }

    return res.json({ success: true, message: "Unfollowed successfully" });
  } catch (error) {
    console.error("🔥 UNFOLLOW CONTROLLER ERROR:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

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
      include: [{ model: User, as: "follower",where: { isDeactivated: false }, attributes: ["id", "username", "profilePhoto"] }]
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
      include: [{ model: User, as: "following", isDeactivated: false, attributes: ["id", "username", "profilePhoto"] }]
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

export const getUniqueConnectionsCount = async (req, res) => {
  try {
    const userId = req.params.id;
    const cacheKey = `uniqueConnections:${userId}`;

    if (redisClient?.isReady) {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) return res.json({ uniqueConnections: parseInt(cachedData) });
    }

    // Combine both sets and get distinct users
    // People who follow me OR people I follow, where status is accepted
    const [results] = await sequelize.query(`
      SELECT COUNT(DISTINCT connected_user_id) as count
      FROM (
        SELECT "followerId" as connected_user_id FROM "followers" WHERE "followingId" = :userId AND "status" = 'accepted'
        UNION
        SELECT "followingId" as connected_user_id FROM "followers" WHERE "followerId" = :userId AND "status" = 'accepted'
      ) as unique_connections
    `, {
      replacements: { userId },
      type: sequelize.QueryTypes.SELECT
    });

    const uniqueCount = parseInt(results.count || 0);

    if (redisClient?.isReady) {
      await redisClient.setEx(cacheKey, 3600, uniqueCount.toString());
    }

    res.json({ uniqueConnections: uniqueCount });
  } catch (error) {
    console.error("🔥 UNIQUE CONNECTIONS COUNT ERROR:", error);
    res.status(500).json({ error: error.message });
  }
};