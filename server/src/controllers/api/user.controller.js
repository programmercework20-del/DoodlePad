import bcrypt from "bcryptjs";
// import bcrypt from "bcrypt";
import TokenBlacklist from "../../models/TokenBlacklist.js";
import jwt from "jsonwebtoken";
import { User, Follower } from "../../models/index.js";


export const signup = async (req, res) => {
  try {
    const { email, username, name, password } = req.body;

    // Basic validation
    if (!email || !username || !name || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    // Check existing email
    const existingEmail = await User.findOne({ where: { email } });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: "Email already exists"
      });
    }

    // Check existing username
    const existingUsername = await User.findOne({ where: { username } });
    if (existingUsername) {
      return res.status(400).json({
        success: false,
        message: "Username already exists"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      email,
      username,
      name,
      password: hashedPassword
    });

    return res.status(201).json({
      success: true,
      message: "Signup successful",
      user: {
        id: user.id,
        email: user.email,
        username: user.username
      }
    });

  } catch (error) {

    // Handle unique constraint from DB (extra safety)
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({
        success: false,
        message: "Email or Username already exists"
      });
    }

    console.error("Signup Error:", error);
    return res.status(500).json({
      success: false,
      message: "Signup failed"
    });
  }
};


 
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid password" });
    }

    if (user.status !== "active") {
      return res.status(403).json({
        message: "Account is blocked or banned"
      });
    }


    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    await user.update({ lastActiveAt: new Date() });

    return res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Login failed" });
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
    const followerId = req.user.id;      // logged-in user
    const followingId = req.params.id;   // profile user

    console.log("data mila ", followerId, followingId);

    if (followerId === followingId) {
      return res.status(400).json({ message: "You cannot follow yourself" });
    }

    // 🔹 Check if target user exists
    const targetUser = await User.findByPk(followingId);

    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // 🔹 Check if already following OR request already sent
    const alreadyFollowing = await Follower.findOne({
      where: { follower_id: followerId, following_id: followingId }
    });

    if (alreadyFollowing) {
      if (alreadyFollowing.status === "pending") {
        return res.status(400).json({ message: "Follow request already sent" });
      }
      if (alreadyFollowing.status === "accepted") {
        return res.status(400).json({ message: "Already following this user" });
      }
    }

    // 🔥 PRIVATE ACCOUNT LOGIC
    if (targetUser.is_private) {

      await Follower.create({
        followerId: followerId,
        followingId: followingId,
        status: "pending"
      });

      return res.status(200).json({
        message: "Follow request sent",
        status: "pending"
      });

    } else {

      await Follower.create({
        followerId: followerId,
        followingId: followingId,
        status: "accepted"
      });

      return res.status(201).json({
        message: "User followed successfully",
        status: "accepted"
      });
    }

  } catch (error) {
    console.error(error);
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

// function for pricvate account toggle
export const togglePrivateAccount = async (req, res) => {
  try {
    const userId = req.user.id; // assuming auth middleware sets req.user

    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.is_private = !user.is_private;
    await user.save();

    return res.status(200).json({
      message: `Account is now ${user.is_private ? "Private" : "Public"}`,
      is_private: user.is_private,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};


export const respondFollowRequest = async (req, res) => {
  try {
    const { followerId, action } = req.body; 
    // action = "accept" OR "reject"

    const request = await Follower.findOne({
      where: {
        follower_id: followerId,
        following_id: req.user.id,
        status: "pending"
      }
    });

    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    if (action === "accept") {
      request.status = "accepted";
      await request.save();

      return res.status(200).json({ message: "Follow request accepted" });
    }

    if (action === "reject") {
      await request.destroy();
      return res.status(200).json({ message: "Follow request rejected" });
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
