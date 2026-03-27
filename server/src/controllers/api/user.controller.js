import bcrypt from "bcryptjs";
// import bcrypt from "bcrypt";
import TokenBlacklist from "../../models/TokenBlacklist.js";
import jwt from "jsonwebtoken";
import { User, Follower } from "../../models/index.js";
import { Op } from "sequelize";
import crypto from "crypto";
import { sendEmail } from "../../utils/sendEmail.js";


export const signup = async (req, res) => {
  try {
    const { email, username, firstName, lastName, password, bio } = req.body;

    if (!email || !username || !firstName || !lastName || !password) {
      return res.status(400).json({ message: "All fields required" });
    }

    const existingUser = await User.findOne({
      where: {
        [Op.or]: [{ email }, { username }]
      }
    });

    if (existingUser) {
      return res.status(400).json({
        message: "Email or username already exists"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const token = crypto.randomBytes(32).toString("hex");

    const user = await User.create({
      email,
      username,
      name: `${firstName} ${lastName}`,
      password: hashedPassword,
      bio,
      emailVerificationToken: token
    });

    // ✅ FINAL FIXED URL
    const url = `http://localhost:5000/api/verify-email/${token}`;

    console.log("🔥 FINAL SIGNUP URL:", url);

    await sendEmail(
      email,
      "Verify your account",
      `<h3>Click to verify</h3><a href="${url}">${url}</a>`
    );

    return res.status(201).json({
      message: "Signup successful. Please verify your email."
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Signup failed" });
  }
};

export const sendEmailVerification = async (req, res) => {
  const user = req.user;

  const token = crypto.randomBytes(32).toString("hex");

  await user.update({ emailVerificationToken: token });

  const url = `http://localhost:5000/api/verify-email/${token}`;

  console.log("🔥 Verification URL:", url);

  await sendEmail(
    user.email,
    "Verify your account",
    `<h3>Click to verify</h3><a href="${url}">${url}</a>`
  );

  res.json({ message: "Verification email sent" });
};

export const verifyEmail = async (req, res) => {
  const { token } = req.params;

  const user = await User.findOne({
    where: { emailVerificationToken: token }
  });

  if (!user) {
    return res.status(400).json({ message: "Invalid token" });
  }

  await user.update({
    isVerified: true,
    emailVerificationToken: null
  });

  res.json({ message: "Email verified successfully" });
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
    const { phone, otp } = req.body;

    const user = await User.findOne({ where: { phone } });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (
      user.phoneOtp !== otp ||
      user.phoneOtpExpires < new Date()
    ) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    await user.update({
      isPhoneVerified: true,
      phoneOtp: null,
      phoneOtpExpires: null
    });

    // 🔥 LOGIN (JWT)
    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    return res.json({
      message: "Phone verified successfully",
      token,
      user: {
        id: user.id,
        phone: user.phone
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "OTP verification failed" });
  }
};

export const updatePhone = async (req, res) => {
  const { phone } = req.body;

  const user = req.user;

  await user.update({
    phone,
    isPhoneVerified: false
  });

  res.json({ message: "Phone updated, verify again" });
};

export const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;
    // identifier = email OR username

    const user = await User.findOne({
      where: {
        [Op.or]: [
          { email: identifier },
          { username: identifier }
        ]
      }
    });

    if (user.email === identifier && !user.isVerified) {
      return res.status(403).json({
        message: "Please verify your email first"
      });
    }

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid password" });
    }

    if (user.status !== "active") {
      return res.status(403).json({ message: "Account blocked" });
    }

    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    return res.json({
      message: "Login successful",
      token
    });

  } catch (error) {
    res.status(500).json({ message: "Login failed" });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 🔥 generate token
    const token = crypto.randomBytes(32).toString("hex");

    await user.update({
      resetPasswordToken: token,
      resetPasswordExpires: new Date(Date.now() + 10 * 60 * 1000) // 10 min
    });

    // 🔥 reset link
    const url = `http://localhost:5000/api/reset-password/${token}`;

    console.log("🔐 Reset URL:", url);

    await sendEmail(
      email,
      "Reset your password",
      `<h3>Reset Password</h3><a href="${url}">${url}</a>`
    );

    return res.json({
      message: "Password reset email sent"
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to send reset email" });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }

    const user = await User.findOne({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: {
          [Op.gt]: new Date()
        }
      }
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await user.update({
      password: hashedPassword,
      resetPasswordToken: null,
      resetPasswordExpires: null
    });

    return res.json({
      message: "Password reset successful"
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Password reset failed" });
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

    console.log("data mila ", followerId, followingId);

    if (followerId === followingId) {
      return res.status(400).json({ message: "You cannot follow yourself" });
    }

    // ✅ USE camelCase here
    const alreadyFollowing = await Follower.findOne({
      where: { followerId, followingId }
    });

    if (alreadyFollowing) {
      return res.status(400).json({ message: "Already following this user" });
    }

    // ✅ USE camelCase here
    await Follower.create({
      followerId,
      followingId
    });

    res.status(201).json({ message: "User followed successfully" });

  } catch (error) {
    console.error("Follow error:", error);
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
        follower_id: followerId,
        following_id: followingId
      }
    });

    if (!deleted) {
      return res.status(404).json({ message: "You are not following this user" });
    }

    res.json({ message: "User unfollowed successfully" });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

//get follower list
export const getFollowers = async (req, res) => {
  try {
    const userId = req.params.id;

    const followers = await Follower.findAll({
      where: { following_id: userId },
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
      where: { follower_id: userId },
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

    const followersCount = await Follower.count({
      where: { following_id: userId }
    });

    const followingCount = await Follower.count({
      where: { follower_id: userId }
    });

    res.json({
      followers: followersCount,
      following: followingCount
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getFollowStatus = async (req, res) => {
  try {
    const loggedInUserId = req.user.id; // from your auth middleware
    const targetUserId = req.params.id; //the you are viewing

    const followRecord = await Follower.findOne({
      where: {
        follower_id: loggedInUserId,
        following_id: targetUserId
      },
    });


    // If followRecord exists, isFollowing is true. If null, it's false.

    res.json({ isFollowing: !!followRecord })
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



//update profile 
export const updateMyProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { name, bio, dateOfBirth, gender, username } = req.body;

    // 🔥 Username uniqueness check (for update case)
    if (username && username !== user.username) {
      const existingUsername = await User.findOne({
        where: { username }
      });

      if (existingUsername) {
        return res.status(400).json({
          message: "Username already taken"
        });
      }
    }

    // 🔥 Profile photo logic
    console.log("BODY", req.body);
    console.log("FILE", req.file);
    console.log("USER ID", req.user.id);
    const profilePhoto = req.file
      ? `/uploads/stories/${req.file.filename}`
      : user.profilePhoto;

    await user.update({
      name,
      username,
      bio,
      dateOfBirth,
      gender,
      profilePhoto
    });

    res.json({ message: "Profile updated successfully" });

  } catch (error) {
    console.error("UPDATE PROFILE ERROR:", error);
    res.status(500).json({ message: "Profile update failed" });
  }
};


// GET MY PROFILE (for update form)
export const getMyProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: [
        "name",
        "username",
        "profilePhoto",
        "bio",
        "dateOfBirth",
        "gender"
      ]
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error("GET PROFILE ERROR:", error);
    res.status(500).json({ message: "Failed to fetch profile" });
  }
};