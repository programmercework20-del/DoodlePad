import bcrypt from "bcryptjs";
// import bcrypt from "bcrypt"; ye cmt h
import TokenBlacklist from "../../models/TokenBlacklist.js";
import jwt from "jsonwebtoken";
import { User, Follower } from "../../models/index.js";
import { Op } from "sequelize";
import crypto from "crypto";
import { sendEmail } from "../../utils/sendEmail.js";
import { createNotification } from "../../services/notification.service.js";



export const signup = async (req, res) => {
  try {
    let { fullName, username, password, confirmPassword } = req.body;

    // 🔥 Trim inputs (important)
    fullName = fullName?.trim();
    username = username?.trim();

    // ===============================
    // ❌ VALIDATION
    // ===============================
    if (!fullName || !username || !password || !confirmPassword) {
      return res.status(400).json({
        message: "All fields are required"
      });
    }

    // 🔥 Password match check
    if (password !== confirmPassword) {
      return res.status(400).json({
        message: "Passwords do not match"
      });
    }

    // 🔥 Optional: password strength
    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters"
      });
    }

    const existingUser = await User.findOne({
      where: { username }
    });

    if (existingUser) {
      return res.status(400).json({
        message: "Username already exists"
      });
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
    // method = "email" or "phone"

    const user = await User.findByPk(userId);

    if (!user) return res.status(404).json({ message: "User not found" });

    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    await user.update({
      otp,
      otpExpires: new Date(Date.now() + 5 * 60 * 1000), // 5 min
      email: method === "email" ? value : user.email,
      phone: method === "phone" ? value : user.phone
    });

    // 🔥 EMAIL OTP
    if (method === "email") {
      await sendEmail(
        value,
        "Your OTP",
        "otp",
        { otp }
      );
    }

    // 🔥 PHONE OTP (DEV MODE)
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

    // generate 4 digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    let user = await User.findOne({ where: { phone } });

    if (!user) {
      user = await User.create({ phone });
    }

    await user.update({
      phoneOtp: otp,
      phoneOtpExpires: new Date(Date.now() + 5 * 60 * 1000) // 5 min
    });

    // 🔥 DEV MODE (console)
    console.log(`📱 OTP for ${phone}: ${otp}`);

    return res.json({
      message: "OTP sent successfully",
      otp // remove in production ❗
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

    if (
      user.otp !== otp ||
      user.otpExpires < new Date()
    ) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    await user.update({
      isVerified: true,
      otp: null,
      otpExpires: null
    });

    // 🔥 AUTO LOGIN
    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      message: "Verified successfully",
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        phone: user.phone
      }
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
        [Op.or]: [
          { username: identifier },
          { email: identifier },
          { phone: identifier }
        ]
      }
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        message: "Please verify your account first"
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid password" });
    }

    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        phone: user.phone
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Login failed" });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { identifier } = req.body;

    if (!identifier) {
      return res.status(400).json({ message: "Email or phone required" });
    }

    const user = await User.findOne({
      where: {
        [Op.or]: [
          { email: identifier },
          { phone: identifier }
        ]
      }
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    await user.update({
      otp,
      otpExpires: new Date(Date.now() + 5 * 60 * 1000) // 5 min
    });

    // 🔥 SEND EMAIL
    if (user.email) {
      await sendEmail(user.email, "Reset Password OTP", "otp", { otp });
    } else {
      console.log(`📱 Reset OTP for ${user.phone}: ${otp}`);
    }

    res.json({
      message: "OTP sent successfully"
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to send OTP" });
  }
};

export const verifyResetOtp = async (req, res) => {
  try {
    const { identifier, otp } = req.body;

    if (!identifier || !otp) {
      return res.status(400).json({ message: "All fields required" });
    }

    const user = await User.findOne({
      where: {
        [Op.or]: [
          { email: identifier },
          { phone: identifier }
        ]
      }
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (
      user.otp !== otp ||
      user.otpExpires < new Date()
    ) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    // ✅ Mark OTP verified (IMPORTANT)
    await user.update({
      otp: null,
      otpExpires: null,
      otpVerified: true   // 🔥 ADD THIS FIELD IN MODEL
    });

    res.json({
      message: "OTP verified successfully"
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "OTP verification failed" });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { identifier, password, confirmPassword } = req.body;

    if (!identifier || !password || !confirmPassword) {
      return res.status(400).json({ message: "All fields required" });
    }

    // 🔥 password match check
    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters"
      });
    }

    const user = await User.findOne({
      where: {
        [Op.or]: [
          { email: identifier },
          { phone: identifier }
        ]
      }
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // ❌ If OTP not verified
    if (!user.otpVerified) {
      return res.status(403).json({
        message: "Please verify OTP first"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await user.update({
      password: hashedPassword,
      otpVerified: false // 🔥 reset flag
    });

    res.json({
      message: "Password reset successful"
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Reset failed" });
  }
};

export const logout = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader.split(" ")[1];

    // decode token to get expiry
    const decoded = jwt.decode(token);

    await TokenBlacklist.create({
      token,
      expiresAt: new Date(decoded.exp * 1000)
    });

    res.json({
      success: true,
      message: "Logout successful"
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Logout failed" });
  }
};

// Follow Unfollow Methods

export const followUser = async (req, res) => {
  try {
    const followerId = req.user.id;
    const followingId = req.params.id;

    if (followerId === followingId) {
      return res.status(400).json({ message: "You cannot follow yourself" });
    }

    const targetUser = await User.findByPk(followingId);

    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const existing = await Follower.findOne({
      where: { followerId, followingId }
    });

    // ✅ FIX STARTS HERE
    if (existing) {
      if (existing.status === "pending") {
        return res.status(400).json({ message: "Request already sent" });
      }

      if (existing.status === "accepted") {
        return res.status(400).json({ message: "Already following" });
      }

      if (existing.status === "rejected") {
        // 🔥 allow re-request
        await existing.update({
          status: targetUser.isPrivate ? "pending" : "accepted"
        });

        return res.json({
          message: targetUser.isPrivate
            ? "Follow request sent again"
            : "User followed successfully"
        });
      }
    }
    // ✅ FIX ENDS HERE

    // 🔥 NEW FOLLOW
    const status = targetUser.isPrivate ? "pending" : "accepted";

    await Follower.create({
  followerId,
  followingId,
  status
});

// 🔥 ADD THIS
if (status === "pending") {
  await createNotification({
    senderId: followerId,
    receiverId: followingId,
    type: "FOLLOW_REQUEST"
  });
}

if (status === "accepted") {
  await createNotification({
    senderId: followerId,
    receiverId: followingId,
    type: "FOLLOW_ACCEPTED"
  });
}

    return res.json({
      message: targetUser.isPrivate
        ? "Follow request sent"
        : "User followed successfully"
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// ACCEPT
export const acceptFollowRequest = async (req, res) => {
  try {
    const requestId = req.params.id;
    const userId = req.user.id;

    const request = await Follower.findByPk(requestId);

    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    // 🔥 IMPORTANT CHECK
    if (request.followingId !== userId) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (request.status !== "pending") {
      return res.status(400).json({ message: "Invalid request state" });
    }

   request.status = "accepted";
await request.save();

// 🔥 NOTIFY FOLLOWER
await createNotification({
  senderId: userId,
  receiverId: request.followerId,
  type: "FOLLOW_ACCEPTED"
});

    res.json({ message: "Follow request accepted" });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// REJECT
export const rejectFollowRequest = async (req, res) => {
  try {
    const requestId = req.params.id;
    const userId = req.user.id;

    const request = await Follower.findByPk(requestId);

    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    // 🔥 IMPORTANT CHECK
    if (request.followingId !== userId) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (request.status !== "pending") {
      return res.status(400).json({ message: "Invalid request state" });
    }

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
      where: {
        followingId: userId,
        status: "pending"
      },
      include: [{
        model: User,
        as: "follower",
        attributes: ["id", "username", "profilePhoto"]
      }]
    });

    res.json(requests);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


//unfollow user
export const unfollowUser = async (req, res) => {
  try {
    const followerId = req.user.id;
    const followingId = req.params.id;

    const deleted = await Follower.destroy({
      where: {
        followerId,
        followingId
      }
    });

    if (!deleted) {
      return res.status(404).json({ message: "Not following this user" });
    }

    res.json({ message: "Unfollowed successfully" });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

//get follower list
export const getFollowers = async (req, res) => {
  try {
    const userId = req.params.id;

    const followers = await Follower.findAll({
      where: {
        followingId: userId,
        status: "accepted"
      },
      include: [{
        model: User,
        as: "follower",
        attributes: ["id", "username", "profilePhoto"]
      }]
    });

    res.json(followers);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

//get following list
export const getFollowing = async (req, res) => {
  try {
    const userId = req.params.id;

    const following = await Follower.findAll({
      where: {
        followerId: userId,
        status: "accepted"
      },
      include: [{
        model: User,
        as: "following",
        attributes: ["id", "username", "profilePhoto"]
      }]
    });

    res.json(following);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// follow counts 
export const getFollowCounts = async (req, res) => {
  try {
    const userId = req.params.id;

    const followers = await Follower.count({
      where: {
        followingId: userId,
        status: "accepted"
      }
    });

    const following = await Follower.count({
      where: {
        followerId: userId,
        status: "accepted"
      }
    });

    res.json({ followers, following });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getFollowStatus = async (req, res) => {
  try {
    const loggedInUserId = req.user.id;
    const targetUserId = req.params.id;

    const record = await Follower.findOne({
      where: {
        followerId: loggedInUserId,
        followingId: targetUserId
      }
    });

    if (!record) {
      return res.json({ status: "none" });
    }

    return res.json({ status: record.status });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};  

export const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    console.log("data mila:", req.body);

    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 🔥 CORRECT bcrypt compare
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Old password incorrect" });
    }

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

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { isPrivate } = req.body;

    if (isPrivate === undefined) {
  return res.status(400).json({ message: "isPrivate is required" });
}

const isPrivateBool = isPrivate === true || isPrivate === "true";

   await user.update({ isPrivate: isPrivateBool });

    return res.json({
      success: true,
      message: isPrivate
        ? "Account switched to private"
        : "Account switched to public",
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

  await User.update(
    { fcmToken: token },
    { where: { id: userId } }
  );

  res.json({ success: true });
};

