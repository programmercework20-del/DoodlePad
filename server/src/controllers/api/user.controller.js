import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User, Follower } from "../../models/index.js";



// export const signup = async (req, res) => {
//   try {
//     const { email, username, name, password } = req.body;

//     const existingUser = await User.findOne({ where: { email } });
//     if (existingUser) {
//       return res.status(400).json({ message: "Email already exists" });
//     }

//     const hashedPassword = await bcrypt.hash(password, 10);

//     const user = await User.create({
//       email,
//       username,
//       name,
//       password: hashedPassword
//     });

//     return res.status(201).json({
//       message: "Signup successful",
//       user: {
//         id: user.id,
//         email: user.email,
//         username: user.username
//       }
//     });

//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: "Signup failed" });
//   }
// };

export const signup = async (req, res) => {
  try {
    const {
      email,
      username,
      name,
      password,
      profilePhoto,
      bio,
      dateOfBirth,
      gender
    } = req.body;

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      email,
      username,
      name,
      password: hashedPassword,
      profilePhoto,
      bio,
      dateOfBirth,
      gender
    });

    return res.status(201).json({
      message: "Signup successful",
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        profilePhoto: user.profilePhoto,
        bio: user.bio,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Signup failed" });
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

// Follow Unfollow Methods

export const followUser = async (req, res) => {
  try {
    const followerId = req.user.id;      // logged-in user
    const followingId = req.params.id;   // profile user
    console.log("data mila ", req.user.id, req.params.id)
    if (followerId === followingId) {
      return res.status(400).json({ message: "You cannot follow yourself" });
    }

    const alreadyFollowing = await Follower.findOne({
      where: { follower_id: followerId, following_id: followingId }
    });

    if (alreadyFollowing) {
      return res.status(400).json({ message: "Already following this user" });
    }

    await Follower.create({
      follower_id: followerId,
      following_id: followingId
    });

    res.status(201).json({ message: "User followed successfully" });

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

export const getFollowStatus = async(req, res) => {
  try{
    const loggedInUserId = req.user.id; // from your auth middleware
    const targetUserId = req.params.id; //the you are viewing

    const followRecord = await Follower.findOne({
      where: {
        follower_id: loggedInUserId,
        following_id: targetUserId
      },
    });


    // If followRecord exists, isFollowing is true. If null, it's false.

    res.json({isFollowing: !!followRecord})
  }catch (error) {
    res.status(500).json({ error: error.message });
  }
};


